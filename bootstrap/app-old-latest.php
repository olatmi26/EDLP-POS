<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {

        // Trust all proxies (needed for HTTPS on VPS behind Nginx)
        $middleware->trustProxies(at: '*');

        // Sanctum stateful domains for SPA cookie auth (optional, we use tokens)
        $middleware->statefulApi();

        // API middleware group
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        // Aliases for route middleware
        $middleware->alias([
            'branch.scope' => \App\Http\Middleware\BranchScope::class,
            'ability'     => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
            'ability.one' => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class,
            'role'        => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'  => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role.or.permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);

    })
    ->withExceptions(function (Exceptions $exceptions) {

        // Return JSON for all API exceptions (no HTML error pages)
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // Unauthenticated → 401 JSON
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });

        // Unauthorized → 403 JSON
        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden.',
                ], 403);
            }
        });

        // Validation → 422 JSON
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors'  => $e->errors(),
                ], 422);
            }
        });

        // Model not found → 404 JSON
        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource not found.',
                ], 404);
            }
        });

    })->create();