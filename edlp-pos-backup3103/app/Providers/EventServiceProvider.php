<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        \App\Events\ApprovalFullyApproved::class => [
            \App\Listeners\HandleApprovalFullyApproved::class,
        ],
        \App\Events\ApprovalDecisionMade::class => [
            // Future: send real-time Pusher notification to requester
        ],
        \App\Events\ApprovalRejected::class => [
            // Future: send notification to requester
        ],
        \App\Events\InventoryAdjusted::class => [
            // Already exists in your project — keep as-is
        ],
    ];
}
