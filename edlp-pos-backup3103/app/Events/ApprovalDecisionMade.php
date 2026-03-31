<?php
namespace App\Events;

use App\Models\ApprovalDecision;
use App\Models\ApprovalRequest;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApprovalDecisionMade
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly ApprovalRequest  $request,
        public readonly ApprovalDecision $decision,
        public readonly User             $decidedBy,
    ) {}
}
