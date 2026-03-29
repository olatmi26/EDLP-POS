<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalThreshold extends Model
{
    protected $fillable = [
        'workflow_id', 'field', 'operator', 'threshold_value', 'escalate_to_workflow_id',
    ];

    protected $casts = ['threshold_value' => 'decimal:2'];

    public function workflow()      { return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id'); }
    public function escalateTo()    { return $this->belongsTo(ApprovalWorkflow::class, 'escalate_to_workflow_id'); }

    /**
     * Evaluate threshold against a context value.
     */
    public function evaluate(float $value): bool
    {
        return match ($this->operator) {
            '>'  => $value >  $this->threshold_value,
            '>=' => $value >= $this->threshold_value,
            '<'  => $value <  $this->threshold_value,
            '<=' => $value <= $this->threshold_value,
            '='  => $value == $this->threshold_value,
            default => false,
        };
    }
}
