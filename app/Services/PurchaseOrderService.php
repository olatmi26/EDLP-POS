<?php

namespace App\Services;

use App\Events\InventoryAdjusted;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    public function create(array $data, User $user, int $branchId): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $user, $branchId) {
            $items = $data['items'] ?? [];

            $productIds = collect($items)
                ->pluck('product_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            $productsById = Product::query()
                ->whereIn('id', $productIds)
                ->get()
                ->keyBy('id');

            $subtotal = 0.0;
            $preparedItems = [];

            foreach ($items as $item) {
                $productId = (int) $item['product_id'];
                $product   = $productsById->get($productId);

                if (! $product) {
                    throw new \RuntimeException("Product not found: {$productId}");
                }

                $quantityOrdered = (int) $item['quantity_ordered'];

                $unitCost = array_key_exists('unit_cost', $item) && $item['unit_cost'] !== null
                    ? (float) $item['unit_cost']
                    : (float) $product->cost_price;

                $lineTotal = round($unitCost * $quantityOrdered, 2);
                $subtotal += $lineTotal;

                $preparedItems[] = [
                    'product_id'        => $productId,
                    'quantity_ordered' => $quantityOrdered,
                    'quantity_received'=> 0,
                    'unit_cost'         => $unitCost,
                    'line_total'        => $lineTotal,
                ];
            }

            $taxAmount = (float) ($data['tax_amount'] ?? 0);
            $expectedDeliveryDate = $data['expected_delivery_date'] ?? null;
            $notes = $data['notes'] ?? null;

            $purchaseOrder = PurchaseOrder::create([
                'po_number'                => PurchaseOrder::generatePoNumber($branchId),
                'supplier_id'              => (int) $data['supplier_id'],
                'branch_id'                => $branchId,
                'created_by'               => $user->id,
                'approved_by'              => null,
                'received_by'              => null,
                'status'                   => PurchaseOrder::STATUS_PENDING,
                'subtotal'                 => $subtotal,
                'tax_amount'               => $taxAmount,
                'total_amount'             => round($subtotal + $taxAmount, 2),
                'expected_delivery_date'  => $expectedDeliveryDate,
                'notes'                    => $notes,
            ]);

            foreach ($preparedItems as $prepared) {
                $purchaseOrder->items()->create($prepared);
            }

            return $purchaseOrder->load(['supplier', 'branch', 'items.product']);
        });
    }

    public function approve(PurchaseOrder $purchaseOrder, User $user, ?string $notes = null): PurchaseOrder
    {
        return DB::transaction(function () use ($purchaseOrder, $user, $notes) {
            $po = PurchaseOrder::query()
                ->where('id', $purchaseOrder->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($po->status, [PurchaseOrder::STATUS_DRAFT, PurchaseOrder::STATUS_PENDING], true)) {
                throw new \RuntimeException('Purchase order is not in a state that can be approved.');
            }

            $po->update([
                'status'       => PurchaseOrder::STATUS_APPROVED,
                'approved_by'  => $user->id,
                'approved_at'  => now(),
                'notes'        => $notes ? trim($notes) : $po->notes,
            ]);

            return $po->load(['supplier', 'branch', 'items.product']);
        });
    }

    public function receive(PurchaseOrder $purchaseOrder, User $user, ?string $notes = null): PurchaseOrder
    {
        return DB::transaction(function () use ($purchaseOrder, $user, $notes) {
            $po = PurchaseOrder::query()
                ->where('id', $purchaseOrder->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($po->status !== PurchaseOrder::STATUS_APPROVED) {
                throw new \RuntimeException('Purchase order must be approved before receiving.');
            }

            $receivedAt = now();

            foreach ($po->items()->lockForUpdate()->get() as $item) {
                $qty = (int) $item->quantity_ordered;

                $item->update([
                    'quantity_received' => $qty,
                ]);

                // Update inventory for the PO's branch.
                $inventory = Inventory::query()
                    ->where('product_id', $item->product_id)
                    ->where('branch_id', $po->branch_id)
                    ->lockForUpdate()
                    ->first();

                if (! $inventory) {
                    $inventory = Inventory::create([
                        'product_id'      => $item->product_id,
                        'branch_id'       => $po->branch_id,
                        'quantity'        => 0,
                        'reserved_quantity' => 0,
                    ]);
                }

                $before = (int) $inventory->quantity;
                $inventory->increment('quantity', $qty);
                $inventory->refresh();

                // There are currently no listeners, but we keep the event for future QA parity.
                event(new InventoryAdjusted(
                    inventory: $inventory,
                    before: $before,
                    after: (int) $inventory->quantity,
                    adjustmentType: 'add',
                    notes: $notes,
                    adjustedBy: $user
                ));
            }

            $deliveryDays = null;
            if ($po->created_at && $receivedAt) {
                $deliveryDays = $po->created_at->diffInDays($receivedAt);
            }

            $po->update([
                'status'        => PurchaseOrder::STATUS_RECEIVED,
                'received_by'   => $user->id,
                'received_at'   => $receivedAt,
                'delivery_days' => $deliveryDays,
                'notes'         => $notes ? trim($notes) : $po->notes,
            ]);

            return $po->load(['supplier', 'branch', 'items.product']);
        });
    }
}

