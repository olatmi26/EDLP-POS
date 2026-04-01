<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| EDLP POS — Console Routes & Scheduled Commands
|--------------------------------------------------------------------------
|
| Crontab entry on server (add via: crontab -e):
|   * * * * * cd /var/www/edlp-pos && php artisan schedule:run >> /dev/null 2>&1
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ── Scheduled Tasks ───────────────────────────────────────────────────────────

/**
 * Daily expiry monitor — 06:00 every day.
 * Scans all product batches, flags near-expiry, marks expired.
 * Sends in-app + email alerts to branch managers (Sprint 5 notifications).
 */
Schedule::command('expiry:monitor --days=30')
    ->dailyAt('06:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/expiry-monitor.log'));

/**
 * Approval escalation — runs every hour.
 * Checks for timed-out pending approval requests and escalates/auto-approves
 * per workflow stage configuration.
 */
Schedule::call(function () {
    try {
        $service   = app(\App\Services\ApprovalWorkflowService::class);
        $escalated = $service->escalateTimedOut();
        if ($escalated > 0) {
            \Illuminate\Support\Facades\Log::info("Approval escalation: {$escalated} requests escalated.");
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::error('Approval escalation scheduler failed: ' . $e->getMessage());
    }
})->hourly()->name('approval:escalate')->withoutOverlapping();
