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
     * Super-admins with no branch_id see ALL branches unless ?branch_id= is passed.
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id; // set by BranchScope middleware

        $query = Inventory::with(['product.category', 'product.supplier', 'branch'])
            ->when(
                // Skip branch filter for super-admin/admin if no specific branch requested
                // or if branch_id is null (super-admin at group level)
                $branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->forBranch((int) $branchId)
            )
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->forBranch((int) $user->branch_id)
            )
            ->when($request->status === 'low', fn ($q) => $q->lowStock())
            ->when($request->status === 'out', fn ($q) => $q->outOfStock())
            ->when($request->category_id, fn ($q, $id) => $q->whereHas('product', fn ($p) => $p->where('category_id', $id)))
            ->when($request->search, fn ($q, $s) => $q->whereHas('product', fn ($p) => $p->search($s)))
            ->orderBy('product_id');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/inventory/{productId}
     */
    public function show(Request $request, int $productId): JsonResponse
    {
        $user  = $request->user();
        $query = Inventory::with(['product', 'branch'])->where('product_id', $productId);

        if (! $user->isSuperAdmin() && ! $user->isAdmin()) {
            $query->forBranch((int) $request->branch_id);
        }

        return $this->success(InventoryResource::collection($query->get()));
    }

    /**
     * GET /api/inventory/low-stock
     */
    public function lowStock(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $items = Inventory::with(['product.category', 'branch'])
            ->when(
                $branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->forBranch((int) $branchId)
            )
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->forBranch((int) $user->branch_id)
            )
            ->lowStock()
            ->get();

        return $this->success(InventoryResource::collection($items));
    }

    /**
     * POST /api/inventory/adjust
     */
    public function adjust(AdjustInventoryRequest $request): JsonResponse
    {
        $inventory = $this->inventoryService->adjust(
            productId: $request->product_id,
            branchId:  (int) ($request->branch_id ?? $request->user()->branch_id),
            type:      $request->type,
            quantity:  $request->quantity,
            notes:     $request->notes,
            user:      $request->user()
        );

        return $this->success(new InventoryResource($inventory->load('product', 'branch')), 'Stock adjusted');
    }

    /**
     * POST /api/inventory/stock-take
     */
    public function stockTake(Request $request): JsonResponse
    {
        $request->validate([
            'items'              => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:0',
        ]);

        $branchId = (int) ($request->branch_id ?? $request->user()->branch_id);
        $results  = $this->inventoryService->stockTake($request->items, $branchId, $request->user());

        return $this->success($results, 'Stock-take recorded');
    }

    /**
     * POST /api/inventory/transfer
     */
    public function transfer(TransferInventoryRequest $request): JsonResponse
    {
        $transfer = $this->inventoryService->requestTransfer($request->validated(), $request->user());
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
}
