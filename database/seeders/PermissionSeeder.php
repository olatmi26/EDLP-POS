<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Products
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'products.import', 'products.price_update',
            // Inventory
            'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.stock_take',
            // Sales
            'sales.create', 'sales.view', 'sales.void', 'sales.refund',
            // Customers
            'customers.view', 'customers.create', 'customers.edit', 'customers.merge',
            // Reports
            'reports.view', 'reports.export',
            // Users
            'users.view', 'users.create', 'users.edit', 'users.delete',
            // Branches
            'branches.view', 'branches.create', 'branches.edit', 'branches.delete',
            // Expenses
            'expenses.view', 'expenses.create', 'expenses.approve',
            // Purchase Orders
            'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.approve',
            // Settings
            'settings.view', 'settings.edit',
        ];

        // Seed permissions for both 'sanctum' and 'web' guards
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ── Roles on both guards ──────────────────────────────────────────────

        // Super Admin - all permissions, both guards
        $superAdminSanctum = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'sanctum']);
        $superAdminSanctum->givePermissionTo(Permission::where('guard_name', 'sanctum')->get());

        $superAdminWeb = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdminWeb->givePermissionTo(Permission::where('guard_name', 'web')->get());

        // Admin - subset
        $adminSanctum = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'sanctum']);
        $adminSanctum->givePermissionTo([
            'products.view','products.create','products.edit','products.price_update','products.import',
            'inventory.view','inventory.adjust','inventory.transfer','inventory.stock_take',
            'sales.view','sales.create','sales.void','sales.refund',
            'customers.view','customers.create','customers.edit','customers.merge',
            'reports.view','reports.export',
            'users.view','users.create','users.edit',
            'branches.view',
            'expenses.view','expenses.create','expenses.approve',
            'purchase_orders.view','purchase_orders.create','purchase_orders.approve',
        ]);

        $adminWeb = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminWeb->givePermissionTo([
            'products.view','products.create','products.edit','products.price_update','products.import',
            'inventory.view','inventory.adjust','inventory.transfer','inventory.stock_take',
            'sales.view','sales.create','sales.void','sales.refund',
            'customers.view','customers.create','customers.edit','customers.merge',
            'reports.view','reports.export',
            'users.view','users.create','users.edit',
            'branches.view',
            'expenses.view','expenses.create','expenses.approve',
            'purchase_orders.view','purchase_orders.create','purchase_orders.approve',
        ]);

        // Branch Manager
        $managerSanctum = Role::firstOrCreate(['name' => 'branch-manager', 'guard_name' => 'sanctum']);
        $managerSanctum->givePermissionTo([
            'products.view','products.edit','products.price_update',
            'inventory.view','inventory.adjust','inventory.stock_take',
            'sales.view','sales.create','sales.void','sales.refund',
            'customers.view','customers.create','customers.edit',
            'reports.view','reports.export',
            'expenses.view','expenses.create',
            'purchase_orders.view','purchase_orders.create',
        ]);
        $managerWeb = Role::firstOrCreate(['name' => 'branch-manager', 'guard_name' => 'web']);
        $managerWeb->givePermissionTo([
            'products.view','products.edit','products.price_update',
            'inventory.view','inventory.adjust','inventory.stock_take',
            'sales.view','sales.create','sales.void','sales.refund',
            'customers.view','customers.create','customers.edit',
            'reports.view','reports.export',
            'expenses.view','expenses.create',
            'purchase_orders.view','purchase_orders.create',
        ]);

        // Cashier
        $cashierSanctum = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'sanctum']);
        $cashierSanctum->givePermissionTo([
            'products.view',
            'inventory.view',
            'sales.create','sales.view',
            'customers.view','customers.create',
        ]);
        $cashierWeb = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $cashierWeb->givePermissionTo([
            'products.view',
            'inventory.view',
            'sales.create','sales.view',
            'customers.view','customers.create',
        ]);

        $this->command->info('Roles and permissions seeded for both sanctum and web guards.');
    }
}
