<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'company_name'       => $this->company_name,
            'contact_person'     => $this->contact_person,
            'email'               => $this->email,
            'phone'               => $this->phone,
            'phone_alt'           => $this->phone_alt,
            'address'             => $this->address,
            'city'                => $this->city,
            'state'               => $this->state,
            'outstanding_balance'=> (float) $this->outstanding_balance,
            'total_orders'        => (int) $this->total_orders,
            'avg_delivery_days'  => (float) $this->avg_delivery_days,
            'fill_rate'          => (float) $this->fill_rate,
            'delivery_performance' => (float) $this->delivery_performance,
            'notes'               => $this->notes,
            'is_active'           => $this->is_active,
            'created_at'          => $this->created_at?->toISOString(),
            'updated_at'          => $this->updated_at?->toISOString(),
        ];
    }
}

