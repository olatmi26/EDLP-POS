<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;


class Product extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    protected $fillable = [
        'name',
        'sku',
        'barcode',
        'description',
        'category_id',
        'supplier_id',
        'cost_price',
        'selling_price',
        'unit',
        'reorder_level',
        'is_active',
        'is_vat_exempt',
        'vat_rate',
        'weight',
        'meta',
        'slug'
    ];

    protected $casts = [
        'cost_price'    => 'decimal:2',
        'selling_price' => 'decimal:2',
        'reorder_level' => 'integer',
        'is_active'     => 'boolean',
        'is_vat_exempt' => 'boolean',
        'vat_rate'      => 'decimal:2',
        'weight'        => 'decimal:3',
        'meta'          => 'array',
    ];

    protected static function booted()
    {
        static::saving(function ($product) {
            if (empty($product->slug) && !empty($product->name)) {
                $product->slug = Str::slug($product->name);
            }
        });
    }

    // ── Media ─────────────────────────────────────────────────────────────────

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function category(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function inventory(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function saleItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function priceHistory(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PriceHistory::class);
    }

    public function purchaseOrderItems(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
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
              ->orWhere('sku', 'LIKE', "%{$term}%")
              ->orWhere('barcode', 'LIKE', "%{$term}%")
              ->orWhere('description', 'LIKE', "%{$term}%");
        });
    }

    public function scopeForCategory($query, int $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    public function scopeForSupplier($query, int $supplierId)
    {
        return $query->where('supplier_id', $supplierId);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('images') ?: null;
    }

    public function getEffectiveVatRateAttribute(): float
    {
        return $this->is_vat_exempt ? 0.0 : (float) ($this->vat_rate ?? config('pos.vat_rate', 7.5));
    }

    public function getStockForBranchAttribute(): ?int
    {
        // Used after eager loading inventory for a specific branch
        return $this->inventory->first()?->quantity;
    }
}
