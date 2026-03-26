<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
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
            'category'       => $this->whenLoaded('category', fn () => [
                'id'   => $this->category->id,
                'name' => $this->category->name,
            ]),
            'supplier'       => $this->whenLoaded('supplier', fn () => [
                'id'   => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),
            // Stock for a specific branch (only present when inventory eager-loaded for that branch)
            'stock'          => $this->whenLoaded('inventory', fn () => $this->inventory->first()?->quantity ?? 0),
            'stock_status'   => $this->whenLoaded('inventory', fn () => $this->inventory->first()?->status ?? 'unknown'),
            'price_history'  => $this->whenLoaded('priceHistory', fn () =>
                $this->priceHistory->map(fn ($h) => [
                    'old_price'  => (float) $h->old_price,
                    'new_price'  => (float) $h->new_price,
                    'change_pct' => $h->price_change_pct,
                    'type'       => $h->change_type,
                    'date'       => $h->effective_at?->toISOString(),
                ])
            ),
            'created_at'     => $this->created_at?->toISOString(),
            'updated_at'     => $this->updated_at?->toISOString(),
        ];
    }
}
