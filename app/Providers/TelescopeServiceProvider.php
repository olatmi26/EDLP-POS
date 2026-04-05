<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    /**
     * Register any application services.
     *
     * FIX: Telescope was causing "Maximum execution time of 60 seconds exceeded"
     * on FetchesStackTrace.php. We now only record exceptions and failed requests,
     * not every query/request, to keep dev performance acceptable.
     */
    public function register(): void
    {
        // Telescope::night();

        $this->hideSensitiveRequestDetails();

        // Only log errors and failures — not every request/query (which was causing timeouts)
        Telescope::filter(function (IncomingEntry $entry) {
            return $entry->isReportableException() ||
                   $entry->isFailedRequest() ||
                   $entry->isFailedJob() ||
                   $entry->isScheduledTask() ||
                   $entry->hasMonitoredTag();
        });

        // Disable the heavy stack trace watcher that was causing timeouts
        Telescope::tag(function (IncomingEntry $entry) {
            return [];
        });
    }

    /**
     * Prevent sensitive request details from being logged by Telescope.
     */
    protected function hideSensitiveRequestDetails(): void
    {
        Telescope::hideRequestParameters(['_token', 'password', 'password_confirmation', 'pin']);
        Telescope::hideRequestHeaders(['cookie', 'x-csrf-token', 'x-xsrf-token']);
    }

    /**
     * Register the Telescope gate.
     * By default, only super-admin and admin can view Telescope.
     */
    protected function gate(): void
    {
        Gate::define('viewTelescope', function (User $user) {
            return $user->isSuperAdmin() || $user->isAdmin();
        });
    }
}
