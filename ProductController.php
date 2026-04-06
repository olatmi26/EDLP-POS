<?php

namespace App\Http\Controllers;

use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\PriceHistory;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $productService) {}

    /**
     * GET /api/products
     *
     * Admin/Super-Admin/CEO with no stored branch_id → load inventory for ALL branches.
     * Admin/Super-Admin/CEO with a branch_id stored → load inventory for that branch only.
     * Non-admins → inventory for their branch only (enforced by BranchScope).
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id; // set by BranchScope middleware (may be null for admins)

        // Admins/super-admins/CEOs with NO branch context → aggregate all branches
        $isPrivileged    = $user->isSuperAdmin() || $user->isAdmin() || $user->hasRole('ceo');
        $loadAllBranches = $isPrivileged && empty($branchId);

        // Only eager-load brand if the brands table/column exists
        $brandTableExists = Schema::hasTable('brands')
            && Schema::hasColumn('products', 'brand_id');

        $with = [
            'category:id,name',
            'supplier:id,name',
            'inventory' => function ($q) use ($branchId, $loadAllBranches) {
                if ($loadAllBranches) {
                    // No filter — aggregate all branches for admin overview
                    return;
                }
                if ($branchId) {
                    $q->where('branch_id', $branchId);
                }
            },
        ];

        if ($brandTableExists) {
            $with[] = 'brand:id,name';
        }

        $query = Product::with($with)
            ->when($request->search,      fn ($q, $s)  => $q->search($s))
            ->when($request->category_id, fn ($q, $id) => $q->forCategory((int) $id))
            ->when($request->supplier_id, fn ($q, $id) => $q->forSupplier((int) $id))
            ->when(
                $request->has('active_only'),
                fn ($q) => $request->boolean('active_only') ? $q->active() : $q,
                fn ($q) => $q->active()
            )
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success(ProductResource::collection($query->get()));
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/products/search
     * Optimised POS barcode/text search — always returns branch-scoped stock.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate(['q' => 'required|string|min:1']);

        $branchId = $request->branch_id;

        $products = Product::with([
            'category:id,name',
            'inventory' => fn ($q) => $q->where('branch_id', $branchId),
        ])
            ->active()
            ->search($request->q)
            ->limit(20)
            ->get();

        return $this->success(ProductResource::collection($products));
    }

    /**
     * POST /api/products
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = $this->productService->create($request->validated(), $request->user());
        return $this->created(new ProductResource($product->load('category', 'supplier')), 'Product created');
    }

    /**
     * GET /api/products/{product}
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        $product->load([
            'category',
            'supplier',
            'inventory',
            'priceHistory',
        ]);

        return $this->success(new ProductResource($product));
    }

    /**
     * PUT /api/products/{product}
     */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product = $this->productService->update($product, $request->validated(), $request->user());
        return $this->success(new ProductResource($product->load('category', 'supplier')), 'Product updated');
    }

    /**
     * DELETE /api/products/{product}
     */
    public function destroy(Product $product): JsonResponse
    {
        if ($product->saleItems()->exists()) {
            return $this->error(
                'Cannot delete a product with sales history. Deactivate it instead.',
                422
            );
        }

        $product->delete();
        return $this->success(null, 'Product deleted');
    }

    /**
     * POST /api/products/{product}/image
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|mimes:jpeg,png,webp|max:2048',
        ]);

        $product->clearMediaCollection('images');
        $product->addMediaFromRequest('image')->toMediaCollection('images');

        return $this->success([
            'thumbnail_url' => $product->getFirstMediaUrl('images'),
        ], 'Image uploaded');
    }

    /**
     * POST /api/products/bulk-price-update
     */
    public function bulkPriceUpdate(Request $request): JsonResponse
    {
        $result = $this->productService->bulkPriceUpdate($request->all(), $request->user());
        return $this->success($result, "Updated {$result['updated']} product(s)");
    }

    /**
     * PATCH /api/products/{product}/price
     */
    public function updatePrice(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'selling_price' => 'required|numeric|min:0',
            'cost_price'    => 'nullable|numeric|min:0',
            'reason'        => 'nullable|string|max:255',
        ]);

        $oldPrice = $product->selling_price;
        $product->update($data);

        PriceHistory::create([
            'product_id'       => $product->id,
            'old_price'        => $oldPrice,
            'new_price'        => $product->selling_price,
            'change_type'      => 'manual',
            'price_change_pct' => $oldPrice > 0
                ? round((($product->selling_price - $oldPrice) / $oldPrice) * 100, 2)
                : 0,
            'changed_by'       => $request->user()->id,
            'effective_at'     => now(),
        ]);

        return $this->success(new ProductResource($product), 'Price updated');
    }

    /**
     * GET /api/products/export
     */
    public function export(Request $request): JsonResponse|\Illuminate\Http\Response
    {
        $branchId = $request->branch_id;

        $products = Product::with(['category:id,name', 'supplier:id,name', 'inventory' => function ($q) use ($branchId) {
            if ($branchId) {
                $q->where('branch_id', $branchId);
            }
        }])
            ->when($request->category_id, fn ($q, $id) => $q->forCategory((int) $id))
            ->when($request->price_min, fn ($q, $min) => $q->where('selling_price', '>=', $min))
            ->when($request->price_max, fn ($q, $max) => $q->where('selling_price', '<=', $max))
            ->active()
            ->orderBy('name')
            ->get();

        $headers = ['name', 'sku', 'barcode', 'category', 'supplier', 'cost_price', 'selling_price', 'unit', 'reorder_level', 'is_active', 'stock'];
        $rows    = $products->map(fn ($p) => [
            $p->name, $p->sku, $p->barcode ?? '',
            $p->category?->name ?? '', $p->supplier?->name ?? '',
            $p->cost_price, $p->selling_price, $p->unit ?? '',
            $p->reorder_level ?? '', $p->is_active ? 'Yes' : 'No',
            $p->inventory->sum('quantity'),
        ]);

        $csv = collect([$headers])
            ->concat($rows)
            ->map(fn ($r) => implode(',', array_map(
                fn ($v) => '"' . str_replace('"', '""', $v) . '"', $r
            )))
            ->implode("\n");

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="edlp-products.csv"',
        ]);
    }

    /**
     * POST /api/products/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $result = $this->productService->importFromCsv($request->file('file'), $request->user());
        return $this->success($result, "Import complete: {$result['created']} created, {$result['updated']} updated, {$result['skipped']} skipped.");
    }

    /**
     * POST /api/products/import/preview
     */
    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $preview = $this->productService->previewImport($request->file('file'));
        return $this->success($preview);
    }

    /**
     * POST /api/products/opening-stock
     * Import opening stock quantities for a specific branch.
     * CSV format: sku, quantity, cost_price (optional), notes (optional)
     */
    public function openingStock(Request $request): JsonResponse
    {
        $request->validate([
            'file'      => 'required|file|mimes:csv,txt|max:5120',
            'branch_id' => 'required|integer|exists:branches,id',
        ]);

        $branchId = $request->branch_id;
        $user     = $request->user();
        $file     = $request->file('file');
        $handle   = fopen($file->getRealPath(), 'r');

        $headers = array_map('trim', fgetcsv($handle)); // skip header row
        $created = 0;
        $skipped = 0;
        $errors  = [];

        while (($row = fgetcsv($handle)) !== false) {
            if (empty($row[0])) continue;
            $sku      = trim($row[0]);
            $qty      = (int) ($row[1] ?? 0);
            $costRaw  = isset($row[2]) && $row[2] !== '' ? (float) $row[2] : null;
            $notes    = trim($row[3] ?? '');

            $product = Product::where('sku', $sku)->first();
            if (! $product) {
                $errors[] = "SKU not found: {$sku}";
                $skipped++;
                continue;
            }

            // Upsert inventory record
            $inv = \App\Models\Inventory::firstOrNew([
                'product_id' => $product->id,
                'branch_id'  => $branchId,
            ]);

            $inv->quantity = $qty;
            if ($costRaw !== null) {
                $product->update(['cost_price' => $costRaw]);
            }
            $inv->save();

            // Log stock movement
            \App\Models\StockMovement::create([
                'product_id'    => $product->id,
                'branch_id'     => $branchId,
                'movement_type' => 'opening_stock',
                'quantity'      => $qty,
                'reason'        => $notes ?: 'Opening stock import',
                'performed_by'  => $user->id,
            ]);

            $created++;
        }

        fclose($handle);

        return $this->success([
            'updated' => $created,
            'skipped' => $skipped,
            'errors'  => $errors,
        ], "Opening stock applied: {$created} products updated.");
    }
}
