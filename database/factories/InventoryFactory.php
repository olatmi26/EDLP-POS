<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

class InventoryFactory extends Factory
{
    protected $model = Inventory::class;

    public function definition(): array
    {
        return [
            'product_id'        => Product::factory(),
            'branch_id'         => Branch::factory(),
            'quantity'          => $this->faker->numberBetween(0, 200),
            'reserved_quantity' => 0,
        ];
    }

    public function outOfStock(): static
    {
        return $this->state(fn () => ['quantity' => 0]);
    }

    public function lowStock(): static
    {
        return $this->state(fn () => ['quantity' => 2]);
    }

    public function inStock(int $qty = 50): static
    {
        return $this->state(fn () => ['quantity' => $qty]);
    }
}
