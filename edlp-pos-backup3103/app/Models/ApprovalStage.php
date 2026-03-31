<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalStage extends Model
{
    protected $fillable = [
        'workflow_id', 'stage_order', 'stage_name',
        'approver_type', 'approver_role', 'approver_user_id',
        'min_approvers', 'timeout_hours', 'timeout_action',
    ];

    protected $casts = [
        'stage_order'   => 'integer',
        'min_approvers' => 'integer',
        'timeout_hours' => 'integer',
    ];

    public function workflow()
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id');
    }

    public function approverUser()
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }

    public function decisions()
    {
        return $this->hasMany(ApprovalDecision::class, 'stage_id');
    }

    /**
     * Check if a given user is eligible to approve this stage.
     */
    public function canBeApprovedBy(User $user): bool
    {
        return match ($this->approver_type) {
            'role'        => $user->hasRole($this->approver_role),
            'user'        => $user->id === $this->approver_user_id,
            'any_of_role' => $user->hasRole($this->approver_role),
            default       => false,
        };
    }
}
