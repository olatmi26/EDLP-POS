<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'branch_id',
        'visit_count',
        'total_spend',
        'last_visit_at',
        'customer_preferences',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'visit_count'            => 'integer',
        'total_spend'            => 'decimal:2',
        'last_visit_at'          => 'datetime',
        'customer_preferences'   => 'array',
        'is_active'              => 'boolean',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function aiPurchaseHistory(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AiPurchaseHistory::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('name', 'LIKE', "%{$term}%")
              ->orWhere('phone', 'LIKE', "%{$term}%")
              ->orWhere('email', 'LIKE', "%{$term}%");
        });
    }

    public function scopeFrequent($query, int $minVisits = 5)
    {
        return $query->where('visit_count', '>=', $minVisits);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function getFavouriteProductAttribute(): ?Product
    {
        $prefs = $this->customer_preferences;

        if (empty($prefs['top_products'][0])) {
            return null;
        }

        return Product::find($prefs['top_products'][0]);
    }

    public function getRankAttribute(): string
    {
        if ($this->total_spend >= 500000) {
            return 'gold';
        }

        if ($this->total_spend >= 100000) {
            return 'silver';
        }

        return 'bronze';
    }

    public function incrementVisit(float $saleTotal): void
    {
        $this->increment('visit_count');
        $this->increment('total_spend', $saleTotal);
        $this->update(['last_visit_at' => now()]);
    }
}
