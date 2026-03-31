<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'display_name'  => $this->display_name,
            'code'          => $this->code,
            'address'       => $this->address,
            'phone'         => $this->phone,
            'email'         => $this->email,
            'is_head_office' => $this->is_head_office,
            'is_active'     => $this->is_active,
            'opening_time'  => $this->opening_time,
            'closing_time'  => $this->closing_time,
            'manager'       => $this->whenLoaded('manager', fn () => [
                'id'   => $this->manager->id,
                'name' => $this->manager->name,
            ]),
            'user_count'   => $this->whenLoaded('users', fn () => $this->users->count()),
            'created_at'   => $this->created_at?->toISOString(),
            'updated_at'   => $this->updated_at?->toISOString(),
        ];
    }
}
