<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CouponUse extends Model
{
    protected $fillable = ['coupon_id', 'sale_id', 'discount_applied', 'used_at'];
    protected $casts    = ['discount_applied' => 'decimal:2', 'used_at' => 'datetime'];

    public function coupon() { return $this->belongsTo(Coupon::class); }
    public function sale()   { return $this->belongsTo(Sale::class); }
}
