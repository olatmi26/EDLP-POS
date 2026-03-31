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
            'company_name'  => $this->faker->company(),
            'contact_person' => $this->faker->name(),
            'email'          => $this->faker->unique()->companyEmail(),
            'phone'          => '080' . $this->faker->numerify('########'),
            'address'        => $this->faker->streetAddress() . ', Lagos',
            'city'           => 'Lagos',
            'state'          => 'Lagos',
            'phone_alt'      => null,
            'outstanding_balance' => $this->faker->randomFloat(2, 0, 500000),
            'total_orders'   => $this->faker->numberBetween(0, 5000),
            'avg_delivery_days' => $this->faker->randomFloat(2, 1, 60),
            'fill_rate'      => $this->faker->randomFloat(2, 70, 100),
            'is_active'      => true,
            'notes'          => null,
        ];
    }
}
