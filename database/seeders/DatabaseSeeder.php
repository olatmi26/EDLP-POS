<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,       // roles + permissions (must run first)
            BranchSeeder::class,           // 7 branches
            UserSeeder::class,             // users with roles (depends on branches)
            CategorySeeder::class,         // product categories
            ExpenseCategorySeeder::class,  // expense categories
            ProductSeeder::class,          // 34+ products + inventory rows
        ]);

        $this->command->info('');
        $this->command->info('✓ EDLP POS database seeded successfully.');
        $this->command->info('  Super Admin: admin@edlpnigeria.com / Admin@12345');
        $this->command->info('  Admin:       manager@edlpnigeria.com / Manager@12345');
        $this->command->info('  Branch Mgr:  emeka@edlpnigeria.com / Branch@12345');
        $this->command->info('  Cashier PIN: 08044444401 / 1234  (Lekki branch)');
    }
}
