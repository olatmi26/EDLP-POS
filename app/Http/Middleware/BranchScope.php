<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BranchScope
{
    /**
     * Enforce branch-scoped data access.
     *
     * Super-admins and admins see all branches.
     * Branch managers and cashiers only see their own branch.
     * The authenticated user's active branch_id is stored in the request
     * so controllers and services can access it via $request->branch_id.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Super-admins / admins may pass an explicit branch_id override
        if ($user->isSuperAdmin() || $user->isAdmin()) {
            // Allow explicit branch switching (set in auth controller switch-branch)
            if (! $request->has('branch_id')) {
                $request->merge(['branch_id' => $user->branch_id]);
            }
        } else {
            // Force branch to user's own branch — ignore any client-supplied value
            $request->merge(['branch_id' => $user->branch_id]);
        }

        return $next($request);
    }
}
