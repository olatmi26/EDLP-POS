<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'requires_approval_above',
        'is_active',
    ];

    protected $casts = [
        'requires_approval_above' => 'decimal:2',
        'is_active'               => 'boolean',
    ];

    public function expenses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function requiresApproval(float $amount): bool
    {
        return $this->requires_approval_above !== null && $amount > (float) $this->requires_approval_above;
    }
}
