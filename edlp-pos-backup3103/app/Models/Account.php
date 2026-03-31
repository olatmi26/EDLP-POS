<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Account extends Model
{
    use SoftDeletes;

    const TYPE_ASSET     = 'asset';
    const TYPE_LIABILITY = 'liability';
    const TYPE_EQUITY    = 'equity';
    const TYPE_REVENUE   = 'revenue';
    const TYPE_EXPENSE   = 'expense';

    protected $fillable = [
        'code','name','type','sub_type','parent_id',
        'branch_id','currency','is_active','is_system','description',
    ];

    protected $casts = ['is_active' => 'boolean', 'is_system' => 'boolean'];

    public function parent()   { return $this->belongsTo(Account::class, 'parent_id'); }
    public function children() { return $this->hasMany(Account::class, 'parent_id'); }
    public function branch()   { return $this->belongsTo(Branch::class); }
    public function lines()    { return $this->hasMany(JournalLine::class); }
    public function balances() { return $this->hasMany(AccountBalance::class); }

    public function scopeActive($q)               { return $q->where('is_active', true); }
    public function scopeByType($q, string $type) { return $q->where('type', $type); }

    /**
     * Get the running balance for this account.
     * Positive = debit balance (assets/expenses), Negative = credit balance (liabilities/equity/revenue).
     */
    public function currentBalance(?int $branchId = null): float
    {
        $query = $this->lines()->selectRaw('SUM(debit) - SUM(credit) as balance');
        if ($branchId) $query->where('branch_id', $branchId);
        return (float) ($query->value('balance') ?? 0);
    }
}
