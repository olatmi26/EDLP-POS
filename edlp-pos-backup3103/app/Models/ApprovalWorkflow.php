<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * ApprovalWorkflow — Extended with post-approval visibility configuration
 *
 * New fields (added by migration 200001):
 *   post_approval_viewer_roles   — JSON: roles that see the request after approval
 *   post_approval_viewer_users   — JSON: specific user IDs that see the request after approval
 *   requires_payment_processing  — bool: triggers payable accountant workflow + auto-voucher
 *   payment_account_code         — GL debit account (e.g. 'EXP-TRAVEL')
 *   credit_account_code          — GL credit account (default: 'AP-PAYABLE')
 */
class ApprovalWorkflow extends Model
{
    protected $fillable = [
        'name', 'operation_type', 'is_active', 'description',
        'post_approval_viewer_roles', 'post_approval_viewer_users',
        'requires_payment_processing', 'payment_account_code', 'credit_account_code',
    ];

    protected $casts = [
        'is_active'                  => 'boolean',
        'requires_payment_processing'=> 'boolean',
        'post_approval_viewer_roles' => 'array',
        'post_approval_viewer_users' => 'array',
    ];

    const OPERATION_TYPES = [
        'promotion', 'expense', 'purchase_order',
        'stock_movement', 'expiry_disposal', 'wholesale_order', 'bulk_pricing',
        'iou', 'travel_allowance', 'petty_cash',   // additional payment operation types
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function stages(): HasMany
    {
        return $this->hasMany(ApprovalStage::class, 'workflow_id')->orderBy('stage_order');
    }

    public function thresholds(): HasMany
    {
        return $this->hasMany(ApprovalThreshold::class, 'workflow_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class, 'workflow_id');
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForOperation($query, string $operationType)
    {
        return $query->where('operation_type', $operationType);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Check if a given user is a configured post-approval viewer for this workflow.
     */
    public function isPostApprovalViewer(User $user): bool
    {
        $viewerRoles = $this->post_approval_viewer_roles ?? [];
        $viewerUsers = $this->post_approval_viewer_users ?? [];

        if (in_array($user->id, $viewerUsers)) return true;

        foreach ($user->getRoleNames() as $role) {
            if (in_array($role, $viewerRoles)) return true;
        }

        return false;
    }
}
