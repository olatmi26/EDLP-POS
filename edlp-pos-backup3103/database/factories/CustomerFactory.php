<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    // Nigerian first and last names
    private static array $firstNames = [
        'Amaka', 'Chioma', 'Emeka', 'Fatima', 'Gbemisola', 'Hassan', 'Ibrahim',
        'Joke', 'Kemi', 'Lanre', 'Musa', 'Ngozi', 'Olusegun', 'Patience', 'Rasheed',
        'Seun', 'Taiwo', 'Uche', 'Victoria', 'Wale', 'Yemi', 'Zainab', 'Adaeze',
        'Bola', 'Chukwuemeka', 'Damilola', 'Folake', 'Grace', 'Henry', 'Ifeoma',
    ];

    private static array $lastNames = [
        'Abiodun', 'Adeyemi', 'Balogun', 'Chukwu', 'Dada', 'Eze', 'Fashola',
        'Garba', 'Hassan', 'Igwe', 'Johnson', 'Kalu', 'Lawal', 'Mohammed',
        'Nwosu', 'Obi', 'Peterside', 'Quadri', 'Rotimi', 'Sule', 'Tunde',
        'Usman', 'Vitalis', 'Williams', 'Xavier', 'Yakubu', 'Zubair', 'Adeleke',
        'Babatunde', 'Coker',
    ];

    public function definition(): array
    {
        $firstName = $this->faker->randomElement(self::$firstNames);
        $lastName  = $this->faker->randomElement(self::$lastNames);

        return [
            'name'        => "{$firstName} {$lastName}",
            'phone'       => '080' . $this->faker->unique()->numerify('########'),
            'email'       => $this->faker->optional(0.4)->safeEmail(),
            'address'     => $this->faker->optional(0.5)->streetAddress(),
            'branch_id'   => Branch::factory(),
            'visit_count' => $this->faker->numberBetween(1, 50),
            'total_spend' => $this->faker->randomFloat(2, 500, 500000),
            'last_visit_at' => $this->faker->dateTimeBetween('-6 months', 'now'),
            'is_active'   => true,
        ];
    }

    public function frequent(): static
    {
        return $this->state(fn () => [
            'visit_count' => $this->faker->numberBetween(20, 100),
            'total_spend' => $this->faker->randomFloat(2, 100000, 1000000),
        ]);
    }

    public function gold(): static
    {
        return $this->state(fn () => [
            'visit_count' => $this->faker->numberBetween(50, 200),
            'total_spend' => $this->faker->randomFloat(2, 500000, 2000000),
        ]);
    }
}
