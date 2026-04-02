<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BrandController extends Controller
{
    /**
     * GET /api/brands
     */
    public function index(Request $request): JsonResponse
    {
        $query = Brand::withCount('products')
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->when($request->search, fn ($q, $s) => $q->where('name', 'LIKE', "%{$s}%"))
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success($query->get());
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/brands
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100|unique:brands,name',
            'description' => 'nullable|string|max:500',
            'website'     => 'nullable|url|max:255',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        $data['slug']      = Str::slug($data['name']);
        $data['is_active'] = $data['is_active'] ?? true;

        $brand = Brand::create($data);

        return $this->created($brand->loadCount('products'), 'Brand created');
    }

    /**
     * GET /api/brands/{brand}
     */
    public function show(Brand $brand): JsonResponse
    {
        return $this->success($brand->loadCount('products'));
    }

    /**
     * PUT /api/brands/{brand}
     */
    public function update(Request $request, Brand $brand): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100|unique:brands,name,' . $brand->id,
            'description' => 'nullable|string|max:500',
            'website'     => 'nullable|url|max:255',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        if (isset($data['name']) && $data['name'] !== $brand->name) {
            $data['slug'] = Str::slug($data['name']);
        }

        $brand->update($data);

        return $this->success($brand->fresh()->loadCount('products'), 'Brand updated');
    }

    /**
     * DELETE /api/brands/{brand}
     */
    public function destroy(Brand $brand): JsonResponse
    {
        if ($brand->products()->exists()) {
            return $this->error(
                "Cannot delete \"{$brand->name}\" — it has products assigned. Reassign them first.",
                422
            );
        }

        $brand->delete();

        return $this->success(null, 'Brand deleted');
    }
}
