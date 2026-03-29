<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductBatch extends Model
{
    use SoftDeletes;

    const STATUS_ACTIVE      = 'active';
    const STATUS_NEAR_EXPIRY = 'near_expiry';
    const STATUS_EXPIRED     = 'expired';
    const STATUS_DISPOSED    = 'disposed';

    protected $fillable = [
        'product_id','branch_id','supplier_id','purchase_order_id',
        'batch_number','manufactured_date','expiry_date',
        'quantity_received','quantity_remaining','cost_per_unit',
        'received_by','status',
    ];

    protected $casts = [
        'manufactured_date'  => 'date',
        'expiry_date'        => 'date',
        'quantity_received'  => 'integer',
        'quantity_remaining' => 'integer',
        'cost_per_unit'      => 'decimal:2',
    ];

    public function product()       { return $this->belongsTo(Product::class); }
    public function branch()        { return $this->belongsTo(Branch::class); }
    public function supplier()      { return $this->belongsTo(Supplier::class); }
    public function purchaseOrder() { return $this->belongsTo(PurchaseOrder::class); }
    public function receivedBy()    { return $this->belongsTo(User::class, 'received_by'); }
    public function disposals()     { return $this->hasMany(ExpiryDisposal::class, 'batch_id'); }

    // ── FEFO scope — earliest expiry first with remaining stock ───────────────
    public function scopeActiveFEFO($query, int $productId, int $branchId)
    {
        return $query->where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->where('status', self::STATUS_ACTIVE)
            ->where('quantity_remaining', '>', 0)
            ->orderBy('expiry_date', 'asc');
    }

    public function scopeNearExpiry($query, int $days = 30)
    {
        return $query->whereIn('status', [self::STATUS_ACTIVE, self::STATUS_NEAR_EXPIRY])
            ->whereBetween('expiry_date', [today(), today()->addDays($days)]);
    }

    public function scopeExpired($query)
    {
        return $query->where('expiry_date', '<', today())
            ->whereNotIn('status', [self::STATUS_DISPOSED]);
    }

    public function isNearExpiry(int $thresholdDays = 30): bool
    {
        return $this->expiry_date->diffInDays(today()) <= $thresholdDays && ! $this->expiry_date->isPast();
    }

    public function daysUntilExpiry(): int
    {
        return max(0, today()->diffInDays($this->expiry_date, false));
    }

    /**
     * FEFO: Get the active batch with the earliest expiry for a product+branch.
     */
    public static function getActiveBatch(int $productId, int $branchId): ?self
    {
        return static::activeFEFO($productId, $branchId)->first();
    }

    /**
     * Deduct from this batch, cascading to the next FEFO batch if exhausted.
     */
    public function deductQuantity(int $qty): void
    {
        $this->decrement('quantity_remaining', $qty);
        if ($this->quantity_remaining <= 0) {
            $this->update(['status' => self::STATUS_DISPOSED]);
        }
    }
}
