<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use Illuminate\Database\Seeder;

/**
 * REPLACES the original ApprovalWorkflowSeeder.
 * Now includes:
 *   - post_approval_viewer_roles: accountants see approved payment requests
 *   - requires_payment_processing: triggers voucher posting + accountant payment queue
 *   - payment_account_code: GL debit account for auto-voucher
 *   - iou, travel_allowance, petty_cash operation types added
 */
class ApprovalWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        // ── Promotion ─────────────────────────────────────────────────────────
        $this->seed(
            name: 'Promotion Approval',
            type: 'promotion',
            stages: [
                $this->stage(1, 'Branch Manager Review', 'branch-manager'),
                $this->stage(2, 'Admin Approval', 'admin', 48, 'auto_reject'),
            ],
        );

        // ── Expense (Standard — under ₦50k) ───────────────────────────────────
        $this->seed(
            name: 'Expense Approval (Standard)',
            type: 'expense',
            viewerRoles: ['accountant', 'receivable-accountant'],
            requiresPayment: true,
            paymentAccount: 'EXP-MISC',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 24, 'escalate'),
            ],
        );

        // ── Expense (High Value — ₦50k+) ─────────────────────────────────────
        $this->seed(
            name: 'Expense Approval (High Value ≥₦50k)',
            type: 'expense',
            viewerRoles: ['accountant', 'receivable-accountant'],
            requiresPayment: true,
            paymentAccount: 'EXP-MISC',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 12, 'escalate'),
                $this->stage(2, 'Admin Sign-off', 'admin', 24, 'auto_reject'),
            ],
            thresholds: [['field'=>'amount','operator'=>'>=','threshold_value'=>50000]],
        );

        // ── IOU / Staff Advance ───────────────────────────────────────────────
        $this->seed(
            name: 'IOU / Staff Advance Approval',
            type: 'iou',
            viewerRoles: ['accountant', 'receivable-accountant'],
            requiresPayment: true,
            paymentAccount: 'EXP-IOU',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 24, 'escalate'),
                $this->stage(2, 'Admin Approval', 'admin', 48, 'auto_reject'),
            ],
        );

        // ── Travel Allowance ──────────────────────────────────────────────────
        $this->seed(
            name: 'Travel Allowance Approval',
            type: 'travel_allowance',
            viewerRoles: ['accountant'],
            requiresPayment: true,
            paymentAccount: 'EXP-TRAVEL',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 24, 'escalate'),
                $this->stage(2, 'Admin Approval', 'admin', 48, 'auto_reject'),
            ],
        );

        // ── Petty Cash ────────────────────────────────────────────────────────
        $this->seed(
            name: 'Petty Cash Approval',
            type: 'petty_cash',
            viewerRoles: ['accountant'],
            requiresPayment: true,
            paymentAccount: 'EXP-PETTY',
            creditAccount: 'CASH-MAIN',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 12, 'escalate'),
            ],
        );

        // ── Purchase Order ────────────────────────────────────────────────────
        $this->seed(
            name: 'Purchase Order Approval',
            type: 'purchase_order',
            viewerRoles: ['accountant'],
            requiresPayment: true,
            paymentAccount: '5000', // COGS
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 24, 'escalate'),
                $this->stage(2, 'Admin (Large Orders)', 'admin', 48, 'auto_reject'),
            ],
            thresholds: [['field'=>'total_amount','operator'=>'>=','threshold_value'=>200000]],
        );

        // ── Stock Movement (Standard) ─────────────────────────────────────────
        $this->seed(
            name: 'Stock Movement Approval',
            type: 'stock_movement',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 48, 'escalate'),
            ],
        );

        // ── Stock Movement (Large Qty ≥10) ────────────────────────────────────
        $this->seed(
            name: 'Stock Movement Approval (Large Quantity ≥10)',
            type: 'stock_movement',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 24, 'escalate'),
                $this->stage(2, 'Admin Review', 'admin', 48, 'auto_reject'),
            ],
            thresholds: [['field'=>'quantity','operator'=>'>=','threshold_value'=>10]],
        );

        // ── Expiry Disposal ───────────────────────────────────────────────────
        $this->seed(
            name: 'Expiry Disposal Approval',
            type: 'expiry_disposal',
            viewerRoles: ['accountant'],
            requiresPayment: false,
            paymentAccount: 'EXP-EXPIRY',
            stages: [
                $this->stage(1, 'Branch Manager', 'branch-manager', 12, 'escalate'),
                $this->stage(2, 'Admin (High Value Write-off)', 'admin', 24, 'auto_reject'),
            ],
            thresholds: [['field'=>'write_off_value','operator'=>'>=','threshold_value'=>10000]],
        );

        // ── Wholesale Order ───────────────────────────────────────────────────
        $this->seed(
            name: 'Wholesale Order Approval',
            type: 'wholesale_order',
            viewerRoles: ['accountant', 'receivable-accountant'],
            stages: [
                $this->stage(1, 'Sales Manager Review', 'branch-manager', 24, 'escalate'),
                $this->stage(2, 'Admin Approval', 'admin', 48, 'auto_reject'),
            ],
        );

        // ── Bulk Pricing ──────────────────────────────────────────────────────
        $this->seed(
            name: 'Bulk Pricing Approval',
            type: 'bulk_pricing',
            stages: [
                $this->stage(1, 'Admin Approval', 'admin', 24, 'auto_reject'),
            ],
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function seed(
        string  $name,
        string  $type,
        array   $stages,
        array   $viewerRoles   = [],
        bool    $requiresPayment = false,
        string  $paymentAccount = 'EXP-MISC',
        string  $creditAccount  = 'AP-PAYABLE',
        array   $thresholds    = [],
    ): void {
        if (ApprovalWorkflow::where('name', $name)->exists()) {
            $this->command->line("  ↷ Skipping (exists): {$name}");
            return;
        }

        $workflow = ApprovalWorkflow::create([
            'name'                       => $name,
            'operation_type'             => $type,
            'is_active'                  => true,
            'description'                => "Default {$type} workflow — configurable via Settings → Approval Workflows.",
            'post_approval_viewer_roles' => $viewerRoles ?: null,
            'post_approval_viewer_users' => null,
            'requires_payment_processing'=> $requiresPayment,
            'payment_account_code'       => $requiresPayment ? $paymentAccount : null,
            'credit_account_code'        => $requiresPayment ? $creditAccount : null,
        ]);

        foreach ($stages as $stage) {
            $workflow->stages()->create($stage);
        }

        foreach ($thresholds as $threshold) {
            $workflow->thresholds()->create($threshold);
        }

        $this->command->info("  ✓ Seeded: {$name}" . ($requiresPayment ? ' [payment workflow]' : ''));
    }

    private function stage(
        int    $order,
        string $name,
        string $role,
        int    $timeoutHours  = 48,
        string $timeoutAction = 'escalate',
    ): array {
        return [
            'stage_order'    => $order,
            'stage_name'     => $name,
            'approver_type'  => 'role',
            'approver_role'  => $role,
            'min_approvers'  => 1,
            'timeout_hours'  => $timeoutHours,
            'timeout_action' => $timeoutAction,
        ];
    }
}
