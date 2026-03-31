<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ApprovalRequest — Extended with post-approval visibility + payment tracking
 *
 * New fields (added by migration 200001):
 *   voucher_posted_at      — when accounting voucher was auto-posted
 *   etax_submitted_at      — when FIRS submission was made
 *   payment_processed_at   — when payable accountant confirmed payment
 *   payment_processed_by   — FK to user who processed payment
 *   payment_reference      — bank ref / cheque number
 *   payment_notes          — accountant's notes
 */
class ApprovalRequest extends Model
{
    use SoftDeletes;

    const STATUS_PENDING   = 'pending';
    const STATUS_APPROVED  = 'approved';
    const STATUS_REJECTED  = 'rejected';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_TIMED_OUT = 'timed_out';

    protected $fillable = [
        'workflow_id', 'operation_type', 'operation_id',
        'current_stage', 'status', 'requested_by', 'branch_id',
        'context_json', 'rejection_reason', 'resolved_at',
        // Payment processing fields
        'voucher_posted_at', 'etax_submitted_at',
        'payment_processed_at', 'payment_processed_by',
        'payment_reference', 'payment_notes',
    ];

    protected $casts = [
        'context_json'        => 'array',
        'resolved_at'         => 'datetime',
        'voucher_posted_at'   => 'datetime',
        'etax_submitted_at'   => 'datetime',
        'payment_processed_at'=> 'datetime',
        'current_stage'       => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function workflow()
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id')->with('stages');
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function decisions()
    {
        return $this->hasMany(ApprovalDecision::class, 'request_id')->latest();
    }

    public function paymentProcessor()
    {
        return $this->belongsTo(User::class, 'payment_processed_by');
    }

    public function journalEntries()
    {
        return $this->hasMany(JournalEntry::class);
    }

    public function etaxSubmission()
    {
        return $this->hasOne(EtaxSubmission::class, 'source_id')
            ->where('source_type', 'approval_request');
    }

    // ── Status helpers ─────────────────────────────────────────────────────────

    public function isPending(): bool          { return $this->status === self::STATUS_PENDING; }
    public function isApproved(): bool         { return $this->status === self::STATUS_APPROVED; }
    public function isRejected(): bool         { return $this->status === self::STATUS_REJECTED; }
    public function isPaymentPending(): bool   { return $this->isApproved() && $this->workflow?->requires_payment_processing && ! $this->payment_processed_at; }
    public function isFullyProcessed(): bool   { return $this->isApproved() && (! $this->workflow?->requires_payment_processing || $this->payment_processed_at); }

    public function currentStageModel(): ?ApprovalStage
    {
        return $this->workflow?->stages->firstWhere('stage_order', $this->current_stage);
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopePending($query)      { return $query->where('status', self::STATUS_PENDING); }
    public function scopeApproved($query)     { return $query->where('status', self::STATUS_APPROVED); }
    public function scopeForBranch($query, int $branchId) { return $query->where('branch_id', $branchId); }

    /**
     * Requests the user can act on as an APPROVER (pending stage matches their role).
     */
    public function scopeEligibleFor($query, User $user)
    {
        return $query->pending()->whereHas('workflow.stages', function ($q) use ($user) {
            $q->whereColumn('stage_order', 'approval_requests.current_stage')
              ->where(function ($inner) use ($user) {
                  $inner->where(function ($byRole) use ($user) {
                      $byRole->whereIn('approver_type', ['role', 'any_of_role'])
                             ->whereIn('approver_role', $user->getRoleNames());
                  })->orWhere('approver_user_id', $user->id);
              });
        });
    }

    /**
     * POST-APPROVAL VISIBILITY:
     * Approved requests that the user can READ even though they were not an approver.
     *
     * A user gains read access to an approved request if:
     *  (a) Their role is in workflow.post_approval_viewer_roles  OR
     *  (b) Their user ID is in workflow.post_approval_viewer_users  OR
     *  (c) They are the original requester  OR
     *  (d) They are a super-admin or admin
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuperAdmin() || $user->isAdmin()) {
            return $query; // Full access
        }

        $userRoles = $user->getRoleNames()->toArray();

        return $query->where(function ($q) use ($user, $userRoles) {
            // Requester always sees their own requests
            $q->where('requested_by', $user->id)

            // Eligible approver can see requests they can act on
            ->orWhereHas('workflow.stages', function ($s) use ($user, $userRoles) {
                $s->whereColumn('stage_order', 'approval_requests.current_stage')
                  ->where(function ($inner) use ($user, $userRoles) {
                      $inner->whereIn('approver_role', $userRoles)
                            ->orWhere('approver_user_id', $user->id);
                  });
            })

            // Post-approval viewer via workflow configuration
            ->orWhereHas('workflow', function ($w) use ($user, $userRoles) {
                $w->where(function ($viewerCheck) use ($user, $userRoles) {
                    // Role-based viewer: user's role is in post_approval_viewer_roles JSON array
                    foreach ($userRoles as $role) {
                        $viewerCheck->orWhereJsonContains('post_approval_viewer_roles', $role);
                    }
                    // User-specific viewer: user's ID is in post_approval_viewer_users JSON array
                    $viewerCheck->orWhereJsonContains('post_approval_viewer_users', $user->id);
                });
            });
        });
    }

    /**
     * Approved requests awaiting payment processing — specifically for payable accountants.
     */
    public function scopeAwaitingPayment($query)
    {
        return $query->approved()
            ->whereHas('workflow', fn ($q) => $q->where('requires_payment_processing', true))
            ->whereNull('payment_processed_at');
    }
}
