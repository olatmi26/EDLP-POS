<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| EDLP POS — API Routes
| All routes return JSON. No Blade, no Inertia.
| Auth: Laravel Sanctum stateless tokens.
|--------------------------------------------------------------------------
*/

// ── Public routes (no auth required) ─────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/login',     [AuthController::class, 'login']);
    Route::post('/login-pin', [AuthController::class, 'loginPin']);
});

// ── Authenticated routes ──────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', \App\Http\Middleware\BranchScope::class])->group(function () {

    Route::prefix('auth')->group(function () {
        Route::delete('/logout',      [AuthController::class, 'logout']);
        Route::post('/switch-branch', [AuthController::class, 'switchBranch']);
    });

    Route::get('/me', [AuthController::class, 'me']);

    // Branches
    Route::apiResource('branches', BranchController::class);
    Route::get('branches/{branch}/stats', [BranchController::class, 'stats']);

    // Products
    Route::get('products/search',             [ProductController::class, 'search']);
    Route::post('products/bulk-price-update', [ProductController::class, 'bulkPriceUpdate']);
    Route::post('products/import',            [ProductController::class, 'import']);
    Route::post('products/{product}/image',   [ProductController::class, 'uploadImage']);
    Route::apiResource('products', ProductController::class);

    // Inventory
    Route::get('inventory',                               [InventoryController::class, 'index']);
    Route::get('inventory/low-stock',                     [InventoryController::class, 'lowStock']);
    Route::get('inventory/product/{productId}',           [InventoryController::class, 'show']);
    Route::post('inventory/adjust',                       [InventoryController::class, 'adjust']);
    Route::post('inventory/stock-take',                   [InventoryController::class, 'stockTake']);
    Route::post('inventory/transfer',                     [InventoryController::class, 'transfer']);
    Route::patch('inventory/transfers/{transfer}/approve',[InventoryController::class, 'approveTransfer']);

    // Customers
    Route::post('customers/merge',                      [CustomerController::class, 'merge']);
    Route::get('customers/{customer}/suggestions',      [CustomerController::class, 'suggestions']);
    Route::get('customers/{customer}/purchase-history', [CustomerController::class, 'purchaseHistory']);
    Route::apiResource('customers', CustomerController::class);

    // Users
    Route::post('users/{user}/avatar',         [UserController::class, 'uploadAvatar']);
    Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
    Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
    Route::apiResource('users', UserController::class);
});
