<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * RolePermissionController
 *
 * Provides API endpoints for managing roles and permissions.
 * All endpoints require super-admin or admin role.
 *
 * Routes (added to api.php under auth:sanctum middleware):
 *   GET  /api/roles                         – list all roles with their permission counts
 *   GET  /api/roles/{role}/permissions      – list permissions granted to a role
 *   PUT  /api/roles/{role}/permissions      – sync permissions for a role
 *   GET  /api/permissions                   – list all defined permissions (grouped by module)
 */
class RolePermissionController extends Controller
{
    /**
     * GET /api/roles
     * Returns all roles (sanctum guard) with permission count and member count.
     */
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->where('guard_name', 'sanctum')
            ->withCount('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn ($r) => [
                'id'               => $r->id,
                'name'             => $r->name,
                'permissions_count'=> $r->permissions_count,
                'users_count'      => $r->users_count,
                'permissions'      => $r->whenLoaded('permissions', fn() => $r->permissions->map(fn($p) => [
                        'id'   => $p->id,
                        'name' => $p->name,
                    ])),
            ]);

        return $this->success($roles);
    }

    /**
     * GET /api/roles/{role}/permissions
     * Returns the permissions granted to a specific role.
     */
    public function rolePermissions(string $roleName): JsonResponse
    {
        $role = Role::where('name', $roleName)
            ->where('guard_name', 'sanctum')
            ->firstOrFail();

        $granted = $role->permissions()
            ->where('guard_name', 'sanctum')
            ->pluck('name')
            ->values();

        return $this->success([
            'role'        => $role->name,
            'permissions' => $granted,
        ]);
    }

    /**
     * PUT /api/roles/{role}/permissions
     * Sync (replace) the full permission set for a role.
     * Only super-admin may call this.
     *
     * Body: { "permissions": ["products.view", "sales.create", ...] }
     */
    public function syncRolePermissions(Request $request, string $roleName): JsonResponse
    {
        // Guard: only super-admin
        if (! $request->user()?->hasRole('super-admin')) {
            return $this->error('Only Super Admin can modify role permissions.', 403);
        }

        $request->validate([
            'permissions'   => 'required|array',
            'permissions.*' => 'string',
        ]);

        $role = Role::where('name', $roleName)
            ->where('guard_name', 'sanctum')
            ->firstOrFail();

        // Prevent stripping all perms from super-admin accidentally
        if ($roleName === 'super-admin') {
            return $this->error('Super Admin permissions are managed automatically.', 422);
        }

        // Resolve only existing sanctum permissions
        $permissions = Permission::where('guard_name', 'sanctum')
            ->whereIn('name', $request->permissions)
            ->get();

        $role->syncPermissions($permissions);

        // Also sync the web guard mirror
        $webRole = Role::where('name', $roleName)->where('guard_name', 'web')->first();
        if ($webRole) {
            $webPerms = Permission::where('guard_name', 'web')
                ->whereIn('name', $request->permissions)
                ->get();
            $webRole->syncPermissions($webPerms);
        }

        // Clear Spatie permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return $this->success([
            'role'        => $role->name,
            'permissions' => $role->permissions()->pluck('name')->values(),
        ], "Permissions updated for role: {$roleName}");
    }

    /**
     * GET /api/permissions
     * Returns all defined permissions grouped by module prefix.
     */
    public function allPermissions(Request $request): JsonResponse
    {
        $isSuperAdmin = $request->user()?->hasRole('super-admin');
        $permissions = Permission::all()->where('guard_name', 'sanctum')->groupBy(fn($p) => explode('.', $p->name)[0]) 
        ->map(fn($group) => $group->map(fn($p) => [
            'id'   => $p->id,
            'name' => $p->name,
        ])->values());
        
          

        // Group by module prefix (e.g. "products.view" → group "products")
        $grouped = [];
        foreach ($permissions as $perm) {
            $parts  = explode('.', $perm, 2);
            $module = $parts[0];
            $grouped[$module][] = $perm;
        }

        // Sort modules
        ksort($grouped);

        return $this->success([
            'permissions' => $permissions,
            'grouped'     => $grouped,
        ]);
    }



    public function assignToRole(Request $request, string $roleName): JsonResponse
    {
        // Only super-admin can modify
        if (! $request->user()?->hasRole('super-admin')) {
            return $this->error('Only Super Admin can modify role permissions.', 403);
        }

        $role = Role::where('name', $roleName)
            ->where('guard_name', 'sanctum')
            ->firstOrFail();

        $request->validate([
            'permissions'   => 'required|array',
            'permissions.*' => 'string',
        ]);

        $permissions = Permission::where('guard_name', 'sanctum')
            ->whereIn('name', $request->permissions)
            ->get();
        $role->syncPermissions($request->input('permissions', []));

        return $this->success(null, 'Permissions updated.');
    }
}
