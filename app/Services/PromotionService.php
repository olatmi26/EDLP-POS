<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUse;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PromotionService
{
    public function __construct(
        private readonly ApprovalWorkflowService $approvalService
    ) {}

    /**
     * Evaluate active promotions against a cart.
     *
     * @param  array  $cartItems  [['product_id'=>int, 'quantity'=>int, 'price'=>float, 'category_id'=>int|null], ...]
     * @param  int    $branchId
     * @param  int|null $customerId
     * @return array  ['line_discounts' => [...], 'total_discount' => float, 'applied_promotions' => [...]]
     */
    public function evaluate(array $cartItems, int $branchId, ?int $customerId = null): array
    {
        $activePromotions = Promotion::active()
            ->forBranch($branchId)
            ->with(['products:id', 'categories:id'])
            ->orderByDesc('priority')
            ->get();

        $lineDiscounts       = [];
        $appliedPromotions   = [];
        $exclusiveApplied    = false;

        foreach ($cartItems as $item) {
            $lineDiscounts[$item['product_id']] = [
                'product_id'     => $item['product_id'],
                'original_price' => $item['price'],
                'discount'       => 0.0,
                'promotion_id'   => null,
            ];
        }

        foreach ($activePromotions as $promotion) {
            if ($exclusiveApplied && ! $promotion->is_stackable) continue;

            foreach ($cartItems as $item) {
                if (! $this->appliesToItem($promotion, $item)) continue;

                $discount = $promotion->calculateDiscount($item['price'], $item['quantity']);
                if ($discount <= 0) continue;

                $lineDiscounts[$item['product_id']]['discount']      += $discount;
                $lineDiscounts[$item['product_id']]['promotion_id']   = $promotion->id;
                $appliedPromotions[$promotion->id]                    = $promotion->name;
            }

            if (! $promotion->is_stackable && count($appliedPromotions) > 0) {
                $exclusiveApplied = true;
            }
        }

        $totalDiscount = collect($lineDiscounts)->sum('discount');

        return [
            'line_discounts'      => array_values($lineDiscounts),
            'total_discount'      => round($totalDiscount, 2),
            'applied_promotions'  => array_values(array_map(
                fn ($id, $name) => ['id' => $id, 'name' => $name],
                array_keys($appliedPromotions),
                $appliedPromotions
            )),
        ];
    }

    /**
     * Redeem a coupon code. Uses SELECT FOR UPDATE to prevent race conditions.
     *
     * @return array ['coupon' => Coupon, 'discount' => float]
     */
    public function redeemCoupon(string $code, int $saleId, ?int $customerId = null): array
    {
        return DB::transaction(function () use ($code, $saleId, $customerId) {
            $coupon = Coupon::byCode($code)
                ->active()
                ->with('promotion')
                ->lockForUpdate()
                ->first();

            if (! $coupon) {
                throw new \RuntimeException('Invalid or expired coupon code.');
            }

            if (! $coupon->isValid($customerId)) {
                throw new \RuntimeException('This coupon cannot be applied to this transaction.');
            }

            // Calculate discount — for coupon promotions we use a flat value
            $discount = (float) $coupon->promotion->value;

            CouponUse::create([
                'coupon_id'        => $coupon->id,
                'sale_id'          => $saleId,
                'discount_applied' => $discount,
                'used_at'          => now(),
            ]);

            $coupon->increment('used_count');
            $coupon->promotion->increment('used_count');

            return ['coupon' => $coupon, 'discount' => $discount];
        });
    }

    /**
     * Create a promotion and route through the approval workflow.
     */
    public function create(array $data, User $createdBy): Promotion
    {
        return DB::transaction(function () use ($data, $createdBy) {
            $productIds  = $data['product_ids'] ?? [];
            $categoryIds = $data['category_ids'] ?? [];
            unset($data['product_ids'], $data['category_ids']);

            $promotion = Promotion::create([
                ...$data,
                'created_by' => $createdBy->id,
                'status'     => Promotion::STATUS_PENDING_APPROVAL,
            ]);

            if ($productIds)  $promotion->products()->sync($productIds);
            if ($categoryIds) $promotion->categories()->sync($categoryIds);

            // Initiate approval workflow
            $request = $this->approvalService->initiate(
                operationType: 'promotion',
                operationId:   $promotion->id,
                requestedBy:   $createdBy,
                context:       ['name' => $promotion->name, 'type' => $promotion->type, 'value' => $promotion->value],
                branchId:      $data['branch_id'] ?? $createdBy->branch_id,
            );

            $promotion->update(['approval_request_id' => $request->id]);

            return $promotion->load(['products', 'categories', 'approvalRequest']);
        });
    }

    /**
     * Activate a promotion after approval is granted.
     * Called by the ApprovalFullyApproved event listener.
     */
    public function activateAfterApproval(int $promotionId): void
    {
        Promotion::find($promotionId)?->update(['status' => Promotion::STATUS_ACTIVE]);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function appliesToItem(Promotion $promotion, array $item): bool
    {
        return match ($promotion->scope) {
            'all'      => true,
            'product'  => $promotion->products->contains('id', $item['product_id']),
            'category' => $promotion->categories->contains('id', $item['category_id'] ?? null),
            default    => false,
        };
    }
}
