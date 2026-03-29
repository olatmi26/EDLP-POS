<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpiryDisposal extends Model
{
    protected $fillable = [
        'batch_id','branch_id','quantity','reason','disposal_method',
        'write_off_value','disposed_by','approval_request_id','notes','disposed_at',
    ];

    protected $casts = [
        'write_off_value' => 'decimal:2',
        'quantity'        => 'integer',
        'disposed_at'     => 'datetime',
    ];

    public function batch()           { return $this->belongsTo(ProductBatch::class, 'batch_id'); }
    public function branch()          { return $this->belongsTo(Branch::class); }
    public function disposedBy()      { return $this->belongsTo(User::class, 'disposed_by'); }
    public function approvalRequest() { return $this->belongsTo(ApprovalRequest::class); }
}
