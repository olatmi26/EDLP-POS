<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                       => $this->id,
            'product_id'               => $this->product_id,
            'branch_id'                => $this->branch_id,
            'quantity'                 => $this->quantity,
            'reserved_quantity'        => $this->reserved_quantity,
            'available_quantity'       => $this->available_quantity,
            'status'                   => $this->status,
            'last_stock_take_at'       => $this->last_stock_take_at?->toISOString(),
            'last_stock_take_quantity' => $this->last_stock_take_quantity,
            'product'                  => $this->whenLoaded('product', fn () => new ProductResource($this->product)),
            'branch'                   => $this->whenLoaded('branch', fn () => new BranchResource($this->branch)),
            'updated_at'               => $this->updated_at?->toISOString(),
        ];
    }
}
