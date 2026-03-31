<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiPurchaseHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'product_id',
        'branch_id',
        'frequency',
        'last_purchased_at',
        'total_quantity',
        'total_spend',
    ];

    protected $casts = [
        'frequency'         => 'integer',
        'total_quantity'    => 'integer',
        'total_spend'       => 'decimal:2',
        'last_purchased_at' => 'datetime',
    ];

    public function customer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function scopeForCustomer($query, int $customerId)
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeTopProducts($query, int $limit = 10)
    {
        return $query->orderByDesc('frequency')->limit($limit);
    }
}
