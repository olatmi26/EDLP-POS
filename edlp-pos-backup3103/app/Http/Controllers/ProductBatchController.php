<?php

namespace App\Http\Controllers;

use App\Models\ExpiryDisposal;
use App\Models\ProductBatch;
use App\Services\ExpiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductBatchController extends Controller
{
    public function __construct(private readonly ExpiryService $expiryService) {}

    /**
     * GET /api/batches
     * List all batches for branch, filterable by status and product.
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $query = ProductBatch::with(['product:id,name,sku', 'branch:id,name', 'receivedBy:id,name'])
            ->when($branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->where('branch_id', (int) $branchId))
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->where('branch_id', (int) $user->branch_id))
            ->when($request->status,     fn ($q, $s)  => $q->where('status', $s))
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->orderBy('expiry_date', 'asc');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/batches
     * Receive a new product batch (called after PO receipt or direct stock intake).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id'       => 'required|integer|exists:products,id',
            'batch_number'     => 'required|string|max:100',
            'expiry_date'      => 'required|date|after:today',
            'manufactured_date'=> 'nullable|date|before:today',
            'quantity'         => 'required|integer|min:1',
            'cost_per_unit'    => 'required|numeric|min:0',
            'supplier_id'      => 'nullable|integer|exists:suppliers,id',
            'purchase_order_id'=> 'nullable|integer|exists:purchase_orders,id',
        ]);

        $data['branch_id'] = (int) ($request->branch_id ?? $request->user()->branch_id);

        $batch = $this->expiryService->receiveBatch($data, $request->user());

        return $this->created($batch->load('product:id,name,sku'), 'Batch received');
    }

    /**
     * GET /api/batches/{productBatch}
     */
    public function show(ProductBatch $productBatch): JsonResponse
    {
        $productBatch->load(['product:id,name,sku,reorder_level', 'branch:id,name', 'receivedBy:id,name', 'disposals']);
        return $this->success($productBatch);
    }

    /**
     * GET /api/batches/product/{productId}/active
     * FEFO: Get the earliest-expiry active batch for a product at the current branch.
     */
    public function activeBatch(Request $request, int $productId): JsonResponse
    {
        $branchId = (int) ($request->branch_id ?? $request->user()->branch_id);
        $batch    = $this->expiryService->getActiveBatch($productId, $branchId);

        return $this->success($batch);
    }

    /**
     * GET /api/batches/near-expiry
     * All batches expiring within the configurable threshold (default 30 days).
     */
    public function nearExpiry(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;
        $days     = (int) ($request->days ?? 30);

        $batches = ProductBatch::with(['product:id,name,sku,reorder_level', 'branch:id,name'])
            ->when($branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->where('branch_id', (int) $branchId))
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->where('branch_id', (int) $user->branch_id))
            ->nearExpiry($days)
            ->orderBy('expiry_date', 'asc')
            ->get();

        // Group by urgency
        $critical = $batches->filter(fn ($b) => $b->daysUntilExpiry() < 7);
        $warning  = $batches->filter(fn ($b) => $b->daysUntilExpiry() >= 7  && $b->daysUntilExpiry() < 30);
        $watch    = $batches->filter(fn ($b) => $b->daysUntilExpiry() >= 30);

        return $this->success([
            'critical' => $critical->values(),
            'warning'  => $warning->values(),
            'watch'    => $watch->values(),
            'total'    => $batches->count(),
        ]);
    }

    /**
     * POST /api/batches/disposals
     * Request disposal of an expired/near-expiry batch. Routes through approval engine.
     */
    public function requestDisposal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id'        => 'required|integer|exists:product_batches,id',
            'quantity'        => 'required|integer|min:1',
            'reason'          => 'required|in:expired,near_expiry,damaged,recalled',
            'disposal_method' => 'required|in:destroy,return_to_supplier,donate,markdown_sale',
            'notes'           => 'nullable|string|max:500',
        ]);

        $disposal = $this->expiryService->requestDisposal($data, $request->user());

        return $this->created($disposal, 'Disposal request submitted for approval');
    }

    /**
     * GET /api/batches/disposals
     * List all disposal records.
     */
    public function disposalIndex(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        $query = ExpiryDisposal::with(['batch.product:id,name,sku', 'branch:id,name', 'disposedBy:id,name', 'approvalRequest:id,status'])
            ->when($branchId && (! $user->isSuperAdmin() || $request->has('branch_id')),
                fn ($q) => $q->where('branch_id', (int) $branchId))
            ->when(! $branchId && ! $user->isSuperAdmin() && ! $user->isAdmin(),
                fn ($q) => $q->where('branch_id', (int) $user->branch_id))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 15)));
    }
}
