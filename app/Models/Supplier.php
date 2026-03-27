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
        'company_name',
        'contact_person',
        'email',
        'phone',
        'phone_alt',
        'address',
        'city',
        'state',
        'outstanding_balance',
        'total_orders',
        'avg_delivery_days',
        'fill_rate',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'outstanding_balance' => 'decimal:2',
        // Laravel's decimal cast expects the scale only (e.g. decimal:2).
        'avg_delivery_days'    => 'decimal:2',
        'fill_rate'            => 'decimal:2',
        'total_orders'         => 'integer',
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
            ->whereColumn('received_at', '<=', 'expected_delivery_date')
            ->count();

        return round(($onTime / $total) * 100, 2);
    }
}
