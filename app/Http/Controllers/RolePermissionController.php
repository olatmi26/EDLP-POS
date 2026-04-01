<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ->orderBy('name')
            ->get()
            ->map(function ($r) {
                // Avoid using the Spatie "users" relation, which relies on a user
                // model class that is currently resolving to null and causing
                // "Class name must be a valid object or a string" errors.
                $usersCount = DB::table('model_has_roles')
                    ->where('role_id', $r->id)
                    ->count();
                return [
                    'id'                => $r->id,
                    'name'              => $r->name,
                    'permissions_count' => $r->permissions_count,
                    'users_count'       => $usersCount,
                    'permissions'       => $r->relationLoaded('permissions')
                        ? $r->permissions->map(fn ($p) => [
                            'id'   => $p->id,
                            'name' => $p->name,
                        ])->values()
                        : [],
                ];
            });

        return $this->success($roles);
    }

    /**
     * POST /api/roles
     * Create a new role for both sanctum and web guards.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:190',
            'description' => 'nullable|string|max:500',
        ]);

        // Ensure name is slug-like
        $name = str_replace(' ', '-', strtolower($data['name']));

        // Create sanctum role if not exists
        $sanctum = Role::firstOrCreate([
            'name'       => $name,
            'guard_name' => 'sanctum',
        ]);

        // Mirror in web guard for consistency
        Role::firstOrCreate([
            'name'       => $name,
            'guard_name' => 'web',
        ]);

        return $this->created([
            'id'   => $sanctum->id,
            'name' => $sanctum->name,
        ], 'Role created.');
    }

    /**
     * GET /api/roles/{role}/permissions
     * Returns the permissions granted to a specific role.
     */
    public function rolePermissions(string $roleName): JsonResponse
    {
        $role = Role::where('name', $roleName)
            ->where('guard_name', 'sanctum')
            ->first();

        // Prefer sanctum role; if missing, fall back to web guard
        if (! $role) {
            $role = Role::where('name', $roleName)
                ->where('guard_name', 'web')
                ->firstOrFail();
        }

        $granted = $role->permissions()
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

        // Base query: sanctum guard permissions only (mirrors web guard set)
        $all = Permission::query()
            ->where('guard_name', 'sanctum')
            ->orderBy('name')
            ->get();

        // Full permission objects grouped by module (for richer UIs, if needed)
        $permissions = $all->groupBy(fn ($p) => explode('.', $p->name)[0])
            ->map(fn ($group) => $group->map(fn ($p) => [
                'id'   => $p->id,
                'name' => $p->name,
            ])->values());

        // Simple grouped map of module => [permission name strings]
        $grouped = $all->groupBy(fn ($p) => explode('.', $p->name)[0])
            ->map(fn ($group) => $group
                ->map(fn ($p) => $p->name)
                ->values()
            )
            ->toArray();

        ksort($grouped);

        return $this->success([
            'super_admin' => (bool) $isSuperAdmin,
            'permissions' => $permissions,
            'grouped'     => $grouped,
        ]);
    }

    /**
     * POST /api/permissions
     * Create a new permission (both sanctum and web guards).
     */
    public function storePermission(Request $request): JsonResponse
    {
        $data = $request->validate([
            'module' => 'required|string|max:100',
            'action' => 'required|string|max:100',
        ]);

        $module = strtolower($data['module']);
        $action = strtolower($data['action']);
        $name   = "{$module}.{$action}";

        foreach (['sanctum', 'web'] as $guard) {
            Permission::firstOrCreate([
                'name'       => $name,
                'guard_name' => $guard,
            ]);
        }

        return $this->created([
            'name' => $name,
        ], 'Permission created.');
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
