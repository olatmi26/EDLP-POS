<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WholesaleOrderItem extends Model
{
    protected $fillable = ['wholesale_order_id','product_id','quantity','unit_price','line_total','tier_applied'];
    protected $casts    = ['unit_price'=>'decimal:2','line_total'=>'decimal:2','quantity'=>'integer'];

    public function order()   { return $this->belongsTo(WholesaleOrder::class, 'wholesale_order_id'); }
    public function product() { return $this->belongsTo(Product::class); }
}
