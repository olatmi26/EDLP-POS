<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'email'              => $this->email,
            'phone'              => $this->phone,
            'staff_id'           => $this->staff_id,
            'branch_id'          => $this->branch_id,
            'is_active'          => (bool) $this->is_active,
            'is_online'          => (bool) ($this->is_online ?? false),
            'pin_login_enabled'  => (bool) ($this->pin_login_enabled ?? false),
            'last_login_at'      => $this->last_login_at?->toISOString(),
            'avatar_url'         => $this->avatar_url,
            'roles'              => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')),
            'permissions'        => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')),
            'branch'             => $this->whenLoaded('branch', fn () => new BranchResource($this->branch)),
            'created_at'         => $this->created_at?->toISOString(),
        ];
    }
}
