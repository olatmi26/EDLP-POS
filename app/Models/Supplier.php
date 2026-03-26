<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'contact_person',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'tax_id',
        'payment_terms',
        'notes',
        'is_active',
        'rating',
        'meta',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'rating'    => 'decimal:2',
        'meta'      => 'array',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function products(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function purchaseOrders(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function getDeliveryPerformanceAttribute(): float
    {
        $total = $this->purchaseOrders()->whereNotNull('received_at')->count();

        if ($total === 0) {
            return 0.0;
        }

        $onTime = $this->purchaseOrders()
            ->whereNotNull('received_at')
            ->whereColumn('received_at', '<=', 'expected_at')
            ->count();

        return round(($onTime / $total) * 100, 2);
    }
}
