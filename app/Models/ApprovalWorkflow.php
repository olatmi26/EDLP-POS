<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalWorkflow extends Model
{
    protected $fillable = ['name', 'operation_type', 'is_active', 'description'];
    protected $casts    = ['is_active' => 'boolean'];

    const OPERATION_TYPES = [
        'promotion', 'expense', 'purchase_order',
        'stock_movement', 'expiry_disposal', 'wholesale_order', 'bulk_pricing',
    ];

    public function stages(): HasMany
    {
        return $this->hasMany(ApprovalStage::class, 'workflow_id')->orderBy('stage_order');
    }

    public function thresholds(): HasMany
    {
        return $this->hasMany(ApprovalThreshold::class, 'workflow_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class, 'workflow_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForOperation($query, string $operationType)
    {
        return $query->where('operation_type', $operationType);
    }
}
