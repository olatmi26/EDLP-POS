<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'address',
        'phone',
        'email',
        'is_head_office',
        'is_active',
        'manager_id',
        'opening_time',
        'closing_time',
        'timezone',
        'meta',
    ];

    protected $casts = [
        'is_head_office' => 'boolean',
        'is_active'      => 'boolean',
        'meta'           => 'array',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function manager(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function users(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(User::class);
    }

    public function inventory(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function sales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function cashierSessions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CashierSession::class);
    }

    public function expenses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Expense::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeHeadOffice($query)
    {
        return $query->where('is_head_office', true);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public function getDisplayNameAttribute(): string
    {
        return $this->is_head_office ? "{$this->name} (HQ)" : $this->name;
    }
}
