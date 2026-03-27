<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\PinLoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * POST /api/auth/login
     * Email + password login — returns Sanctum token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::with('branch')
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return $this->error('Invalid credentials', 401);
        }

        if (! $user->is_active) {
            return $this->error('Your account has been deactivated. Contact your administrator.', 403);
        }

        $user->update(['last_login_at' => now()]);

        $token = $user->createToken('pos-session', $this->abilitiesFor($user))->plainTextToken;

        return $this->success([
            'token' => $token,
            'user'  => new UserResource($user),
        ], 'Login successful');
    }

    /**
     * POST /api/auth/login-pin
     * PIN-based fast login for cashiers — returns Sanctum token.
     */
    public function loginPin(PinLoginRequest $request): JsonResponse
    {
        $user = User::with('branch')
            ->where('staff_id', $request->staff_id)
            ->where('pin_login_enabled', true)
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->branch_id))
            ->first();

        if (! $user || ! Hash::check($request->pin, $user->pin)) {
            return $this->error('Invalid PIN or phone number', 401);
        }

        if (! $user->is_active) {
            return $this->error('Your account has been deactivated.', 403);
        }

        $user->update(['last_login_at' => now()]);

        $token = $user->createToken('pos-pin-session', $this->abilitiesFor($user))->plainTextToken;

        return $this->success([
            'token' => $token,
            'user'  => new UserResource($user),
        ], 'PIN login successful');
    }

    /**
     * DELETE /api/auth/logout
     * Revoke the current Sanctum token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Revoke the exact token Sanctum matched for this request.
        // `currentAccessToken()` can be unreliable in some test scenarios, so we
        // resolve by bearer token string instead.
        $bearerToken = $request->bearerToken();
        if ($bearerToken) {
            $personalToken = PersonalAccessToken::findToken($bearerToken);
            if ($personalToken) {
                $personalToken->delete();
            } else {
                $user->tokens()->delete();
            }
        } else {
            $user->tokens()->delete();
        }

        // Clear cached guard state (helps in PHPUnit request sequences).
        Auth::forgetGuards();

        return $this->success(null, 'Logged out successfully');
    }

    /**
     * GET /api/me
     * Return authenticated user with branch and roles.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['branch', 'roles', 'permissions']);

        return $this->success(new UserResource($user));
    }

    /**
     * POST /api/auth/switch-branch
     * Super-admin and admin only — switch active branch context.
     */
    public function switchBranch(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->isSuperAdmin() && ! $user->isAdmin()) {
            return $this->forbidden('Only Super Admins and Admins can switch branches');
        }

        $request->validate(['branch_id' => 'required|integer|exists:branches,id']);

        $user->update(['branch_id' => $request->branch_id]);
        $user->load('branch');

        return $this->success(new UserResource($user), 'Branch switched successfully');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function abilitiesFor(User $user): array
    {
        if ($user->isSuperAdmin()) {
            return ['*'];
        }

        if ($user->isAdmin()) {
            return ['admin', 'reports', 'pos', 'inventory', 'users'];
        }

        if ($user->isBranchManager()) {
            return ['manager', 'reports', 'pos', 'inventory'];
        }

        return ['pos'];
    }
}
