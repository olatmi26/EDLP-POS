<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockMovement extends Model
{
    use SoftDeletes;

    const TYPES = ['sampling','internal_use','staff_welfare','damaged','management_consumption','recalled'];

    const STATUS_PENDING  = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';
    const STATUS_EXECUTED = 'executed';

    protected $fillable = [
        'branch_id','product_id','batch_id','quantity','movement_type',
        'reason','requested_by','executed_by','approval_request_id',
        'status','executed_at','estimated_cost_value',
    ];

    protected $casts = [
        'quantity'             => 'integer',
        'estimated_cost_value' => 'decimal:2',
        'executed_at'          => 'datetime',
    ];

    public function branch()          { return $this->belongsTo(Branch::class); }
    public function product()         { return $this->belongsTo(Product::class); }
    public function batch()           { return $this->belongsTo(ProductBatch::class); }
    public function requestedBy()     { return $this->belongsTo(User::class, 'requested_by'); }
    public function executedBy()      { return $this->belongsTo(User::class, 'executed_by'); }
    public function approvalRequest() { return $this->belongsTo(ApprovalRequest::class); }

    public function isPending(): bool  { return $this->status === self::STATUS_PENDING; }
    public function isExecuted(): bool { return $this->status === self::STATUS_EXECUTED; }

    public function scopeForBranch($q, int $id) { return $q->where('branch_id', $id); }
    public function scopePending($q)            { return $q->where('status', self::STATUS_PENDING); }
}
