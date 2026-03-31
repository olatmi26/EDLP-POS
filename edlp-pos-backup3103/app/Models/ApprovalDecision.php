<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalDecision extends Model
{
    protected $fillable = [
        'request_id', 'stage_id', 'decided_by', 'decision', 'comment', 'decided_at',
    ];

    protected $casts = ['decided_at' => 'datetime'];

    public function request()  { return $this->belongsTo(ApprovalRequest::class, 'request_id'); }
    public function stage()    { return $this->belongsTo(ApprovalStage::class, 'stage_id'); }
    public function decider()  { return $this->belongsTo(User::class, 'decided_by'); }

    public function isApproval(): bool { return $this->decision === 'approved'; }
    public function isRejection(): bool { return $this->decision === 'rejected'; }
}
