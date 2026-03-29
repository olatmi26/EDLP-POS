<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\Promotion;
use App\Services\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PromotionController extends Controller
{
    public function __construct(private readonly PromotionService $promotionService) {}

    /**
     * GET /api/promotions
     */
    public function index(Request $request): JsonResponse
    {
        $query = Promotion::with(['creator:id,name', 'branch:id,name', 'approvalRequest:id,status'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->branch_id, fn ($q, $id) => $q->where(fn ($inner) => $inner->whereNull('branch_id')->orWhere('branch_id', $id)))
            ->when($request->type,   fn ($q, $t) => $q->where('type', $t))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 15)));
    }

    /**
     * POST /api/promotions
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'required|string|max:200',
            'type'         => 'required|in:percentage_discount,fixed_discount,buy_X_get_Y,bundle_price,flash_sale',
            'value'        => 'required|numeric|min:0',
            'scope'        => 'required|in:all,category,product',
            'is_stackable' => 'boolean',
            'priority'     => 'integer|min:0',
            'start_date'   => 'nullable|date',
            'end_date'     => 'nullable|date|after_or_equal:start_date',
            'usage_limit'  => 'nullable|integer|min:1',
            'branch_id'    => 'nullable|integer|exists:branches,id',
            'product_ids'  => 'array',
            'product_ids.*'=> 'integer|exists:products,id',
            'category_ids' => 'array',
            'category_ids.*'=> 'integer|exists:categories,id',
            'buy_quantity' => 'nullable|integer|min:1',
            'get_quantity' => 'nullable|integer|min:1',
        ]);

        $promotion = $this->promotionService->create($data, $request->user());

        return $this->created($promotion, 'Promotion submitted for approval');
    }

    /**
     * GET /api/promotions/{promotion}
     */
    public function show(Promotion $promotion): JsonResponse
    {
        $promotion->load(['products:id,name,sku', 'categories:id,name', 'creator:id,name', 'approvalRequest.decisions.decider:id,name']);
        return $this->success($promotion);
    }

    /**
     * PUT /api/promotions/{promotion}
     */
    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        if (! in_array($promotion->status, [Promotion::STATUS_DRAFT, Promotion::STATUS_PAUSED])) {
            return $this->error('Only draft or paused promotions can be edited.', 422);
        }

        $data = $request->validate([
            'name'        => 'sometimes|string|max:200',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date',
            'usage_limit' => 'nullable|integer|min:1',
            'is_stackable'=> 'boolean',
            'priority'    => 'integer|min:0',
        ]);

        $promotion->update($data);
        return $this->success($promotion, 'Promotion updated');
    }

    /**
     * PATCH /api/promotions/{promotion}/pause
     */
    public function pause(Promotion $promotion): JsonResponse
    {
        if ($promotion->status !== Promotion::STATUS_ACTIVE) {
            return $this->error('Only active promotions can be paused.', 422);
        }
        $promotion->update(['status' => Promotion::STATUS_PAUSED]);
        return $this->success($promotion, 'Promotion paused');
    }

    /**
     * PATCH /api/promotions/{promotion}/activate
     */
    public function activate(Promotion $promotion): JsonResponse
    {
        if ($promotion->status !== Promotion::STATUS_APPROVED) {
            return $this->error('Only approved promotions can be activated.', 422);
        }
        $promotion->update(['status' => Promotion::STATUS_ACTIVE]);
        return $this->success($promotion, 'Promotion activated');
    }

    /**
     * DELETE /api/promotions/{promotion}
     */
    public function destroy(Promotion $promotion): JsonResponse
    {
        if ($promotion->status === Promotion::STATUS_ACTIVE) {
            return $this->error('Deactivate the promotion before deleting.', 422);
        }
        $promotion->delete();
        return $this->success(null, 'Promotion deleted');
    }

    /**
     * POST /api/promotions/{promotion}/coupons/generate
     * Batch generate N unique coupon codes.
     */
    public function generateCoupons(Request $request, Promotion $promotion): JsonResponse
    {
        $data = $request->validate([
            'count'       => 'required|integer|min:1|max:1000',
            'max_uses'    => 'integer|min:1',
            'expires_at'  => 'nullable|date|after:today',
            'customer_id' => 'nullable|integer|exists:customers,id',
        ]);

        $coupons = [];
        $count   = (int) $data['count'];

        for ($i = 0; $i < $count; $i++) {
            $coupons[] = [
                'code'        => strtoupper(Str::random(3) . '-' . Str::random(4) . '-' . Str::random(3)),
                'promotion_id'=> $promotion->id,
                'customer_id' => $data['customer_id'] ?? null,
                'max_uses'    => $data['max_uses'] ?? 1,
                'used_count'  => 0,
                'expires_at'  => $data['expires_at'] ?? null,
                'is_active'   => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ];
        }

        // Chunk insert to avoid memory issues on large batches
        collect($coupons)->chunk(100)->each(fn ($chunk) => Coupon::insert($chunk->toArray()));

        return $this->success(['generated' => $count], "Generated {$count} coupon codes");
    }

    /**
     * GET /api/promotions/active
     * Active promotions for POS checkout engine.
     */
    public function active(Request $request): JsonResponse
    {
        $branchId   = $request->branch_id;
        $promotions = Promotion::active()
            ->forBranch($branchId)
            ->with(['products:id', 'categories:id'])
            ->orderByDesc('priority')
            ->get();

        return $this->success($promotions);
    }
}
