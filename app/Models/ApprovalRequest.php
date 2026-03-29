<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

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
    ];

    protected $casts = [
        'context_json' => 'array',
        'resolved_at'  => 'datetime',
        'current_stage' => 'integer',
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

    // ── Helpers ────────────────────────────────────────────────────────────────

    public function isPending(): bool   { return $this->status === self::STATUS_PENDING; }
    public function isApproved(): bool  { return $this->status === self::STATUS_APPROVED; }
    public function isRejected(): bool  { return $this->status === self::STATUS_REJECTED; }

    public function currentStageModel(): ?ApprovalStage
    {
        return $this->workflow?->stages->firstWhere('stage_order', $this->current_stage);
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopePending($query)      { return $query->where('status', self::STATUS_PENDING); }
    public function scopeForBranch($query, int $branchId) { return $query->where('branch_id', $branchId); }

    public function scopeEligibleFor($query, User $user)
    {
        // Returns requests where the user can act on the current stage
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
}
