<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\ApprovalStage;
use App\Models\ApprovalThreshold;
use Illuminate\Database\Seeder;

class ApprovalWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedWorkflow(
            name: 'Promotion Approval',
            type: 'promotion',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager Review','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin Approval','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>48,'timeout_action'=>'auto_reject'],
            ]
        );

        $this->seedWorkflow(
            name: 'Expense Approval (Standard)',
            type: 'expense',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'escalate'],
            ]
        );

        $this->seedWorkflow(
            name: 'Expense Approval (High Value)',
            type: 'expense',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>12,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin Sign-off','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'auto_reject'],
            ],
            thresholds: [
                ['field'=>'amount','operator'=>'>=','threshold_value'=>50000], // ≥₦50,000 escalates to this workflow
            ]
        );

        $this->seedWorkflow(
            name: 'Purchase Order Approval',
            type: 'purchase_order',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin (Large Orders)','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>48,'timeout_action'=>'auto_reject'],
            ],
            thresholds: [
                ['field'=>'total_amount','operator'=>'>=','threshold_value'=>200000], // ≥₦200,000 requires both stages
            ]
        );

        $this->seedWorkflow(
            name: 'Stock Movement Approval',
            type: 'stock_movement',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>48,'timeout_action'=>'escalate'],
            ]
        );

        $this->seedWorkflow(
            name: 'Stock Movement Approval (Large Quantity)',
            type: 'stock_movement',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin Review','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>48,'timeout_action'=>'auto_reject'],
            ],
            thresholds: [
                ['field'=>'quantity','operator'=>'>=','threshold_value'=>10], // ≥10 units escalates
            ]
        );

        $this->seedWorkflow(
            name: 'Expiry Disposal Approval',
            type: 'expiry_disposal',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Branch Manager','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>12,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin (High Value Write-off)','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'auto_reject'],
            ],
            thresholds: [
                ['field'=>'write_off_value','operator'=>'>=','threshold_value'=>10000], // ≥₦10k write-off requires admin
            ]
        );

        $this->seedWorkflow(
            name: 'Wholesale Order Approval',
            type: 'wholesale_order',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Sales Manager Review','approver_type'=>'role','approver_role'=>'branch-manager','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'escalate'],
                ['stage_order'=>2,'stage_name'=>'Admin Approval','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>48,'timeout_action'=>'auto_reject'],
            ]
        );

        $this->seedWorkflow(
            name: 'Bulk Pricing Approval',
            type: 'bulk_pricing',
            stages: [
                ['stage_order'=>1,'stage_name'=>'Admin Approval','approver_type'=>'role','approver_role'=>'admin','min_approvers'=>1,'timeout_hours'=>24,'timeout_action'=>'auto_reject'],
            ]
        );
    }

    private function seedWorkflow(string $name, string $type, array $stages, array $thresholds = []): void
    {
        // Skip if already seeded (idempotent)
        if (ApprovalWorkflow::where('name', $name)->exists()) return;

        $workflow = ApprovalWorkflow::create([
            'name'           => $name,
            'operation_type' => $type,
            'is_active'      => true,
            'description'    => "Default {$type} workflow — fully configurable via Settings → Approval Workflows.",
        ]);

        foreach ($stages as $stage) {
            $workflow->stages()->create($stage);
        }

        foreach ($thresholds as $threshold) {
            $workflow->thresholds()->create($threshold);
        }

        $this->command->info("  ✓ Seeded workflow: {$name}");
    }
}
