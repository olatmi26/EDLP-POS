<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Utilities',                'requires_approval_above' => 50000],
            ['name' => 'Office Supplies',          'requires_approval_above' => 20000],
            ['name' => 'Maintenance & Repair',     'requires_approval_above' => 30000],
            ['name' => 'Staff Welfare',            'requires_approval_above' => null],
            ['name' => 'Transport & Logistics',    'requires_approval_above' => 15000],
            ['name' => 'Cleaning & Sanitation',    'requires_approval_above' => null],
            ['name' => 'Security',                 'requires_approval_above' => 50000],
            ['name' => 'Miscellaneous',            'requires_approval_above' => 10000],

            // Supermarket / Shopping Mall Specific Categories
            ['name' => 'Store Displays & Signage', 'requires_approval_above' => 15000],
            ['name' => 'POS Terminal Fees',        'requires_approval_above' => 10000],
            ['name' => 'In-store Promotions',      'requires_approval_above' => 20000],
            ['name' => 'Stock Shrinkage',          'requires_approval_above' => 25000],
            ['name' => 'Waste Disposal',           'requires_approval_above' => 8000],
            ['name' => 'Packaging Materials',      'requires_approval_above' => 12000],
            ['name' => 'Shopping Cart Maintenance','requires_approval_above' => 7000],
            ['name' => 'Customer Loyalty Programs','requires_approval_above' => 25000],
            ['name' => 'Mall Service Charges',     'requires_approval_above' => 50000],
            ['name' => 'IT & Network Expenses',    'requires_approval_above' => 18000],
            ['name' => 'Utilities - Cold Storage', 'requires_approval_above' => 35000],
            ['name' => 'Bulk Purchasing Costs',    'requires_approval_above' => 30000],
            ['name' => 'Vendor Commissions',       'requires_approval_above' => 15000],
            ['name' => 'Employee Uniforms',        'requires_approval_above' => 10000],
            ['name' => 'Facility Rental',          'requires_approval_above' => 60000],
        ];

        foreach ($categories as $cat) {
            ExpenseCategory::firstOrCreate(
                ['slug' => Str::slug($cat['name'])],
                array_merge($cat, ['is_active' => true])
            );
        }

        $this->command->info('Expense categories seeded.');
    }
}
