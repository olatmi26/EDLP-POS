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
                'is_active'         => true,
                'pin_login_enabled' => false,
                'role'              => 'admin',
            ],
            // Branch Manager — Lekki
            [
                'name'              => 'Emeka Okafor',
                'email'             => 'emeka@edlpnigeria.com',
                'password'          => Hash::make('Branch@12345'),
                'phone'             => '08022222201',
                'branch_id'         => $lekki?->id,
                'is_active'         => true,
                'pin_login_enabled' => false,
                'role'              => 'branch-manager',
            ],
            // Branch Manager — VI
            [
                'name'              => 'Chioma Eze',
                'email'             => 'chioma@edlpnigeria.com',
                'password'          => Hash::make('Branch@12345'),
                'phone'             => '08033333301',
                'branch_id'         => $vi?->id,
                'is_active'         => true,
                'pin_login_enabled' => false,
                'role'              => 'branch-manager',
            ],
            // Cashier — Lekki
            [
                'name'              => 'Fatima Abdullahi',
                'email'             => 'fatima@edlpnigeria.com',
                'password'          => Hash::make('Cashier@12345'),
                'phone'             => '08044444401',
                'pin'               => Hash::make('123456'),
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
                'pin'               => Hash::make('567890'),
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
            $user->syncRoles([$role]);
        }

        $this->command->info('Users seeded: 1 super-admin, 1 admin, 2 branch-managers, 2 cashiers.');
    }
}
