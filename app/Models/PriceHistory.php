<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PriceHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'changed_by',
        'old_price',
        'new_price',
        'change_type',
        'change_reason',
        'effective_at',
    ];

    protected $casts = [
        'old_price'    => 'decimal:2',
        'new_price'    => 'decimal:2',
        'effective_at' => 'datetime',
    ];

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function changedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    public function getPriceChangePctAttribute(): float
    {
        if ((float) $this->old_price === 0.0) {
            return 0.0;
        }

        return round((($this->new_price - $this->old_price) / $this->old_price) * 100, 2);
    }
}
