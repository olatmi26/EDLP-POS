<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class EtaxSubmission extends Model
{
    const STATUS_PENDING   = 'pending';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_ACCEPTED  = 'accepted';
    const STATUS_REJECTED  = 'rejected';
    const STATUS_FAILED    = 'failed';

    protected $fillable = [
        'branch_id','source_type','source_id','document_type','document_number',
        'fiscal_document_number','qr_code_data','submission_status',
        'request_payload','response_payload','error_message',
        'taxable_amount','vat_amount','total_amount',
        'retry_count','submitted_at','accepted_at',
    ];

    protected $casts = [
        'request_payload'  => 'array',
        'response_payload' => 'array',
        'taxable_amount'   => 'decimal:2',
        'vat_amount'       => 'decimal:2',
        'total_amount'     => 'decimal:2',
        'submitted_at'     => 'datetime',
        'accepted_at'      => 'datetime',
        'retry_count'      => 'integer',
    ];

    public function branch() { return $this->belongsTo(Branch::class); }
    public function source() { return $this->morphTo(); }

    public function isAccepted(): bool { return $this->submission_status === self::STATUS_ACCEPTED; }
    public function hasFailed(): bool  { return in_array($this->submission_status, [self::STATUS_FAILED, self::STATUS_REJECTED]); }
    public function canRetry(): bool   { return $this->hasFailed() && $this->retry_count < 3; }

    public function scopePending($q)  { return $q->where('submission_status', self::STATUS_PENDING); }
    public function scopeFailed($q)   { return $q->where('submission_status', self::STATUS_FAILED); }
}
