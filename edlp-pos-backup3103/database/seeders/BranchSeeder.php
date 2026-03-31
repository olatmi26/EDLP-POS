<?php

namespace Database\Seeders;

use App\Models\Branch;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $branches = [
            [
                'name'          => 'EDLP Head Office',
                'code'          => 'HQ',
                'address'       => '15 Admiralty Way, Lekki Phase 1, Lagos',
                'phone'         => '08081986489',
                'email'         => 'hq@edlpnigeria.com',
                'is_head_office' => true,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '18:00',
            ],
            [
                'name'          => 'EDLP Lekki Branch',
                'code'          => 'LK',
                'address'       => '22 Admiralty Road, Lekki, Lagos',
                'phone'         => '08081986401',
                'email'         => 'lekki@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
            [
                'name'          => 'EDLP Victoria Island Branch',
                'code'          => 'VI',
                'address'       => '45 Adeola Odeku Street, Victoria Island, Lagos',
                'phone'         => '08081986402',
                'email'         => 'vi@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
            [
                'name'          => 'EDLP Ikeja Branch',
                'code'          => 'IK',
                'address'       => '12 Allen Avenue, Ikeja, Lagos',
                'phone'         => '08081986403',
                'email'         => 'ikeja@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
            [
                'name'          => 'EDLP Surulere Branch',
                'code'          => 'SU',
                'address'       => '5 Bode Thomas Street, Surulere, Lagos',
                'phone'         => '08081986404',
                'email'         => 'surulere@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
            [
                'name'          => 'EDLP Yaba Branch',
                'code'          => 'YB',
                'address'       => '31 Herbert Macaulay Way, Yaba, Lagos',
                'phone'         => '08081986405',
                'email'         => 'yaba@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
            [
                'name'          => 'EDLP Ajah Branch',
                'code'          => 'AJ',
                'address'       => '8 Abraham Adesanya Road, Ajah, Lagos',
                'phone'         => '08081986406',
                'email'         => 'ajah@edlpnigeria.com',
                'is_head_office' => false,
                'is_active'     => true,
                'opening_time'  => '08:00',
                'closing_time'  => '21:00',
            ],
        ];

        foreach ($branches as $branch) {
            Branch::firstOrCreate(['code' => $branch['code']], $branch);
        }

        $this->command->info('7 branches seeded (1 HQ + 6 stores).');
    }
}
