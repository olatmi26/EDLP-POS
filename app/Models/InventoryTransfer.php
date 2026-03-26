<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryTransfer extends Model
{
    use HasFactory;

    const STATUS_PENDING   = 'pending';
    const STATUS_APPROVED  = 'approved';
    const STATUS_COMPLETED = 'completed';
    const STATUS_REJECTED  = 'rejected';

    protected $fillable = [
        'product_id',
        'from_branch_id',
        'to_branch_id',
        'requested_by',
        'approved_by',
        'quantity',
        'status',
        'notes',
        'approved_at',
        'completed_at',
        'rejection_reason',
    ];

    protected $casts = [
        'quantity'     => 'integer',
        'approved_at'  => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function fromBranch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class, 'from_branch_id');
    }

    public function toBranch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class, 'to_branch_id');
    }

    public function requestedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
}
