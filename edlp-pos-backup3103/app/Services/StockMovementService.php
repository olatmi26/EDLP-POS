<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\ProductBatch;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StockMovementService
{
    public function __construct(
        private readonly ApprovalWorkflowService $approvalService
    ) {}

    /**
     * Submit a stock movement request (any staff member can raise this).
     */
    public function request(array $data, User $requestedBy): StockMovement
    {
        return DB::transaction(function () use ($data, $requestedBy) {
            $product        = \App\Models\Product::findOrFail($data['product_id']);
            $estimatedValue = round((float) $product->cost_price * (int) $data['quantity'], 2);

            $movement = StockMovement::create([
                'branch_id'            => $data['branch_id'] ?? $requestedBy->branch_id,
                'product_id'           => $data['product_id'],
                'batch_id'             => $data['batch_id'] ?? null,
                'quantity'             => $data['quantity'],
                'movement_type'        => $data['movement_type'],
                'reason'               => $data['reason'],
                'requested_by'         => $requestedBy->id,
                'status'               => StockMovement::STATUS_PENDING,
                'estimated_cost_value' => $estimatedValue,
            ]);

            // Route through configurable approval engine
            $approvalRequest = $this->approvalService->initiate(
                operationType: 'stock_movement',
                operationId:   $movement->id,
                requestedBy:   $requestedBy,
                context:       [
                    'movement_type'  => $data['movement_type'],
                    'quantity'       => $data['quantity'],
                    'product_name'   => $product->name,
                    'estimated_cost' => $estimatedValue,
                ],
                branchId: $movement->branch_id,
            );

            $movement->update(['approval_request_id' => $approvalRequest->id]);

            return $movement->load(['product', 'requestedBy', 'approvalRequest']);
        });
    }

    /**
     * Execute an approved stock movement — deduct inventory.
     * Called by ApprovalFullyApproved event listener.
     */
    public function execute(int $movementId, User $executedBy): StockMovement
    {
        return DB::transaction(function () use ($movementId, $executedBy) {
            $movement = StockMovement::with('batch')->lockForUpdate()->findOrFail($movementId);

            if (! $movement->isPending()) {
                throw new \RuntimeException('Only pending movements can be executed.');
            }

            // Deduct from inventory
            $inventory = Inventory::where('product_id', $movement->product_id)
                ->where('branch_id', $movement->branch_id)
                ->lockForUpdate()
                ->first();

            if (! $inventory || $inventory->quantity < $movement->quantity) {
                throw new \RuntimeException('Insufficient stock to execute this movement.');
            }

            $inventory->decrement('quantity', $movement->quantity);

            // If batch-specific, deduct from the batch too (FEFO aware)
            if ($movement->batch_id) {
                $movement->batch?->deductQuantity($movement->quantity);
            }

            // For high-value damaged stock, auto-create an expense record
            if ($movement->movement_type === 'damaged' && $movement->estimated_cost_value >= 5000) {
                \App\Models\Expense::create([
                    'branch_id'          => $movement->branch_id,
                    'expense_category_id'=> null,
                    'amount'             => $movement->estimated_cost_value,
                    'description'        => "Stock damage write-off: {$movement->quantity} units (Movement #{$movement->id})",
                    'recorded_by'        => $executedBy->id,
                    'status'             => 'approved',
                    'incurred_at'        => now(),
                ]);
            }

            $movement->update([
                'status'      => StockMovement::STATUS_EXECUTED,
                'executed_by' => $executedBy->id,
                'executed_at' => now(),
            ]);

            return $movement->fresh();
        });
    }

    /**
     * Get shrinkage summary for a branch over a date range.
     */
    public function shrinkageSummary(int $branchId, string $from, string $to): array
    {
        return StockMovement::where('branch_id', $branchId)
            ->where('status', StockMovement::STATUS_EXECUTED)
            ->whereBetween('executed_at', [$from, $to])
            ->selectRaw('movement_type, SUM(quantity) as total_qty, SUM(estimated_cost_value) as total_value')
            ->groupBy('movement_type')
            ->get()
            ->map(fn ($row) => [
                'type'        => $row->movement_type,
                'total_qty'   => $row->total_qty,
                'total_value' => round($row->total_value, 2),
            ])
            ->toArray();
    }
}
