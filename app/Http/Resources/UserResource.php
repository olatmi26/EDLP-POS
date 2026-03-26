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
            'branch_id'          => $this->branch_id,
            'is_active'          => $this->is_active,
            'pin_login_enabled'  => $this->pin_login_enabled,
            'last_login_at'      => $this->last_login_at?->toISOString(),
            'avatar_url'         => $this->avatar_url,
            'roles'              => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')),
            'permissions'        => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')),
            'branch'             => $this->whenLoaded('branch', fn () => new BranchResource($this->branch)),
            'created_at'         => $this->created_at?->toISOString(),
        ];
    }
}
