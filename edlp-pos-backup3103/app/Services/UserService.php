<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserService
{
    /**
     * Create a new user and assign a role.
     */
    public function create(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $role = $data['role'] ?? 'cashier';
            unset($data['role']);

            if (empty($data['password'])) {
                $data['password'] = Str::random(12);
            }

            $user = User::create($data);
            $user->assignRole($role);

            return $user;
        });
    }

    /**
     * Update a user, optionally changing their role.
     */
    public function update(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data) {
            $role = $data['role'] ?? null;
            unset($data['role']);

            // Don't overwrite password if not provided
            if (empty($data['password'])) {
                unset($data['password']);
            }

            // Don't reset PIN unless explicitly provided
            if (! isset($data['pin'])) {
                unset($data['pin']);
            }

            $user->update($data);

            if ($role) {
                $user->syncRoles([$role]);
            }

            return $user->fresh();
        });
    }
}
