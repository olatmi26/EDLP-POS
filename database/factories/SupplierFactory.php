<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    public function definition(): array
    {
        return [
            'name'           => $this->faker->company() . ' Ltd',
            'contact_person' => $this->faker->name(),
            'email'          => $this->faker->unique()->companyEmail(),
            'phone'          => '080' . $this->faker->numerify('########'),
            'address'        => $this->faker->streetAddress() . ', Lagos',
            'city'           => 'Lagos',
            'state'          => 'Lagos',
            'payment_terms'  => $this->faker->randomElement(['Net 30', 'Net 15', 'COD', 'Net 60']),
            'is_active'      => true,
            'rating'         => $this->faker->randomFloat(2, 2.0, 5.0),
        ];
    }
}
