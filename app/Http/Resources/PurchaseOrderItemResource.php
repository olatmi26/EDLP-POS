<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'product_id'       => $this->product_id,
            'product'           => $this->whenLoaded('product', fn () => [
                'id'      => $this->product->id,
                'name'    => $this->product->name,
                'sku'     => $this->product->sku,
                'barcode' => $this->product->barcode,
            ]),
            'unit_cost'        => (float) $this->unit_cost,
            'quantity_ordered' => (int) $this->quantity_ordered,
            'quantity_received'=> (int) $this->quantity_received,
            'pending_quantity' => (int) $this->quantity_pending,
            'line_total'       => (float) $this->line_total,
        ];
    }
}

