<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sale extends Model
{
    use HasFactory, SoftDeletes;

    // Sale statuses
    const STATUS_COMPLETED = 'completed';
    const STATUS_VOIDED    = 'voided';
    const STATUS_REFUNDED  = 'refunded';
    const STATUS_HELD      = 'held';

    // Payment methods
    const PAYMENT_CASH        = 'cash';
    const PAYMENT_OPAY        = 'opay_pos';
    const PAYMENT_MONIEPOINT  = 'moniepoint_pos';
    const PAYMENT_BANK_TRANSFER = 'bank_transfer';
    const PAYMENT_SPLIT       = 'split';

    protected $fillable = [
        'receipt_number',
        'branch_id',
        'cashier_id',
        'customer_id',
        'cashier_session_id',
        'subtotal',
        'discount_amount',
        'discount_type',
        'discount_value',
        'vat_amount',
        'total',
        'amount_tendered',
        'change_given',
        'payment_method',
        'payment_details',
        'status',
        'notes',
        'voided_by',
        'voided_at',
        'void_reason',
        'synced_at',
        'local_id',
    ];

    protected $casts = [
        'subtotal'        => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'discount_value'  => 'decimal:2',
        'vat_amount'      => 'decimal:2',
        'total'           => 'decimal:2',
        'amount_tendered' => 'decimal:2',
        'change_given'    => 'decimal:2',
        'payment_details' => 'array',
        'voided_at'       => 'datetime',
        'synced_at'       => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

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

    public function items(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function voidedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeForCashier($query, int $cashierId)
    {
        return $query->where('cashier_id', $cashierId);
    }

    public function scopeDateRange($query, string $from, string $to)
    {
        return $query->whereBetween('created_at', [$from, $to]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isVoidable(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isRefundable(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_REFUNDED]);
    }

    public static function generateReceiptNumber(int $branchId): string
    {
        $branch   = Branch::find($branchId);
        $code     = strtoupper($branch?->code ?? 'BR' . str_pad($branchId, 2, '0', STR_PAD_LEFT));
        $date     = now()->format('Ymd');
        $sequence = static::forBranch($branchId)
            ->whereDate('created_at', today())
            ->count() + 1;

        return "{$code}-{$date}-" . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
