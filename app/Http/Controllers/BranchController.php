<?php

namespace App\Http\Controllers;

use App\Http\Requests\Branch\StoreBranchRequest;
use App\Http\Requests\Branch\UpdateBranchRequest;
use App\Http\Resources\BranchResource;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    /**
     * GET /api/branches
     */
    public function index(Request $request): JsonResponse
    {
        $query = Branch::with('manager')
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->when($request->search, fn ($q, $s) => $q->where('name', 'LIKE', "%{$s}%"))
            ->orderBy('is_head_office', 'desc')
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->success(BranchResource::collection($query->get()));
        }

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 15)));
    }

    /**
     * POST /api/branches
     */
    public function store(StoreBranchRequest $request): JsonResponse
    {
        $branch = Branch::create($request->validated());

        return $this->created(new BranchResource($branch), 'Branch created successfully');
    }

    /**
     * GET /api/branches/{branch}
     */
    public function show(Branch $branch): JsonResponse
    {
        $branch->load(['manager', 'users']);

        return $this->success(new BranchResource($branch));
    }

    /**
     * PUT /api/branches/{branch}
     */
    public function update(UpdateBranchRequest $request, Branch $branch): JsonResponse
    {
        $branch->update($request->validated());

        return $this->success(new BranchResource($branch->fresh('manager')), 'Branch updated');
    }

    /**
     * DELETE /api/branches/{branch}
     */
    public function destroy(Branch $branch): JsonResponse
    {
        if ($branch->is_head_office) {
            return $this->error('Cannot delete the Head Office branch', 422);
        }

        if ($branch->users()->active()->exists()) {
            return $this->error('Cannot delete a branch with active users', 422);
        }

        $branch->delete();

        return $this->success(null, 'Branch deleted successfully');
    }

    /**
     * GET /api/branches/{branch}/stats
     */
    public function stats(Branch $branch): JsonResponse
    {
        $today = today();

        $stats = [
            'today_sales'       => $branch->sales()->completed()->whereDate('created_at', $today)->sum('total'),
            'today_transactions' => $branch->sales()->completed()->whereDate('created_at', $today)->count(),
            'active_cashiers'   => $branch->cashierSessions()->open()->count(),
            'low_stock_count'   => $branch->inventory()->lowStock()->count(),
            'active_users'      => $branch->users()->active()->count(),
        ];

        return $this->success($stats);
    }
}
