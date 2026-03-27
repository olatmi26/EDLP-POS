<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'po_number'            => $this->po_number,
            'supplier_id'          => $this->supplier_id,
            'supplier'             => $this->whenLoaded('supplier', fn () => [
                'id'   => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),
            'branch_id'            => $this->branch_id,
            'status'               => $this->status,
            'subtotal'             => (float) $this->subtotal,
            'tax_amount'           => (float) $this->tax_amount,
            'total_amount'         => (float) $this->total_amount,
            'expected_delivery_date' => $this->expected_delivery_date?->toDateString(),
            'delivery_days'          => (int) $this->delivery_days,
            'approved_at'           => $this->approved_at?->toISOString(),
            'received_at'           => $this->received_at?->toISOString(),
            'notes'                 => $this->notes,
            'items'                 => $this->whenLoaded('items', fn () =>
                $this->items->map(fn ($i) => (new PurchaseOrderItemResource($i))->toArray($request))
            ),
            'created_at'            => $this->created_at?->toISOString(),
            'updated_at'            => $this->updated_at?->toISOString(),
        ];
    }
}

