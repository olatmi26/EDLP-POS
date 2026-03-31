<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SyncLog extends Model
{
    use HasFactory;

    const STATUS_PENDING   = 'pending';
    const STATUS_SYNCED    = 'synced';
    const STATUS_FAILED    = 'failed';
    const STATUS_CONFLICT  = 'conflict';

    protected $fillable = [
        'branch_id',
        'model_type',
        'model_id',
        'local_id',
        'action',
        'payload',
        'status',
        'attempt_count',
        'last_error',
        'synced_at',
    ];

    protected $casts = [
        'payload'       => 'array',
        'attempt_count' => 'integer',
        'synced_at'     => 'datetime',
    ];

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function markSynced(): void
    {
        $this->update(['status' => self::STATUS_SYNCED, 'synced_at' => now()]);
    }

    public function markFailed(string $error): void
    {
        $this->increment('attempt_count');
        $this->update(['status' => self::STATUS_FAILED, 'last_error' => $error]);
    }
}
