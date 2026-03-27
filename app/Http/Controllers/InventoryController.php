<?php

namespace App\Http\Controllers;

use App\Http\Requests\Inventory\AdjustInventoryRequest;
use App\Http\Requests\Inventory\TransferInventoryRequest;
use App\Http\Resources\InventoryResource;
use App\Models\Inventory;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventoryService) {}

    /**
     * GET /api/inventory
     * List stock for a branch with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->branch_id;

        $query = Inventory::with(['product.category', 'product.supplier', 'branch'])
            ->forBranch($branchId)
            ->when($request->status === 'low', fn ($q) => $q->lowStock())
            ->when($request->status === 'out', fn ($q) => $q->outOfStock())
            ->when($request->category_id, fn ($q, $id) => $q->whereHas('product', fn ($p) => $p->where('category_id', $id)))
            ->when($request->search, fn ($q, $s) => $q->whereHas('product', fn ($p) => $p->search($s)))
            // Keep ordering simple/portable across DB drivers.
            ->orderBy('product_id');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/inventory/{product}
     * Stock for a single product across all branches (admin) or own branch.
     */
    public function show(Request $request, int $productId): JsonResponse
    {
        $user = $request->user();

        $query = Inventory::with(['product', 'branch'])
            ->where('product_id', $productId);

        if (! $user->isSuperAdmin() && ! $user->isAdmin()) {
            $query->forBranch($request->branch_id);
        }

        $inventory = $query->get();

        return $this->success(InventoryResource::collection($inventory));
    }

    /**
     * POST /api/inventory/adjust
     * Add / remove / set stock for a product at a branch.
     */
    public function adjust(AdjustInventoryRequest $request): JsonResponse
    {
        $inventory = $this->inventoryService->adjust(
            productId: $request->product_id,
            branchId:  $request->branch_id ?? $request->user()->branch_id,
            type:      $request->type,
            quantity:  $request->quantity,
            notes:     $request->notes,
            user:      $request->user()
        );

        return $this->success(new InventoryResource($inventory->load('product', 'branch')), 'Stock adjusted');
    }

    /**
     * POST /api/inventory/stock-take
     * Record a stock-take count.
     */
    public function stockTake(Request $request): JsonResponse
    {
        $request->validate([
            'items'             => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity'  => 'required|integer|min:0',
        ]);

        $branchId = $request->branch_id;
        $results  = $this->inventoryService->stockTake($request->items, $branchId, $request->user());

        return $this->success($results, 'Stock-take recorded');
    }

    /**
     * POST /api/inventory/transfer
     * Request an inter-branch transfer.
     */
    public function transfer(TransferInventoryRequest $request): JsonResponse
    {
        $transfer = $this->inventoryService->requestTransfer(
            $request->validated(),
            $request->user()
        );

        return $this->created($transfer, 'Transfer request submitted for approval');
    }

    /**
     * PATCH /api/inventory/transfers/{transfer}/approve
     */
    public function approveTransfer(Request $request, int $transferId): JsonResponse
    {
        $transfer = $this->inventoryService->approveTransfer($transferId, $request->user());

        return $this->success($transfer, 'Transfer approved and stock updated');
    }

    /**
     * GET /api/inventory/low-stock
     * Products at or below reorder level for branch.
     */
    public function lowStock(Request $request): JsonResponse
    {
        $items = Inventory::with(['product.category', 'branch'])
            ->forBranch($request->branch_id)
            ->lowStock()
            ->get();

        return $this->success(InventoryResource::collection($items));
    }
}
