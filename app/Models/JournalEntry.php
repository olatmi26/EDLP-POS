<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class JournalEntry extends Model
{
    use SoftDeletes;

    const TYPE_PAYMENT  = 'payment';
    const TYPE_RECEIPT  = 'receipt';
    const TYPE_JOURNAL  = 'journal';
    const TYPE_EXPENSE  = 'expense';
    const TYPE_SALES    = 'sales';
    const TYPE_PURCHASE = 'purchase';

    const STATUS_DRAFT    = 'draft';
    const STATUS_POSTED   = 'posted';
    const STATUS_REVERSED = 'reversed';

    protected $fillable = [
        'voucher_number','reference','type','description','total_amount',
        'entry_date','status','created_by','approved_by','branch_id',
        'approval_request_id','source_type','source_id',
        'posted_at','reversed_at','reversed_by','reversal_reason',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'entry_date'   => 'date',
        'posted_at'    => 'datetime',
        'reversed_at'  => 'datetime',
    ];

    public function lines()           { return $this->hasMany(JournalLine::class); }
    public function branch()          { return $this->belongsTo(Branch::class); }
    public function createdBy()       { return $this->belongsTo(User::class, 'created_by'); }
    public function approvedBy()      { return $this->belongsTo(User::class, 'approved_by'); }
    public function approvalRequest() { return $this->belongsTo(ApprovalRequest::class); }
    public function source()          { return $this->morphTo(); }

    public function isPosted(): bool   { return $this->status === self::STATUS_POSTED; }
    public function isDraft(): bool    { return $this->status === self::STATUS_DRAFT; }
    public function isReversed(): bool { return $this->status === self::STATUS_REVERSED; }

    /**
     * Verify this entry is balanced (total debits = total credits).
     */
    public function isBalanced(): bool
    {
        $debits  = $this->lines->sum('debit');
        $credits = $this->lines->sum('credit');
        return abs($debits - $credits) < 0.01; // float tolerance
    }

    public static function generateVoucherNumber(string $type = 'VCH'): string
    {
        $prefix = strtoupper(substr($type, 0, 3));
        $date   = now()->format('Ymd');
        $seq    = static::whereDate('created_at', today())->count() + 1;
        return "{$prefix}-{$date}-" . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    public function scopePosted($q)  { return $q->where('status', self::STATUS_POSTED); }
    public function scopeForBranch($q, int $id) { return $q->where('branch_id', $id); }
}
