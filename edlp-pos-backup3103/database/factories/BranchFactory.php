<?php

namespace Database\Factories;

use App\Models\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

class BranchFactory extends Factory
{
    protected $model = Branch::class;

    public function definition(): array
    {
        static $counter = 0;
        $counter++;

        return [
            'name'           => 'EDLP ' . $this->faker->city() . ' Branch',
            'code'           => 'BR' . str_pad($counter, 4, '0', STR_PAD_LEFT),
            'address'        => $this->faker->streetAddress() . ', Lagos',
            'phone'          => '080' . $this->faker->numerify('########'),
            'email'          => $this->faker->unique()->safeEmail(),
            'is_head_office' => false,
            'is_active'      => true,
            'opening_time'   => '08:00',
            'closing_time'   => '21:00',
        ];
    }

    public function headOffice(): static
    {
        return $this->state(fn () => [
            'name'           => 'EDLP Head Office',
            'code'           => 'HQ001',
            'is_head_office' => true,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
