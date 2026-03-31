<?php

namespace Database\Seeders;

use App\Models\Account;
use Illuminate\Database\Seeder;

/**
 * Nigerian Retail Chart of Accounts
 * Standard double-entry COA appropriate for EDLP's supermarket operations.
 * Account codes follow a standard 4-digit scheme aligned with IFRS.
 */
class ChartOfAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            // ── ASSETS (1xxx) ────────────────────────────────────────────────
            ['code'=>'1000','name'=>'Current Assets',            'type'=>'asset','sub_type'=>'current_asset','is_system'=>true],
            ['code'=>'1100','name'=>'Cash on Hand',              'type'=>'asset','sub_type'=>'current_asset','is_system'=>true],
            ['code'=>'CASH-MAIN','name'=>'Main Cash Register',   'type'=>'asset','sub_type'=>'current_asset','is_system'=>true],
            ['code'=>'1200','name'=>'Bank Account (GTBank)',      'type'=>'asset','sub_type'=>'current_asset','is_system'=>false],
            ['code'=>'1210','name'=>'Bank Account (Access)',      'type'=>'asset','sub_type'=>'current_asset','is_system'=>false],
            ['code'=>'1300','name'=>'Accounts Receivable',        'type'=>'asset','sub_type'=>'current_asset','is_system'=>true],
            ['code'=>'1400','name'=>'Inventory Asset',            'type'=>'asset','sub_type'=>'current_asset','is_system'=>true],
            ['code'=>'1500','name'=>'Prepaid Expenses',           'type'=>'asset','sub_type'=>'current_asset','is_system'=>false],
            ['code'=>'1900','name'=>'Fixed Assets',               'type'=>'asset','sub_type'=>'fixed_asset',  'is_system'=>false],

            // ── LIABILITIES (2xxx) ───────────────────────────────────────────
            ['code'=>'2000','name'=>'Current Liabilities',        'type'=>'liability','sub_type'=>'current_liability','is_system'=>true],
            ['code'=>'AP-PAYABLE','name'=>'Accounts Payable',     'type'=>'liability','sub_type'=>'current_liability','is_system'=>true],
            ['code'=>'VAT-PAYABLE','name'=>'VAT Payable (FIRS)',  'type'=>'liability','sub_type'=>'current_liability','is_system'=>true],
            ['code'=>'2100','name'=>'Accrued Expenses',           'type'=>'liability','sub_type'=>'current_liability','is_system'=>false],
            ['code'=>'2200','name'=>'Customer Deposits',          'type'=>'liability','sub_type'=>'current_liability','is_system'=>false],
            ['code'=>'2900','name'=>'Long-Term Liabilities',      'type'=>'liability','sub_type'=>'long_term_liability','is_system'=>false],

            // ── EQUITY (3xxx) ────────────────────────────────────────────────
            ['code'=>'3000','name'=>'Owner\'s Equity',            'type'=>'equity','sub_type'=>'equity','is_system'=>true],
            ['code'=>'3100','name'=>'Retained Earnings',          'type'=>'equity','sub_type'=>'equity','is_system'=>true],

            // ── REVENUE (4xxx) ───────────────────────────────────────────────
            ['code'=>'REV-SALES','name'=>'Retail Sales Revenue',  'type'=>'revenue','sub_type'=>'operating_revenue','is_system'=>true],
            ['code'=>'4100','name'=>'Wholesale Revenue',          'type'=>'revenue','sub_type'=>'operating_revenue','is_system'=>true],
            ['code'=>'4200','name'=>'Other Income',               'type'=>'revenue','sub_type'=>'other_income','is_system'=>false],

            // ── EXPENSES (5xxx) ──────────────────────────────────────────────
            ['code'=>'5000','name'=>'Cost of Goods Sold (COGS)',  'type'=>'expense','sub_type'=>'cogs','is_system'=>true],
            ['code'=>'EXP-SALARY','name'=>'Salaries & Wages',     'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-RENT','name'=>'Rent & Utilities',       'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-TRAVEL','name'=>'Travel & Transport',   'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-IOU','name'=>'Staff Advances / IOU',    'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-MISC','name'=>'Miscellaneous Expenses', 'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-DAMAGE','name'=>'Stock Damage Write-off','type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-EXPIRY','name'=>'Expiry Write-off',     'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-PETTY','name'=>'Petty Cash Expenses',   'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
            ['code'=>'EXP-MKTG','name'=>'Marketing & Promotions', 'type'=>'expense','sub_type'=>'operating_expense','is_system'=>false],
        ];

        foreach ($accounts as $account) {
            Account::firstOrCreate(
                ['code' => $account['code']],
                [
                    'name'      => $account['name'],
                    'type'      => $account['type'],
                    'sub_type'  => $account['sub_type'] ?? null,
                    'is_system' => $account['is_system'],
                    'is_active' => true,
                    'currency'  => 'NGN',
                ]
            );
        }

        $this->command->info('  ✓ Seeded ' . count($accounts) . ' chart of accounts');
    }
}
