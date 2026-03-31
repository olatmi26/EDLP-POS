<?php

namespace App\Services;

use App\Models\ExpiryDisposal;
use App\Models\ProductBatch;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ExpiryService
{
    public function __construct(
        private readonly ApprovalWorkflowService $approvalService
    ) {}

    /**
     * FEFO: Return the earliest-expiry active batch for a product at a branch.
     * Called by SaleService at checkout to determine which batch to deduct from.
     */
    public function getActiveBatch(int $productId, int $branchId): ?ProductBatch
    {
        return ProductBatch::getActiveBatch($productId, $branchId);
    }

    /**
     * Deduct quantity from FEFO batches for a product.
     * Cascades to next batch if current batch is exhausted.
     *
     * @return array  List of [batch_id, quantity_deducted] pairs for audit
     */
    public function deductForSale(int $productId, int $branchId, int $quantity): array
    {
        $remaining = $quantity;
        $deductions = [];

        $batches = ProductBatch::activeFEFO($productId, $branchId)
            ->lockForUpdate()
            ->get();

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $available = $batch->quantity_remaining;
            if ($available <= 0) {
                continue;
            }

            $deduct = min($available, $remaining);

            if ($deduct <= 0) {
                continue;
            }

            if ($batch->deductQuantity($deduct)) {
                $deductions[] = ['batch_id' => $batch->id, 'quantity' => $deduct];
                $remaining   -= $deduct;
            } else {
                Log::warning("Failed to deduct quantity from batch #{$batch->id} for product #{$productId} at branch #{$branchId}");
            }
        }

        if ($remaining > 0) {
            Log::warning("FEFO deduction: {$remaining} units could not be allocated for product #{$productId} at branch #{$branchId}");
        }

        return $deductions;
    }

    /**
     * Receive a new batch of stock (called from PurchaseOrderService on receive).
     */
    public function receiveBatch(array $data, User $receivedBy): ProductBatch
    {
        $expiryDate = \Carbon\Carbon::parse($data['expiry_date']);

        if ($expiryDate->isPast()) {
            throw new \RuntimeException('Cannot receive stock with an expired batch date.');
        }

        if ($expiryDate->diffInDays(now()) < 7) {
            throw new \RuntimeException('Expiry date must be at least 7 days in the future.');
        }

        return ProductBatch::create([
            'product_id'        => $data['product_id'],
            'branch_id'         => $data['branch_id'],
            'supplier_id'       => $data['supplier_id'] ?? null,
            'purchase_order_id' => $data['purchase_order_id'] ?? null,
            'batch_number'      => $data['batch_number'],
            'manufactured_date' => $data['manufactured_date'] ?? null,
            'expiry_date'       => $data['expiry_date'],
            'quantity_received' => $data['quantity'],
            'quantity_remaining'=> $data['quantity'],
            'cost_per_unit'     => $data['cost_per_unit'],
            'received_by'       => $receivedBy->id,
            'status'            => ProductBatch::STATUS_ACTIVE,
        ]);
    }

    /**
     * Monitor all batches and update statuses based on expiry proximity.
     * Run daily by scheduler at 06:00.
     *
     * @return array ['flagged' => int, 'expired' => int]
     */
    public function runExpiryMonitor(int $nearExpiryDays = 30): array
    {
        $flagged = 0;
        $expired = 0;

        // Flag near-expiry
        $nearExpiry = ProductBatch::where('status', ProductBatch::STATUS_ACTIVE)
            ->nearExpiry($nearExpiryDays)
            ->get();

        foreach ($nearExpiry as $batch) {
            $batch->update(['status' => ProductBatch::STATUS_NEAR_EXPIRY]);
            $flagged++;
            $productName = ($batch->product && property_exists($batch->product, 'name')) ? $batch->product->name : 'Product';
            Log::info("Batch #{$batch->id} ({$productName}) flagged as near-expiry. Expires: {$batch->expiry_date}");
        }

        // Mark truly expired
        $expiredBatches = ProductBatch::whereDate('expiry_date', '<', today())
            ->whereNotIn('status', [ProductBatch::STATUS_DISPOSED, ProductBatch::STATUS_EXPIRED])
            ->get();

        foreach ($expiredBatches as $batch) {
            $batch = ProductBatch::findOrFail($batch->id);
            $batch->update(['status' => ProductBatch::STATUS_EXPIRED]);
            $expired++;
        }

        return ['flagged' => $flagged, 'expired' => $expired];
    }

    /**
     * Submit a disposal request for an expired or near-expiry batch.
     * Routes through the Approval Workflow Engine.
     */
    public function requestDisposal(array $data, User $requestedBy): ExpiryDisposal
    {
        return DB::transaction(function () use ($data, $requestedBy) {
            $batch = ProductBatch::findOrFail($data['batch_id']);

            if ($data['quantity'] > $batch->quantity_remaining) {
                throw new \RuntimeException('Disposal quantity exceeds remaining batch stock.');
            }

            $writeOffValue = round($batch->cost_per_unit * $data['quantity'], 2);

            $disposal = ExpiryDisposal::create([
                'batch_id'        => $batch->id,
                'branch_id'       => $batch->branch_id,
                'quantity'        => $data['quantity'],
                'reason'          => $data['reason'],
                'disposal_method' => $data['disposal_method'],
                'write_off_value' => $writeOffValue,
                'disposed_by'     => $requestedBy->id,
                'notes'           => $data['notes'] ?? null,
            ]);

            // Route through approval engine
            $request = $this->approvalService->initiate(
                operationType: 'expiry_disposal',
                operationId:   $disposal->id,
                requestedBy:   $requestedBy,
                context:       [
                    'batch_number'    => $batch->batch_number,
                    'product_id'      => $batch->product_id,
                    'quantity'        => $data['quantity'],
                    'write_off_value' => $writeOffValue,
                ],
                branchId: $batch->branch_id,
            );

            $disposal->update(['approval_request_id' => $request->id]);

            return $disposal->load(['batch.product', 'approvalRequest']);
        });
    }

    /**
     * Execute a disposal after full approval.
     * Called by ApprovalFullyApproved event listener.
     */
    public function executeDisposal(int $disposalId): void
    {
        DB::transaction(function () use ($disposalId) {
            $disposal = ExpiryDisposal::with('batch')->findOrFail($disposalId);
            $batch    = $disposal->batch;

            $batch->decrement('quantity_remaining', $disposal->quantity);

            if ($batch->quantity_remaining <= 0) {
                $batch->update(['status' => ProductBatch::STATUS_DISPOSED]);
            }

            $disposal->update(['disposed_at' => now()]);

            Log::info("Expiry disposal #{$disposalId} executed: {$disposal->quantity} units of batch #{$batch->id}");
        });
    }
}
