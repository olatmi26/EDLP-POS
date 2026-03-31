<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class AccountBalance extends Model
{
    protected $fillable = ['account_id','branch_id','period','opening_balance','total_debits','total_credits','closing_balance'];
    protected $casts    = ['opening_balance'=>'decimal:2','total_debits'=>'decimal:2','total_credits'=>'decimal:2','closing_balance'=>'decimal:2'];

    public function account() { return $this->belongsTo(Account::class); }
    public function branch()  { return $this->belongsTo(Branch::class); }
}
