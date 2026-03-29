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

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $productService) {}

    /**
     * GET /api/products
     * Now eager-loads inventory for the request branch so stock level shows in the product list.
     * Admins, Super Admins, and CEOs see all inventory per product (all branches).
     */
    public function index(Request $request): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;

        // Identify admin, super-admin, or ceo user roles
        $elevated = $user && ($user->hasRole('super-admin') || $user->hasRole('admin') || $user->hasRole('ceo'));

        $query = Product::with([
                'category',
                'supplier',
                // For elevated users, load all inventory; others, load inventory for the user's branch
                'inventory' => function ($q) use ($branchId, $elevated) {
                    if ($elevated) {
                        return $q;
                    }
                    return $branchId ? $q->where('branch_id', (int) $branchId) : $q;
                },
            ])
            ->when($request->search,       fn ($q, $s)  => $q->search($s))
            ->when($request->category_id,  fn ($q, $id) => $q->forCategory((int) $id))
            ->when($request->supplier_id,  fn ($q, $id) => $q->forSupplier((int) $id))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)))
            ->when(! $request->filled('is_active'), fn ($q) => $q->active())
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success(ProductResource::collection($query->get()));
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/products/search — POS barcode/text search with branch stock.
     * Admins, Super Admins, and CEOs see all inventory per found product.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate(['q' => 'required|string|min:1']);
        $user     = $request->user();
        $branchId = $request->branch_id;
        $elevated = $user && ($user->hasRole('super-admin') || $user->hasRole('admin') || $user->hasRole('ceo'));

        $products = Product::with([
                'category',
                'inventory' => function ($q) use ($branchId, $elevated) {
                    if ($elevated) {
                        return $q;
                    }
                    return $q->where('branch_id', (int) $branchId);
                },
            ])
            ->active()
            ->search($request->q)
            ->limit(20)
            ->get();

        return $this->success(ProductResource::collection($products));
    }

    /** POST /api/products */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = $this->productService->create($request->validated());
        return $this->created(new ProductResource($product->load('category', 'supplier')), 'Product created');
    }

    /** GET /api/products/{product} */
    public function show(Request $request, Product $product): JsonResponse
    {
        $user     = $request->user();
        $branchId = $request->branch_id;
        $elevated = $user && ($user->hasRole('super-admin') || $user->hasRole('admin') || $user->hasRole('ceo'));

        $product->load([
            'category', 'supplier', 'media',
            'inventory' => function($q) use ($branchId, $elevated) {
                if ($elevated) {
                    return $q;
                }
                return $branchId ? $q->where('branch_id', (int) $branchId) : $q;
            },
            'priceHistory' => fn ($q) => $q->latest()->limit(10),
        ]);
        return $this->success(new ProductResource($product));
    }

    /** PUT /api/products/{product} */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product = $this->productService->update($product, $request->validated(), $request->user());
        return $this->success(new ProductResource($product->load('category', 'supplier')), 'Product updated');
    }

    /** DELETE /api/products/{product} */
    public function destroy(Product $product): JsonResponse
    {
        if ($product->saleItems()->exists()) {
            return $this->error('Cannot delete a product with sales history. Deactivate it instead.', 422);
        }
        $product->delete();
        return $this->success(null, 'Product deleted');
    }

    /** POST /api/products/bulk-price-update */
    public function bulkPriceUpdate(BulkPriceUpdateRequest $request): JsonResponse
    {
        $updated = $this->productService->bulkPriceUpdate($request->validated(), $request->user());
        return $this->success(['updated_count' => $updated], "Updated {$updated} product prices");
    }

    /** POST /api/products/import */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $result = $this->productService->importFromCsv($request->file('file'), $request->user());
        return $this->success($result, "Import complete: {$result['imported']} products, {$result['skipped']} skipped");
    }

    /** POST /api/products/{product}/image */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:2048']);
        $product->addMediaFromRequest('image')->toMediaCollection('images');
        return $this->success(['thumbnail_url' => $product->getFirstMediaUrl('images')], 'Image uploaded');
    }
}
