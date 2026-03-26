<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    private static array $units  = ['piece', 'pack', 'bag', 'bottle', 'can', 'box', 'sachet', 'tin', 'tube', 'bar'];

    public function definition(): array
    {
        return [
            'name'          => $this->faker->words(3, true),
            'sku'           => strtoupper($this->faker->unique()->bothify('??-###-??')),
            'barcode'       => $this->faker->unique()->numerify('60011######'),
            'description'   => $this->faker->sentence(),
            'category_id'   => Category::factory(),
            'supplier_id'   => Supplier::factory(),
            'cost_price'    => $this->faker->randomFloat(2, 100, 10000),
            'selling_price' => $this->faker->randomFloat(2, 150, 15000),
            'unit'          => $this->faker->randomElement(self::$units),
            'reorder_level' => $this->faker->numberBetween(5, 50),
            'is_active'     => true,
            'is_vat_exempt' => false,
            'vat_rate'      => 7.5,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function vatExempt(): static
    {
        return $this->state(fn () => ['is_vat_exempt' => true, 'vat_rate' => 0]);
    }
}
