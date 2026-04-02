<?php

namespace App\Http\Controllers;

use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    /**
     * GET /api/units
     */
    public function index(Request $request): JsonResponse
    {
        $query = Unit::withCount('products')
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->when($request->search, fn ($q, $s) => $q->where(
                fn ($inner) => $inner->where('name', 'LIKE', "%{$s}%")
                    ->orWhere('short_code', 'LIKE', "%{$s}%")
            ))
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success($query->get());
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 30)));
    }

    /**
     * POST /api/units
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:60',
            'short_code'  => 'required|string|max:20|unique:units,short_code',
            'description' => 'nullable|string|max:255',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        $data['is_active'] = $data['is_active'] ?? true;

        $unit = Unit::create($data);

        return $this->created($unit, 'Unit created');
    }

    /**
     * PUT /api/units/{unit}
     */
    public function update(Request $request, Unit $unit): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:60',
            'short_code'  => 'sometimes|string|max:20|unique:units,short_code,' . $unit->id,
            'description' => 'nullable|string|max:255',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        $unit->update($data);

        return $this->success($unit->fresh(), 'Unit updated');
    }

    /**
     * DELETE /api/units/{unit}
     */
    public function destroy(Unit $unit): JsonResponse
    {
        // Check products using this short_code as their unit string
        $productCount = \App\Models\Product::where('unit', $unit->short_code)->count();

        if ($productCount > 0) {
            return $this->error(
                "Cannot delete \"{$unit->name}\" — {$productCount} product(s) use this unit. Reassign them first.",
                422
            );
        }

        $unit->delete();

        return $this->success(null, 'Unit deleted');
    }
}
