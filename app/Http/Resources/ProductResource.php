<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // When inventory is eager-loaded, compute totals across all loaded rows.
        // The controller may scope inventory to one branch (for POS/cashier),
        // or load all branches (for super-admin catalog view).
        $inventoryLoaded = $this->relationLoaded('inventory');
        $inventoryRows   = $inventoryLoaded ? $this->inventory : collect();

        $totalStock    = $inventoryRows->sum('quantity');
        $branchStocks  = $inventoryRows->map(fn ($inv) => [
            'branch_id'         => $inv->branch_id,
            'quantity'          => $inv->quantity,
            'reserved_quantity' => $inv->reserved_quantity ?? 0,
            'status'            => $inv->status,
        ])->values();

        // Determine aggregate stock status
        $stockStatus = 'unknown';
        if ($inventoryLoaded) {
            $lowCount = $inventoryRows->filter(
                fn ($inv) => $inv->quantity > 0 && $inv->quantity <= ($this->reorder_level ?? 0)
            )->count();
            $outCount = $inventoryRows->filter(fn ($inv) => $inv->quantity <= 0)->count();
            $total    = $inventoryRows->count();

            if ($total === 0) {
                $stockStatus = 'unknown';
            } elseif ($outCount === $total) {
                $stockStatus = 'out';
            } elseif ($lowCount > 0) {
                $stockStatus = 'low';
            } else {
                $stockStatus = 'ok';
            }
        }

        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'sku'            => $this->sku,
            'barcode'        => $this->barcode,
            'description'    => $this->description,
            'cost_price'     => (float) $this->cost_price,
            'selling_price'  => (float) $this->selling_price,
            'unit'           => $this->unit,
            'reorder_level'  => $this->reorder_level,
            'is_active'      => $this->is_active,
            'is_vat_exempt'  => $this->is_vat_exempt,
            'vat_rate'       => (float) ($this->vat_rate ?? config('pos.vat_rate', 7.5)),
            'thumbnail_url'  => $this->thumbnail_url,
            'category_id'    => $this->category_id,
            'supplier_id'    => $this->supplier_id,

            // Relationships
            'category' => $this->whenLoaded('category', fn () => [
                'id'   => $this->category->id,
                'name' => $this->category->name,
            ]),
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id'   => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),

            // Inventory — aggregated totals + per-branch breakdown
            'stock'         => $inventoryLoaded ? $totalStock        : null,
            'stock_status'  => $inventoryLoaded ? $stockStatus       : null,
            'branch_stocks' => $inventoryLoaded ? $branchStocks      : null,

            // Price history (detail view only)
            'price_history' => $this->whenLoaded('priceHistory', fn () =>
                $this->priceHistory->map(fn ($h) => [
                    'old_price'  => (float) $h->old_price,
                    'new_price'  => (float) $h->new_price,
                    'change_pct' => $h->price_change_pct,
                    'type'       => $h->change_type,
                    'date'       => $h->effective_at?->toISOString(),
                ])
            ),

            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
