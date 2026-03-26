<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class PurchaseOrder extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    const STATUS_DRAFT     = 'draft';
    const STATUS_PENDING   = 'pending';
    const STATUS_APPROVED  = 'approved';
    const STATUS_RECEIVED  = 'received';
    const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'po_number',
        'supplier_id',
        'branch_id',
        'created_by',
        'approved_by',
        'received_by',
        'status',
        'subtotal',
        'tax_amount',
        'total',
        'expected_at',
        'approved_at',
        'received_at',
        'notes',
        'meta',
    ];

    protected $casts = [
        'subtotal'    => 'decimal:2',
        'tax_amount'  => 'decimal:2',
        'total'       => 'decimal:2',
        'expected_at' => 'datetime',
        'approved_at' => 'datetime',
        'received_at' => 'datetime',
        'meta'        => 'array',
    ];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('documents')
            ->acceptsMimeTypes(['application/pdf', 'image/jpeg', 'image/png']);
    }

    public function supplier(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function receivedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeForSupplier($query, int $supplierId)
    {
        return $query->where('supplier_id', $supplierId);
    }

    public static function generatePoNumber(int $branchId): string
    {
        $date     = now()->format('Ymd');
        $sequence = static::whereDate('created_at', today())->count() + 1;
        return 'PO-' . $date . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }

    public function isOnTime(): bool
    {
        if (! $this->received_at || ! $this->expected_at) {
            return false;
        }

        return $this->received_at->lte($this->expected_at);
    }
}
