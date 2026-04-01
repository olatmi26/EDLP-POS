<?php

namespace App\Console\Commands;

use App\Models\ProductBatch;
use App\Services\ExpiryService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * ExpiryMonitorCommand
 *
 * Scheduled daily at 06:00 (see routes/console.php).
 *
 * Scans all active product batches and:
 *  1. Flags near_expiry batches (within configurable threshold, default 30 days)
 *  2. Marks expired batches
 *  3. Logs urgency groups: Critical (<7d), Warning (7-30d), Watch (30-60d)
 *  4. (Sprint 5) — dispatches in-app + email notifications to branch managers
 *
 * Usage:
 *   php artisan expiry:monitor
 *   php artisan expiry:monitor --days=14   # custom near-expiry threshold
 *   php artisan expiry:monitor --dry-run   # report only, no DB writes
 */
class ExpiryMonitorCommand extends Command
{
    protected $signature = 'expiry:monitor
                            {--days=30 : Near-expiry threshold in days}
                            {--dry-run : Report findings without writing to DB}';

    protected $description = 'Scan product batches, flag near-expiry items, and mark expired batches.';

    public function __construct(private readonly ExpiryService $expiryService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $days   = (int) $this->option('days');
        $dryRun = (bool) $this->option('dry-run');

        $this->info("EDLP POS — Expiry Monitor" . ($dryRun ? ' [DRY RUN]' : ''));
        $this->info("Near-expiry threshold: {$days} days");
        $this->newLine();

        if ($dryRun) {
            return $this->runDryRun($days);
        }

        // Run the monitor via ExpiryService
        $result = $this->expiryService->runExpiryMonitor($days);

        $this->info("✓ Flagged as near_expiry : {$result['flagged']}");
        $this->info("✓ Marked as expired      : {$result['expired']}");

        // Summary by urgency
        $this->newLine();
        $this->reportUrgencyGroups($days);

        Log::info("ExpiryMonitorCommand completed: flagged={$result['flagged']}, expired={$result['expired']}");

        return self::SUCCESS;
    }

    private function runDryRun(int $days): int
    {
        $nearExpiry = ProductBatch::with(['product:id,name,sku', 'branch:id,name'])
            ->nearExpiry($days)
            ->whereNotIn('status', [ProductBatch::STATUS_DISPOSED])
            ->orderBy('expiry_date')
            ->get();

        $expired = ProductBatch::with(['product:id,name,sku', 'branch:id,name'])
            ->whereDate('expiry_date', '<', today())
            ->whereNotIn('status', [ProductBatch::STATUS_DISPOSED, ProductBatch::STATUS_EXPIRED])
            ->get();

        $this->warn("[DRY RUN] Would flag {$nearExpiry->count()} batches as near_expiry");
        $this->warn("[DRY RUN] Would mark {$expired->count()} batches as expired");

        if ($nearExpiry->isNotEmpty()) {
            $this->newLine();
            $this->table(
                ['Batch #', 'Product', 'Branch', 'Expiry Date', 'Days Left', 'Qty', 'Urgency'],
                $nearExpiry->map(function ($b) {
                    $days = $b->daysUntilExpiry();
                    return [
                        $b->batch_number,
                        $b->product->name ?? "#{$b->product_id}",
                        $b->branch->name  ?? "#{$b->branch_id}",
                        $b->expiry_date->format('d M Y'),
                        $days,
                        $b->quantity_remaining,
                        $days < 7 ? 'CRITICAL' : ($days < 30 ? 'Warning' : 'Watch'),
                    ];
                })->toArray()
            );
        }

        return self::SUCCESS;
    }

    private function reportUrgencyGroups(int $nearExpiryDays): void
    {
        $batches = ProductBatch::with(['product:id,name', 'branch:id,name'])
            ->nearExpiry($nearExpiryDays)
            ->orderBy('expiry_date')
            ->get();

        $critical = $batches->filter(fn ($b) => $b->daysUntilExpiry() < 7);
        $warning  = $batches->filter(fn ($b) => $b->daysUntilExpiry() >= 7  && $b->daysUntilExpiry() < 30);
        $watch    = $batches->filter(fn ($b) => $b->daysUntilExpiry() >= 30);

        $this->line("<fg=red>Critical (<7 days): {$critical->count()} batches</>");
        $this->line("<fg=yellow>Warning (7-30 days): {$warning->count()} batches</>");
        $this->line("<fg=cyan>Watch (30-{$nearExpiryDays} days): {$watch->count()} batches</>");

        if ($critical->isNotEmpty()) {
            $this->newLine();
            $this->warn('CRITICAL BATCHES (action required immediately):');
            foreach ($critical as $b) {
                $this->error(
                    "  [{$b->branch->name}] {$b->product->name} — Batch {$b->batch_number} — "
                    . "Expires: {$b->expiry_date->format('d M Y')} — Qty: {$b->quantity_remaining}"
                );
            }
        }
    }
}
