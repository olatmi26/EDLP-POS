<?php

namespace App\Http\Controllers;

use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Requests\Product\BulkPriceUpdateRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $productService) {}

    /**
     * GET /api/products
     * Returns paginated product list with branch-scoped inventory levels.
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->branch_id; // set by BranchScope middleware
        $user     = $request->user();

        // Super-admins/admins with no explicit branch filter → load all branches
        $loadAllBranches = ($user->isSuperAdmin() || $user->isAdmin() || $user->hasRole('ceo'))
            && empty($request->input('branch_id'));

        $query = Product::with([
                'category',
                'supplier',
                'brand',
                'inventory' => function ($q) use ($branchId, $loadAllBranches) {
                    // Admin without explicit branch filter: load all branches for full stock picture
                    if ($branchId && !$loadAllBranches) {
                        $q->where('branch_id', $branchId);
                    }
                    // else: no filter = load all inventory rows for this product
                },
            ])
            ->when($request->search, fn ($q, $s) => $q->search($s))
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
            'category',
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
        $product = $this->productService->create($request->validated());

        return $this->created(
            new ProductResource($product->load('category', 'supplier')),
            'Product created'
        );
    }

    /**
     * GET /api/products/{product}
     */
    public function show(Product $product): JsonResponse
    {
        $product->load([
            'category',
            'supplier',
            'media',
            'inventory',
            'priceHistory' => fn ($q) => $q->latest()->limit(10),
        ]);

        return $this->success(new ProductResource($product));
    }

    /**
     * PUT /api/products/{product}
     */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product = $this->productService->update($product, $request->validated(), $request->user());

        return $this->success(
            new ProductResource($product->load('category', 'supplier')),
            'Product updated'
        );
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
     * POST /api/products/bulk-price-update
     */
    public function bulkPriceUpdate(BulkPriceUpdateRequest $request): JsonResponse
    {
        $updated = $this->productService->bulkPriceUpdate(
            $request->validated(),
            $request->user()
        );

        return $this->success(
            ['updated_count' => $updated],
            "Updated {$updated} product prices"
        );
    }

    /**
     * POST /api/products/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);

        $result = $this->productService->importFromCsv(
            $request->file('file'),
            $request->user()
        );

        return $this->success(
            $result,
            "Import complete: {$result['imported']} products, {$result['skipped']} skipped"
        );
    }

    /**
     * POST /api/products/{product}/image
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:2048']);

        $product->addMediaFromRequest('image')->toMediaCollection('images');

        return $this->success(
            ['thumbnail_url' => $product->getFirstMediaUrl('images')],
            'Image uploaded'
        );
    }

    /**
     * PATCH /api/products/{product}/price
     * Individual product price update with price history log.
     */
    public function updatePrice(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'selling_price' => 'required|numeric|min:0',
        ]);

        $newPrice = (float) $validated['selling_price'];

        if ($product->selling_price == $newPrice) {
            return $this->success(new ProductResource($product), 'Price is already up to date.');
        }

        $oldPrice = $product->selling_price;

        DB::transaction(function () use ($product, $oldPrice, $newPrice, $request) {
            $product->update(['selling_price' => $newPrice]);

            DB::table('price_history')->insert([
                'product_id'    => $product->id,
                'old_price'     => $oldPrice,
                'new_price'     => $newPrice,
                'changed_by'    => $request->user()?->id,
                'effective_at'  => now(),
                'change_type'   => 'manual',
                'change_reason' => 'Price updated manually',
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        });

        return $this->success(
            new ProductResource($product->fresh(['category', 'supplier'])),
            'Price updated successfully.'
        );
    }

    /**
     * GET /api/products/export
     * Export full product catalogue as CSV download.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $branchId = $request->branch_id;

        $products = Product::with(['category', 'supplier', 'inventory' => function ($q) use ($branchId) {
            if ($branchId) {
                $q->where('branch_id', $branchId);
            }
        }])->active()->orderBy('name')->get();

        $columns = ['Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost Price', 'Selling Price', 'Unit', 'Reorder Level', 'Stock', 'Active'];

        return response()->streamDownload(function () use ($products, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);
            foreach ($products as $p) {
                $stock = $p->inventory->sum('quantity');
                fputcsv($handle, [
                    $p->name, $p->sku ?? '', $p->barcode ?? '',
                    $p->category?->name ?? '', $p->supplier?->name ?? '',
                    $p->cost_price, $p->selling_price,
                    $p->unit ?? '', $p->reorder_level ?? '',
                    $stock, $p->is_active ? 'Yes' : 'No',
                ]);
            }
            fclose($handle);
        }, 'edlp-products-' . now()->format('Y-m-d') . '.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * POST /api/products/import/preview
     * Returns first 10 rows of uploaded CSV for preview before import.
     */
    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt']);

        $path    = $request->file('file')->getRealPath();
        $handle  = fopen($path, 'r');
        $headers = fgetcsv($handle);
        $rows    = [];
        $count   = 0;

        while (($row = fgetcsv($handle)) !== false && $count < 10) {
            $rows[] = $row;
            $count++;
        }

        fclose($handle);

        return $this->success(['headers' => $headers, 'rows' => $rows, 'total_preview' => $count]);
    }
}
