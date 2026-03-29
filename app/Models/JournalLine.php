<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalLine extends Model
{
    protected $fillable = ['journal_entry_id','account_id','description','debit','credit','branch_id'];
    protected $casts    = ['debit'=>'decimal:2','credit'=>'decimal:2'];

    public function entry()   { return $this->belongsTo(JournalEntry::class, 'journal_entry_id'); }
    public function account() { return $this->belongsTo(Account::class); }
    public function branch()  { return $this->belongsTo(Branch::class); }
}
