<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleHold extends Model
{
    use HasFactory;

    protected $fillable = [
        'hold_reference',
        'branch_id',
        'cashier_id',
        'customer_id',
        'cashier_session_id',
        'cart_data',
        'subtotal',
        'notes',
        'expires_at',
    ];

    protected $casts = [
        'cart_data'  => 'array',
        'subtotal'   => 'decimal:2',
        'expires_at' => 'datetime',
    ];

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function cashier(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function customer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function cashierSession(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(CashierSession::class);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeActive($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
        });
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public static function generateHoldReference(int $branchId): string
    {
        $sequence = static::forBranch($branchId)->whereDate('created_at', today())->count() + 1;
        return 'HLD-' . now()->format('Ymd') . '-' . str_pad($sequence, 3, '0', STR_PAD_LEFT);
    }
}
