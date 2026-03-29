<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WholesalePriceTier extends Model
{
    protected $table    = 'wholesale_price_tiers';
    protected $fillable = ['product_id','tier','unit_price','min_quantity'];
    protected $casts    = ['unit_price'=>'decimal:2','min_quantity'=>'integer'];

    public function product() { return $this->belongsTo(Product::class); }

    public static function priceFor(int $productId, string $tier): ?float
    {
        return static::where('product_id', $productId)->where('tier', $tier)->value('unit_price');
    }
}
