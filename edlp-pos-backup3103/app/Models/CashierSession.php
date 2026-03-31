<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashierSession extends Model
{
    use HasFactory;

    const STATUS_OPEN   = 'open';
    const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'cashier_id',
        'branch_id',
        'opening_float',
        'closing_cash',
        'expected_cash',
        'variance',
        'status',
        'opened_at',
        'closed_at',
        'notes',
        'closing_notes',
    ];

    protected $casts = [
        'opening_float' => 'decimal:2',
        'closing_cash'  => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'variance'      => 'decimal:2',
        'opened_at'     => 'datetime',
        'closed_at'     => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function cashier(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Sale::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }

    public function getTotalSalesAttribute(): float
    {
        return (float) $this->sales()->completed()->sum('total');
    }

    public function getSaleCountAttribute(): int
    {
        return $this->sales()->completed()->count();
    }

    public function calculateExpectedCash(): float
    {
        $cashSales = $this->sales()
            ->completed()
            ->where('payment_method', Sale::PAYMENT_CASH)
            ->sum('total');

        return (float) ($this->opening_float + $cashSales);
    }
}
