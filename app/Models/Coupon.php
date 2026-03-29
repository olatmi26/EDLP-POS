<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'promotion_id', 'customer_id',
        'max_uses', 'used_count', 'expires_at', 'is_active',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'is_active'  => 'boolean',
        'used_count' => 'integer',
        'max_uses'   => 'integer',
    ];

    public function promotion()  { return $this->belongsTo(Promotion::class); }
    public function customer()   { return $this->belongsTo(Customer::class); }
    public function uses()       { return $this->hasMany(CouponUse::class); }

    public function isValid(?int $customerId = null): bool
    {
        if (! $this->is_active)                            return false;
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        if ($this->used_count >= $this->max_uses)          return false;
        if ($this->customer_id && $this->customer_id !== $customerId) return false;
        return true;
    }

    public function scopeActive($q)  { return $q->where('is_active', true); }
    public function scopeByCode($q, string $code) { return $q->where('code', strtoupper(trim($code))); }
}
