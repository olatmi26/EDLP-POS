<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class B2bCustomer extends Model
{
    use SoftDeletes;

    protected $table = 'b2b_customers';

    protected $fillable = [
        'business_name', 'cac_number', 'contact_person', 'email', 'phone', 'address',
        'tier', 'credit_limit', 'outstanding_balance', 'payment_terms',
        'is_active', 'on_credit_hold', 'assigned_to', 'approval_request_id',
    ];

    protected $casts = [
        'credit_limit'        => 'decimal:2',
        'outstanding_balance' => 'decimal:2',
        'is_active'           => 'boolean',
        'on_credit_hold'      => 'boolean',
    ];

    const TIERS = ['gold', 'silver', 'bronze'];
    const PAYMENT_TERMS = ['net30', 'net60', 'cod'];

    public function orders()         { return $this->hasMany(WholesaleOrder::class); }
    public function payments()       { return $this->hasMany(B2bPayment::class); }
    public function assignedTo()     { return $this->belongsTo(User::class, 'assigned_to'); }
    public function approvalRequest(){ return $this->belongsTo(ApprovalRequest::class); }

    public function availableCredit(): float
    {
        return max(0, (float)$this->credit_limit - (float)$this->outstanding_balance);
    }

    public function isOverCreditLimit(): bool
    {
        return $this->outstanding_balance >= $this->credit_limit && $this->credit_limit > 0;
    }

    public function scopeActive($q)           { return $q->where('is_active', true); }
    public function scopeByTier($q, string $t){ return $q->where('tier', $t); }
    public function scopeNotOnHold($q)        { return $q->where('on_credit_hold', false); }
}
