<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name'               => $this->faker->name(),
            'email'              => $this->faker->unique()->safeEmail(),
            'email_verified_at'  => now(),
            'password'           => Hash::make('password'),
            'phone'              => '080' . $this->faker->numerify('########'),
            'branch_id'          => Branch::factory(),
            'is_active'          => true,
            'pin_login_enabled'  => false,
            'remember_token'     => Str::random(10),
        ];
    }

    public function superAdmin(): static
    {
        return $this->afterCreating(fn (User $user) => $user->assignRole('super-admin'));
    }

    public function admin(): static
    {
        return $this->afterCreating(fn (User $user) => $user->assignRole('admin'));
    }

    public function branchManager(): static
    {
        return $this->afterCreating(fn (User $user) => $user->assignRole('branch-manager'));
    }

    public function cashier(): static
    {
        return $this->state(fn () => [
            'pin_login_enabled' => true,
            'pin'               => Hash::make('1234'),
        ])->afterCreating(fn (User $user) => $user->assignRole('cashier'));
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
