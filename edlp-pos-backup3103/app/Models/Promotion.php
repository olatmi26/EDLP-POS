<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use SoftDeletes;

    const TYPE_PERCENTAGE = 'percentage_discount';
    const TYPE_FIXED      = 'fixed_discount';
    const TYPE_BXGY       = 'buy_X_get_Y';
    const TYPE_BUNDLE     = 'bundle_price';
    const TYPE_FLASH      = 'flash_sale';

    const STATUS_DRAFT            = 'draft';
    const STATUS_PENDING_APPROVAL = 'pending_approval';
    const STATUS_APPROVED         = 'approved';
    const STATUS_ACTIVE           = 'active';
    const STATUS_PAUSED           = 'paused';
    const STATUS_EXPIRED          = 'expired';

    protected $fillable = [
        'name', 'type', 'value', 'scope',
        'buy_quantity', 'get_quantity',
        'is_stackable', 'priority',
        'start_date', 'end_date', 'usage_limit', 'used_count',
        'status', 'approval_request_id', 'created_by', 'branch_id',
    ];

    protected $casts = [
        'value'        => 'decimal:2',
        'is_stackable' => 'boolean',
        'priority'     => 'integer',
        'used_count'   => 'integer',
        'usage_limit'  => 'integer',
        'start_date'   => 'datetime',
        'end_date'     => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function products()
    {
        return $this->belongsToMany(Product::class, 'promotion_products');
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'promotion_categories');
    }

    public function coupons()
    {
        return $this->hasMany(Coupon::class);
    }

    public function approvalRequest()
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE)
            ->where(fn ($q) => $q->whereNull('start_date')->orWhere('start_date', '<=', now()))
            ->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>=', now()))
            ->where(fn ($q) => $q->whereNull('usage_limit')->orWhereColumn('used_count', '<', 'usage_limit'));
    }

    public function scopeForBranch($query, ?int $branchId)
    {
        return $query->where(fn ($q) => $q->whereNull('branch_id')->orWhere('branch_id', $branchId));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    public function isActive(): bool    { return $this->status === self::STATUS_ACTIVE; }
    public function isExpired(): bool   { return $this->end_date && $this->end_date->isPast(); }
    public function hasUsageLeft(): bool
    {
        return $this->usage_limit === null || $this->used_count < $this->usage_limit;
    }

    /**
     * Calculate the discount amount for a given line item price.
     */
    public function calculateDiscount(float $price, int $quantity = 1): float
    {
        return match ($this->type) {
            self::TYPE_PERCENTAGE => round($price * $quantity * ($this->value / 100), 2),
            self::TYPE_FIXED      => min(round((float) $this->value, 2), $price * $quantity),
            default               => 0.0,
        };
    }
}
