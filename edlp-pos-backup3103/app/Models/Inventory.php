<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'branch_id',
        'quantity',
        'reserved_quantity',
        'last_stock_take_at',
        'last_stock_take_quantity',
        'meta',
    ];

    protected $casts = [
        'quantity'                 => 'integer',
        'reserved_quantity'        => 'integer',
        'last_stock_take_at'       => 'datetime',
        'last_stock_take_quantity' => 'integer',
        'meta'                     => 'array',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeLowStock($query)
    {
        return $query->whereHas('product', function ($q) {
            // Inventory table is `inventories` (plural) in our migrations.
            $q->whereColumn('inventories.quantity', '<=', 'products.reorder_level');
        });
    }

    public function scopeOutOfStock($query)
    {
        return $query->where('quantity', '<=', 0);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function getAvailableQuantityAttribute(): int
    {
        return max(0, $this->quantity - $this->reserved_quantity);
    }

    public function getStatusAttribute(): string
    {
        if ($this->quantity <= 0) {
            return 'out';
        }

        if ($this->product && $this->quantity <= $this->product->reorder_level) {
            return 'low';
        }

        return 'ok';
    }

    public function isInStock(): bool
    {
        return $this->quantity > 0;
    }

    public function hasSufficientStock(int $requested): bool
    {
        return $this->available_quantity >= $requested;
    }
}
