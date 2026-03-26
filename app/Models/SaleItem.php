<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'product_id',
        'product_name',
        'product_sku',
        'quantity',
        'unit_price',
        'cost_price',
        'discount_amount',
        'vat_amount',
        'subtotal',
        'meta',
    ];

    protected $casts = [
        'quantity'        => 'integer',
        'unit_price'      => 'decimal:2',
        'cost_price'      => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'vat_amount'      => 'decimal:2',
        'subtotal'        => 'decimal:2',
        'meta'            => 'array',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function sale(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function getLineTotalAttribute(): float
    {
        return (float) ($this->subtotal + $this->vat_amount - $this->discount_amount);
    }

    public function getGrossProfitAttribute(): float
    {
        return (float) (($this->unit_price - $this->cost_price) * $this->quantity);
    }
}
