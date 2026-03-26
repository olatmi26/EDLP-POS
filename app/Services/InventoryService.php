<?php

namespace App\Services;

use App\Events\InventoryAdjusted;
use App\Models\Inventory;
use App\Models\InventoryTransfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Adjust stock for a product at a branch.
     *
     * @param  string $type  'add' | 'remove' | 'set'
     */
    public function adjust(int $productId, int $branchId, string $type, int $quantity, ?string $notes, User $user): Inventory
    {
        return DB::transaction(function () use ($productId, $branchId, $type, $quantity, $notes, $user) {
            $inventory = Inventory::firstOrCreate(
                ['product_id' => $productId, 'branch_id' => $branchId],
                ['quantity' => 0, 'reserved_quantity' => 0]
            );

            $before = $inventory->quantity;

            match ($type) {
                'add'    => $inventory->increment('quantity', $quantity),
                'remove' => $inventory->decrement('quantity', $quantity),
                'set'    => $inventory->update(['quantity' => max(0, $quantity)]),
            };

            $inventory->refresh();

            // Fire event — listeners handle: low-stock notification, sync log
            event(new InventoryAdjusted($inventory, $before, $inventory->quantity, $type, $notes, $user));

            return $inventory;
        });
    }

    /**
     * Decrement stock after a sale — called from SaleService.
     */
    public function decrementForSale(int $productId, int $branchId, int $quantity): void
    {
        $inventory = Inventory::where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->lockForUpdate()
            ->first();

        if (! $inventory) {
            return;
        }

        $inventory->decrement('quantity', $quantity);
    }

    /**
     * Restore stock after a void or refund.
     */
    public function restoreForRefund(int $productId, int $branchId, int $quantity): void
    {
        Inventory::where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->increment('quantity', $quantity);
    }

    /**
     * Record a full stock-take.
     */
    public function stockTake(array $items, int $branchId, User $user): array
    {
        $results = [];

        DB::transaction(function () use ($items, $branchId, $user, &$results) {
            foreach ($items as $item) {
                $inventory = Inventory::firstOrCreate(
                    ['product_id' => $item['product_id'], 'branch_id' => $branchId],
                    ['quantity' => 0, 'reserved_quantity' => 0]
                );

                $before = $inventory->quantity;

                $inventory->update([
                    'quantity'                 => $item['quantity'],
                    'last_stock_take_at'       => now(),
                    'last_stock_take_quantity' => $item['quantity'],
                ]);

                $results[] = [
                    'product_id' => $item['product_id'],
                    'before'     => $before,
                    'after'      => $item['quantity'],
                    'variance'   => $item['quantity'] - $before,
                ];
            }
        });

        return $results;
    }

    /**
     * Request an inter-branch stock transfer.
     */
    public function requestTransfer(array $data, User $requestedBy): InventoryTransfer
    {
        // Validate source branch has sufficient stock
        $sourceInventory = Inventory::where('product_id', $data['product_id'])
            ->where('branch_id', $data['from_branch_id'])
            ->first();

        if (! $sourceInventory || $sourceInventory->quantity < $data['quantity']) {
            throw new \RuntimeException('Insufficient stock in source branch for this transfer');
        }

        return InventoryTransfer::create([
            'product_id'     => $data['product_id'],
            'from_branch_id' => $data['from_branch_id'],
            'to_branch_id'   => $data['to_branch_id'],
            'requested_by'   => $requestedBy->id,
            'quantity'       => $data['quantity'],
            'status'         => InventoryTransfer::STATUS_PENDING,
            'notes'          => $data['notes'] ?? null,
        ]);
    }

    /**
     * Approve a transfer and move stock.
     */
    public function approveTransfer(int $transferId, User $approvedBy): InventoryTransfer
    {
        return DB::transaction(function () use ($transferId, $approvedBy) {
            $transfer = InventoryTransfer::lockForUpdate()->findOrFail($transferId);

            if (! $transfer->isPending()) {
                throw new \RuntimeException('Transfer is no longer pending');
            }

            // Deduct from source
            $this->adjust(
                productId: $transfer->product_id,
                branchId:  $transfer->from_branch_id,
                type:      'remove',
                quantity:  $transfer->quantity,
                notes:     "Transfer #{$transfer->id} approved",
                user:      $approvedBy
            );

            // Add to destination
            $this->adjust(
                productId: $transfer->product_id,
                branchId:  $transfer->to_branch_id,
                type:      'add',
                quantity:  $transfer->quantity,
                notes:     "Transfer #{$transfer->id} received",
                user:      $approvedBy
            );

            $transfer->update([
                'status'       => InventoryTransfer::STATUS_COMPLETED,
                'approved_by'  => $approvedBy->id,
                'approved_at'  => now(),
                'completed_at' => now(),
            ]);

            return $transfer->fresh();
        });
    }
}
