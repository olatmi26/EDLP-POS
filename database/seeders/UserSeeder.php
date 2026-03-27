<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $hq      = Branch::where('code', 'HQ001')->first();
        $lekki   = Branch::where('code', 'LEK001')->first();
        $vi      = Branch::where('code', 'VI0001')->first();
        $ikeja   = Branch::where('code', 'IKJ001')->first();

        $users = [
            // Super Admin
            [
                'name'              => 'Taiwo Hassan',
                'email'             => 'admin@edlpnigeria.com',
                'password'          => Hash::make('Admin@12345'),
                'phone'             => '08103051720',
                'staff_id'         => '900021',
                'branch_id'         => $hq?->id,
                'is_active'         => true,
                'pin_login_enabled' => false,
                'role'              => 'super-admin',
            ],
            // Admin
            [
                'name'              => 'Ajibola Manager',
                'email'             => 'manager@edlpnigeria.com',
                'password'          => Hash::make('Manager@12345'),
                'phone'             => '08011111101',
                'branch_id'         => $hq?->id,
                'staff_id'         => '201800',
                'is_active'         => true,
                'pin'              => Hash::make('182026'),
                'pin_login_enabled' => true,
                'role'              => 'admin',
            ],
            // Branch Manager — Lekki
            [
                'name'              => 'Emeka Okafor',
                'email'             => 'emeka@edlpnigeria.com',
                'password'          => Hash::make('Branch@12345'),
                'phone'             => '08022222201',
                'staff_id'         => '539405',
                'branch_id'         => $lekki?->id,
                'is_active'         => true,
                'pin'              => Hash::make('143902'),
                'pin_login_enabled' => true,
                'role'              => 'branch-manager',
            ],
            // Branch Manager — VI
            [
                'name'              => 'Chioma Eze',
                'email'             => 'chioma@edlpnigeria.com',
                'password'          => Hash::make('Branch@12345'),
                'phone'             => '08033333301',
                'staff_id'         => '539402',
                'branch_id'         => $vi?->id,
                'is_active'         => true,
                'pin'              => Hash::make('393914'),
                'pin_login_enabled' => true,
                'role'              => 'branch-manager',
            ],
            // Cashier — Lekki
            [
                'name'              => 'Fatima Abdullahi',
                'email'             => 'fatima@edlpnigeria.com',
                'password'          => Hash::make('Cashier@12345'),
                'phone'             => '08044444401',
                'staff_id'         => '444401',
                'pin'              => Hash::make('1234'),
                'branch_id'         => $lekki?->id,
                'is_active'         => true,
                'pin_login_enabled' => true,
                'role'              => 'cashier',
            ],
            // Cashier — Ikeja
            [
                'name'              => 'Seun Adeyemi',
                'email'             => 'seun@edlpnigeria.com',
                'password'          => Hash::make('Cashier@12345'),
                'phone'             => '08055555501',
                'staff_id'         => '555501',
                'pin'              => Hash::make('5678'),
                'branch_id'         => $ikeja?->id,
                'is_active'         => true,
                'pin_login_enabled' => true,
                'role'              => 'cashier',
            ],
        ];

        foreach ($users as $data) {
            $role = $data['role'];
            unset($data['role']);

            $user = User::firstOrCreate(['email' => $data['email']], $data);
            // Ensure changes apply even if the user already exists.
            $user->update($data);
            $user->syncRoles([$role]);
        }

        $this->command->info('Users seeded: 1 super-admin, 1 admin, 2 branch-managers, 2 cashiers.');
    }
}
