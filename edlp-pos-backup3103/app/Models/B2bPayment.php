<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class B2bPayment extends Model
{
    protected $fillable = ['b2b_customer_id','wholesale_order_id','amount','payment_method','reference','notes','recorded_by','paid_at'];
    protected $casts    = ['amount'=>'decimal:2','paid_at'=>'datetime'];

    public function customer()      { return $this->belongsTo(B2bCustomer::class, 'b2b_customer_id'); }
    public function order()         { return $this->belongsTo(WholesaleOrder::class, 'wholesale_order_id'); }
    public function recordedBy()    { return $this->belongsTo(User::class, 'recorded_by'); }
}
