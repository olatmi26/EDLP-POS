<?php

namespace App\Http\Controllers;

use App\Models\StockMovement;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function __construct(private readonly StockMovementService $movementService) {}

    /**
     * GET /api/stock-movements
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $query = StockMovement::with(['product:id,name,sku', 'branch:id,name', 'requestedBy:id,name', 'approvalRequest:id,status'])
            ->when($branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->where('branch_id', (int) $branchId))
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->where('branch_id', (int) $user->branch_id))
            ->when($request->status,        fn ($q, $s) => $q->where('status', $s))
            ->when($request->movement_type, fn ($q, $t) => $q->where('movement_type', $t))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/stock-movements
     * Any authenticated user can raise a stock movement request.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id'    => 'required|integer|exists:products,id',
            'quantity'      => 'required|integer|min:1',
            'movement_type' => 'required|in:sampling,internal_use,staff_welfare,damaged,management_consumption,recalled',
            'reason'        => 'required|string|min:10|max:500',
            'batch_id'      => 'nullable|integer|exists:product_batches,id',
        ]);

        $data['branch_id'] = (int) ($request->branch_id ?? $request->user()->branch_id);

        $movement = $this->movementService->request($data, $request->user());

        return $this->created($movement, 'Stock movement request submitted for approval');
    }

    /**
     * GET /api/stock-movements/{stockMovement}
     */
    public function show(StockMovement $stockMovement): JsonResponse
    {
        $stockMovement->load(['product', 'branch:id,name', 'requestedBy:id,name', 'executedBy:id,name', 'approvalRequest.decisions.decider:id,name']);
        return $this->success($stockMovement);
    }

    /**
     * GET /api/stock-movements/reports/shrinkage
     */
    public function shrinkageReport(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $user     = $request->user();
        $branchId = (! $user->isSuperAdmin() && ! $user->isAdmin())
            ? (int) $user->branch_id
            : ($request->branch_id ? (int) $request->branch_id : null);

        $summary = $this->movementService->shrinkageSummary(
            $branchId,
            $request->date_from,
            $request->date_to
        );

        return $this->success($summary);
    }
}
