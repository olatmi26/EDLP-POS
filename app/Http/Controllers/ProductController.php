<?php

namespace App\Http\Controllers;

use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Requests\Product\BulkPriceUpdateRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\PriceHistory;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $productService) {}

    /**
     * GET /api/products
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'supplier'])
            ->when($request->search, fn ($q, $s) => $q->search($s))
            ->when($request->category_id, fn ($q, $id) => $q->forCategory((int) $id))
            ->when($request->supplier_id, fn ($q, $id) => $q->forSupplier((int) $id))
            ->when($request->boolean('active_only', true), fn ($q) => $q->active())
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success(ProductResource::collection($query->get()));
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/products/search
     * Optimised endpoint for POS barcode/text search — returns stock for branch.
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

        return $this->created(new ProductResource($product->load('category', 'supplier')), 'Product created');
    }

    /**
     * GET /api/products/{product}
     */
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'supplier', 'media', 'priceHistory' => fn ($q) => $q->latest()->limit(10)]);

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
            return $this->error('Cannot delete a product with sales history. Deactivate it instead.', 422);
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

        return $this->success(['updated_count' => $updated], "Updated {$updated} product prices");
    }

    /**
     * POST /api/products/import
     * CSV import of products.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);

        $result = $this->productService->importFromCsv($request->file('file'), $request->user());

        return $this->success($result, "Import complete: {$result['imported']} products, {$result['skipped']} skipped");
    }

    /**
     * POST /api/products/{product}/image
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:2048']);

        $product->addMediaFromRequest('image')->toMediaCollection('images');

        return $this->success([
            'thumbnail_url' => $product->getFirstMediaUrl('images'),
        ], 'Image uploaded');
    }
}
