<?php

/**
 * EDLP POS — Event → Listener Registrations
 *
 * ADD these entries to the $listen array in app/Providers/EventServiceProvider.php
 * (or in Laravel 12, register them in bootstrap/app.php using withEvents())
 *
 * If using Laravel 12 bootstrap/app.php style:
 *
 * ->withEvents(discover: [__DIR__.'/../app/Listeners'])
 *
 * Or register manually:
 */

// In EventServiceProvider::$listen:
$listen = [
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

/*
 * For Laravel 12, add this to bootstrap/app.php inside Application::configure():
 *
 * ->withEvents(events: function (Dispatcher $events) {
 *     $events->listen(
 *         \App\Events\ApprovalFullyApproved::class,
 *         \App\Listeners\HandleApprovalFullyApproved::class
 *     );
 * })
 *
 * Or simply add the EventServiceProvider to config/app.php providers array.
 */
