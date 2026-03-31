<?php
namespace App\Events;

use App\Models\ApprovalRequest;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApprovalRejected
{
    use Dispatchable, SerializesModels;
    public function __construct(public readonly ApprovalRequest $request) {}
}
