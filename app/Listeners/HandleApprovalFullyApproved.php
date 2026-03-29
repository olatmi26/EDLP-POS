<?php

namespace App\Listeners;

use App\Events\ApprovalFullyApproved;
use App\Services\EtaxService;
use App\Services\ExpiryService;
use App\Services\PromotionService;
use App\Services\StockMovementService;
use App\Services\VoucherService;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

/**
 * HandleApprovalFullyApproved
 *
 * On full approval, this listener:
 * 1. Executes the downstream operation (dispose batch, execute movement, activate promotion, etc.)
 * 2. Posts accounting voucher if workflow.requires_payment_processing = true
 * 3. Submits to FIRS eTax gateway if applicable
 *
 * Implements ShouldQueue so network/external calls never block the approval API response.
 */
class HandleApprovalFullyApproved implements ShouldQueue
{
    public int $tries   = 3;
    public int $timeout = 60;

    public function __construct(
        private readonly ExpiryService        $expiryService,
        private readonly StockMovementService $movementService,
        private readonly PromotionService     $promotionService,
        private readonly VoucherService       $voucherService,
        private readonly EtaxService          $etaxService,
    ) {}

    public function handle(ApprovalFullyApproved $event): void
    {
        $request    = $event->request;
        $systemUser = User::role('super-admin')->first();

        // ── Step 1: Execute domain-specific downstream action ──────────────────
        try {
            match ($request->operation_type) {
                'expiry_disposal'  => $this->expiryService->executeDisposal($request->operation_id),
                'stock_movement'   => $this->movementService->execute($request->operation_id, $systemUser),
                'promotion'        => $this->promotionService->activateAfterApproval($request->operation_id),
                'expense', 'iou', 'travel_allowance', 'petty_cash'
                                   => null, // Payment workflow — handled below
                default            => Log::info("HandleApprovalFullyApproved: no domain action for '{$request->operation_type}'"),
            };
        } catch (\Throwable $e) {
            Log::error("HandleApprovalFullyApproved: domain action failed for #{$request->id}: " . $e->getMessage());
        }

        // ── Step 2: Post accounting voucher if workflow requires payment ────────
        if ($request->workflow?->requires_payment_processing && ! $request->voucher_posted_at) {
            try {
                $this->voucherService->postApprovalVoucher($request);
                Log::info("HandleApprovalFullyApproved: voucher posted for approval request #{$request->id}");
            } catch (\Throwable $e) {
                Log::error("HandleApprovalFullyApproved: voucher posting failed for #{$request->id}: " . $e->getMessage());
            }
        }

        // ── Step 3: eTax submission for invoice-generating operations ──────────
        // (Sales eTax is handled separately in SaleService after checkout)
        // For wholesale orders approved via this flow, submit the invoice now
        if ($request->operation_type === 'wholesale_order') {
            try {
                $order = \App\Models\WholesaleOrder::find($request->operation_id);
                if ($order) {
                    $submission = $this->etaxService->submitWholesaleInvoice($order);
                    $request->update(['etax_submitted_at' => now()]);
                    Log::info("HandleApprovalFullyApproved: eTax submitted for wholesale order #{$order->id}, status: {$submission->submission_status}");
                }
            } catch (\Throwable $e) {
                Log::error("HandleApprovalFullyApproved: eTax submission failed for #{$request->id}: " . $e->getMessage());
            }
        }
    }

    public function failed(ApprovalFullyApproved $event, \Throwable $exception): void
    {
        Log::error("HandleApprovalFullyApproved: FAILED permanently for request #{$event->request->id}: " . $exception->getMessage());
    }
}
