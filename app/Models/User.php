<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class User extends Authenticatable implements HasMedia
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles, InteractsWithMedia;

    protected $fillable = [
        'name',
        'email',
        'staff_id',
        'password',
        'phone',
        'pin',
        'branch_id',
        'is_active',
        'last_login_at',
        'pin_login_enabled',
        'preferences',
    ];

    protected $hidden = [
        'password',
        'pin',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at'     => 'datetime',
        'is_active'         => 'boolean',
        'pin_login_enabled' => 'boolean',
        'preferences'       => 'array',
        'password'          => 'hashed',
    ];

    // Add the dates property to handle soft deletes
    protected $dates = [
        'deleted_at',
    ];

    // ── Media collections ─────────────────────────────────────────────────────

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('avatar')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Sale::class, 'cashier_id');
    }

    public function cashierSessions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CashierSession::class, 'cashier_id');
    }

    public function managedBranch(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Branch::class, 'manager_id');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super-admin');
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isBranchManager(): bool
    {
        return $this->hasRole('branch-manager');
    }

    public function isCashier(): bool
    {
        return $this->hasRole('cashier');
    }

    public function canAccessBranch(int $branchId): bool
    {
        if ($this->isSuperAdmin() || $this->isAdmin()) {
            return true;
        }

        return $this->branch_id === $branchId;
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('avatar') ?: null;
    }
}
