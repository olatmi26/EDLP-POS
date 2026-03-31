<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WholesaleOrder extends Model
{
    use SoftDeletes;

    const STATUS_DRAFT      = 'draft';
    const STATUS_CONFIRMED  = 'confirmed';
    const STATUS_PICKING    = 'picking';
    const STATUS_DISPATCHED = 'dispatched';
    const STATUS_DELIVERED  = 'delivered';
    const STATUS_INVOICED   = 'invoiced';
    const STATUS_CANCELLED  = 'cancelled';

    const PAYMENT_UNPAID  = 'unpaid';
    const PAYMENT_PARTIAL = 'partial';
    const PAYMENT_PAID    = 'paid';
    const PAYMENT_OVERDUE = 'overdue';

    protected $fillable = [
        'order_number', 'b2b_customer_id', 'branch_id', 'created_by', 'approved_by',
        'status', 'subtotal', 'tax_amount', 'total', 'payment_status', 'due_date',
        'notes', 'delivery_address', 'approval_request_id',
        'dispatched_at', 'delivered_at', 'invoiced_at',
    ];

    protected $casts = [
        'subtotal'       => 'decimal:2',
        'tax_amount'     => 'decimal:2',
        'total'          => 'decimal:2',
        'due_date'       => 'date',
        'dispatched_at'  => 'datetime',
        'delivered_at'   => 'datetime',
        'invoiced_at'    => 'datetime',
    ];

    public function customer()        { return $this->belongsTo(B2bCustomer::class, 'b2b_customer_id'); }
    public function branch()          { return $this->belongsTo(Branch::class); }
    public function createdBy()       { return $this->belongsTo(User::class, 'created_by'); }
    public function approvedBy()      { return $this->belongsTo(User::class, 'approved_by'); }
    public function items()           { return $this->hasMany(WholesaleOrderItem::class); }
    public function approvalRequest() { return $this->belongsTo(ApprovalRequest::class); }
    public function payments()        { return $this->hasMany(B2bPayment::class); }

    public function isPending(): bool    { return $this->status === self::STATUS_DRAFT; }
    public function isInvoiced(): bool   { return $this->status === self::STATUS_INVOICED; }

    public static function generateOrderNumber(int $branchId): string
    {
        $date = now()->format('Ymd');
        $seq  = static::where('branch_id', $branchId)->whereDate('created_at', today())->count() + 1;
        return 'WO-' . str_pad($branchId, 2, '0', STR_PAD_LEFT) . '-' . $date . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    public function scopeForBranch($q, int $branchId) { return $q->where('branch_id', $branchId); }
    public function scopeOverdue($q)
    {
        return $q->where('payment_status', self::PAYMENT_UNPAID)
                 ->where('due_date', '<', today())
                 ->where('status', self::STATUS_INVOICED);
    }
}
