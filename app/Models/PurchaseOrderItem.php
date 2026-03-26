<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'product_name',
        'quantity_ordered',
        'quantity_received',
        'unit_cost',
        'subtotal',
        'notes',
    ];

    protected $casts = [
        'quantity_ordered'  => 'integer',
        'quantity_received' => 'integer',
        'unit_cost'         => 'decimal:2',
        'subtotal'          => 'decimal:2',
    ];

    public function purchaseOrder(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function getQuantityPendingAttribute(): int
    {
        return max(0, $this->quantity_ordered - $this->quantity_received);
    }
}
