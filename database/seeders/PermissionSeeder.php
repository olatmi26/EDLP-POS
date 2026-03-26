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

        // Define all permissions for system, including for new roles
        $permissions = [
            // Products
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'products.import', 'products.price_update', 'products.quality_check',
            // Inventory
            'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.stock_take',
            'inventory.approve',
            // Sales
            'sales.create', 'sales.view', 'sales.void', 'sales.refund', 'sales.b2b', 'sales.b2b_approve',
            // Customers
            'customers.view', 'customers.create', 'customers.edit', 'customers.merge', 'customers.b2b_manage',
            // Reports
            'reports.view', 'reports.export', 'reports.finance', 'reports.quality',
            // Users
            'users.view', 'users.create', 'users.edit', 'users.delete',
            // Branches
            'branches.view', 'branches.create', 'branches.edit', 'branches.delete',
            // Expenses
            'expenses.view', 'expenses.create', 'expenses.approve', 'expenses.account',
            // Purchase Orders
            'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.approve',
            // Accounting and Finance
            'accounting.ledger', 'accounting.journal', 'accounting.receive_payment', 'accounting.process_receivable', 'accounting.make_payment', 'accounting.view',
            // Settings
            'settings.view', 'settings.edit',
            // Quality Control
            'quality.view', 'quality.check', 'quality.approve',
            // CEO/Executive
            'ceo.analytics', 'ceo.view_all', 'ceo.finance_approval',
            // Misc/other special permissions
            'b2b.lead_manage', 'b2b.customer_assign', 'b2b.quote_send',
        ];

        // Seed permissions for both 'sanctum' and 'web' guards
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ---------------- Roles Definition and Permission Assignment ------------------

        // ── Helper Role Assignment Closure ──
        $assignPermissions = function(Role $role, array $permissionNames, string $guard) {
            $perms = Permission::whereIn('name', $permissionNames)->where('guard_name', $guard)->get();
            $role->syncPermissions($perms);
        };

        // --- Super Admin - all permissions ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => $guard]);
            $role->syncPermissions(Permission::where('guard_name', $guard)->get());
        }

        // --- CEO / Executive roles ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'ceo', 'guard_name' => $guard]);
            $assignPermissions($role, [
                // Can view all data, analytics, approve important things, view reports
                'products.view', 'products.quality_check',
                'inventory.view',
                'sales.view', 'sales.b2b', 'sales.b2b_approve',
                'customers.view',
                'reports.view', 'reports.export', 'reports.finance', 'reports.quality',
                'users.view',
                'branches.view',
                'expenses.view', 'expenses.approve',
                'purchase_orders.view', 'purchase_orders.approve',
                'accounting.ledger', 'accounting.journal', 'accounting.view', 'accounting.receive_payment',
                'settings.view', 'settings.edit',
                'quality.view', 'quality.approve',
                'ceo.analytics', 'ceo.view_all', 'ceo.finance_approval'
            ], $guard);
        }

        // --- Admin (expanded as before) ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'products.view','products.create','products.edit','products.price_update','products.import','products.delete',
                'inventory.view','inventory.adjust','inventory.transfer','inventory.stock_take','inventory.approve',
                'sales.view','sales.create','sales.void','sales.refund','sales.b2b','sales.b2b_approve',
                'customers.view','customers.create','customers.edit','customers.merge','customers.b2b_manage',
                'reports.view','reports.export','reports.finance','reports.quality',
                'users.view','users.create','users.edit','users.delete',
                'branches.view','branches.create','branches.edit','branches.delete',
                'expenses.view','expenses.create','expenses.approve','expenses.account',
                'purchase_orders.view','purchase_orders.create','purchase_orders.approve',
                'accounting.ledger','accounting.journal','accounting.view','accounting.receive_payment','accounting.process_receivable','accounting.make_payment',
                'settings.view','settings.edit',
                'quality.view','quality.check','quality.approve',
                'ceo.analytics'
            ], $guard);
        }

        // --- Accountant Role ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'accountant', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'expenses.view','expenses.create','expenses.account',
                'purchase_orders.view','purchase_orders.create','purchase_orders.approve',
                'reports.view','reports.finance',
                'accounting.ledger','accounting.journal','accounting.view','accounting.make_payment',
            ], $guard);
        }

        // --- Receivable Accountant Role ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'receivable-accountant', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'sales.view','sales.b2b',
                'customers.view','customers.b2b_manage',
                'reports.view','reports.finance',
                'accounting.receive_payment','accounting.process_receivable','accounting.view',
            ], $guard);
        }

        // --- Quality Control Role ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'quality-control', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'products.view','products.quality_check',
                'inventory.view','inventory.stock_take',
                'quality.view','quality.check','quality.approve',
                'reports.quality',
            ], $guard);
        }

        // --- B2B Sales Representative ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'b2b-sales-rep', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'products.view',
                'sales.create','sales.view','sales.b2b',
                'customers.view','customers.b2b_manage',
                'b2b.lead_manage','b2b.customer_assign','b2b.quote_send',
                'reports.view',
            ], $guard);
        }

        // --- Branch Manager ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'branch-manager', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'products.view','products.edit','products.price_update',
                'inventory.view','inventory.adjust','inventory.stock_take',
                'sales.view','sales.create','sales.void','sales.refund',
                'customers.view','customers.create','customers.edit',
                'reports.view','reports.export',
                'expenses.view','expenses.create',
                'purchase_orders.view','purchase_orders.create',
            ], $guard);
        }

        // --- Cashier ---
        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => $guard]);
            $assignPermissions($role, [
                'products.view',
                'inventory.view',
                'sales.create','sales.view',
                'customers.view','customers.create',
            ], $guard);
        }

        // --- Add more custom roles as needed below following the pattern above ---

        $this->command->info('Roles and permissions (including CEO, Quality Control, Accountant, Receivable Accountant, B2B Sales Rep) seeded for both sanctum and web guards.');
    }
}
