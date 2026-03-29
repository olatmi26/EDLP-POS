<?php

namespace App\Listeners;

use App\Events\ApprovalFullyApproved;
use App\Services\ExpiryService;
use App\Services\StockMovementService;
use App\Services\PromotionService;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class HandleApprovalFullyApproved
{
    public function __construct(
        private readonly ExpiryService        $expiryService,
        private readonly StockMovementService $movementService,
        private readonly PromotionService     $promotionService,
    ) {}

    /**
     * When an approval request is fully approved, execute the corresponding
     * downstream action based on operation_type.
     */
    public function handle(ApprovalFullyApproved $event): void
    {
        $request = $event->request;
        $systemUser = User::role('super-admin')->first();

        try {
            match ($request->operation_type) {
                'expiry_disposal' => $this->expiryService->executeDisposal($request->operation_id),
                'stock_movement'  => $this->movementService->execute($request->operation_id, $systemUser),
                'promotion'       => $this->promotionService->activateAfterApproval($request->operation_id),
                default           => Log::info("ApprovalFullyApproved: no downstream action for type '{$request->operation_type}' (operation #{$request->operation_id})"),
            };
        } catch (\Throwable $e) {
            Log::error("ApprovalFullyApproved downstream action failed for request #{$request->id}: " . $e->getMessage());
        }
    }
}
