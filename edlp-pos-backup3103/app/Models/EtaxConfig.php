<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class EtaxConfig extends Model
{
    protected $table    = 'etax_config';
    protected $fillable = ['branch_id','tin','taxpayer_name','device_serial','api_environment','api_key','api_secret','vat_rate','is_enabled','last_sync_at'];
    protected $hidden   = ['api_key','api_secret'];
    protected $casts    = ['is_enabled'=>'boolean','last_sync_at'=>'datetime'];

    public function branch() { return $this->belongsTo(Branch::class); }
}
