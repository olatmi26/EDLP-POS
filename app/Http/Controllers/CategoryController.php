<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    /**
     * GET /api/categories
     * Returns all categories, optionally with children nested.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Category::withCount('products')
            ->when($request->boolean('active_only', false), fn ($q) => $q->active())
            ->when($request->boolean('top_level', false), fn ($q) => $q->topLevel())
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('nested')) {
            // Return tree structure: parents with children embedded
            $parents = (clone $query)->whereNull('parent_id')
                ->with(['children' => fn ($q) => $q->withCount('products')->orderBy('sort_order')->orderBy('name')])
                ->get();
            return $this->success($parents);
        }

        if ($request->boolean('all')) {
            return $this->success($query->get());
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 30)));
    }

    /**
     * POST /api/categories
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'parent_id'   => 'nullable|integer|exists:categories,id',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        $data['slug']      = Str::slug($data['name']);
        $data['is_active'] = $data['is_active'] ?? true;

        // Ensure slug uniqueness
        $baseSlug = $data['slug'];
        $count    = 0;
        while (Category::where('slug', $data['slug'])->exists()) {
            $count++;
            $data['slug'] = $baseSlug . '-' . $count;
        }

        $category = Category::create($data);

        return $this->created($category->loadCount('products'), 'Category created');
    }

    /**
     * GET /api/categories/{category}
     */
    public function show(Category $category): JsonResponse
    {
        $category->load('parent', 'children')->loadCount('products');
        return $this->success($category);
    }

    /**
     * PUT /api/categories/{category}
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'parent_id'   => 'nullable|integer|exists:categories,id',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        // Prevent category becoming its own parent
        if (isset($data['parent_id']) && $data['parent_id'] === $category->id) {
            return $this->error('A category cannot be its own parent.', 422);
        }

        if (isset($data['name']) && $data['name'] !== $category->name) {
            $data['slug'] = Str::slug($data['name']);
            $baseSlug     = $data['slug'];
            $count        = 0;
            while (Category::where('slug', $data['slug'])->where('id', '!=', $category->id)->exists()) {
                $count++;
                $data['slug'] = $baseSlug . '-' . $count;
            }
        }

        $category->update($data);

        return $this->success($category->fresh()->loadCount('products'), 'Category updated');
    }

    /**
     * DELETE /api/categories/{category}
     */
    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->exists()) {
            return $this->error(
                "Cannot delete \"{$category->name}\" — it has products assigned. Reassign or delete them first.",
                422
            );
        }

        if ($category->children()->exists()) {
            return $this->error(
                "Cannot delete \"{$category->name}\" — it has sub-categories. Delete or reassign them first.",
                422
            );
        }

        $category->delete();

        return $this->success(null, 'Category deleted');
    }

    /**
     * PATCH /api/categories/{category}/toggle
     * Toggle active/inactive.
     */
    public function toggle(Category $category): JsonResponse
    {
        $category->update(['is_active' => ! $category->is_active]);

        return $this->success(
            $category->fresh()->loadCount('products'),
            $category->is_active ? 'Category activated' : 'Category deactivated'
        );
    }
}
