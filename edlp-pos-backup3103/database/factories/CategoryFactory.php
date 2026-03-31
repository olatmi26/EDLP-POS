<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        $name = $this->faker->words(2, true);

        return [
            'name'       => ucwords($name),
            'slug'       => Str::slug($name) . '-' . $this->faker->unique()->numberBetween(1, 9999),
            'is_active'  => true,
            'sort_order' => $this->faker->numberBetween(1, 100),
        ];
    }
}
