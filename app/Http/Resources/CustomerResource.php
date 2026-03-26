<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'phone'        => $this->phone,
            'email'        => $this->email,
            'address'      => $this->address,
            'branch_id'    => $this->branch_id,
            'visit_count'  => $this->visit_count,
            'total_spend'  => (float) $this->total_spend,
            'last_visit_at' => $this->last_visit_at?->toISOString(),
            'rank'         => $this->rank,
            'is_active'    => $this->is_active,
            'notes'        => $this->notes,
            'branch'       => $this->whenLoaded('branch', fn () => new BranchResource($this->branch)),
            'recent_sales' => $this->whenLoaded('sales', fn () => $this->sales->map(fn ($s) => [
                'id'             => $s->id,
                'receipt_number' => $s->receipt_number,
                'total'          => (float) $s->total,
                'date'           => $s->created_at?->toISOString(),
            ])),
            'created_at'   => $this->created_at?->toISOString(),
        ];
    }
}
