<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\SupplierController;
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
    Route::get('branches', [BranchController::class, 'index'])
        ->middleware('permission:branches.view');
    Route::post('branches', [BranchController::class, 'store'])
        ->middleware('permission:branches.create');
    Route::get('branches/{branch}', [BranchController::class, 'show'])
        ->middleware('permission:branches.view');
    Route::put('branches/{branch}', [BranchController::class, 'update'])
        ->middleware('permission:branches.edit');
    Route::patch('branches/{branch}', [BranchController::class, 'update'])
        ->middleware('permission:branches.edit');
    Route::delete('branches/{branch}', [BranchController::class, 'destroy'])
        ->middleware('permission:branches.delete');
    Route::get('branches/{branch}/stats', [BranchController::class, 'stats'])
        ->middleware('permission:branches.view');

    // Products
    Route::get('products/search', [ProductController::class, 'search'])
        ->middleware('permission:products.view');
    Route::post('products/bulk-price-update', [ProductController::class, 'bulkPriceUpdate'])
        ->middleware('permission:products.price_update');
    Route::post('products/import', [ProductController::class, 'import'])
        ->middleware('permission:products.import');
    Route::post('products/{product}/image', [ProductController::class, 'uploadImage'])
        ->middleware('permission:products.edit');

    Route::get('products', [ProductController::class, 'index'])
        ->middleware('permission:products.view');
    Route::post('products', [ProductController::class, 'store'])
        ->middleware('permission:products.create');
    Route::get('products/{product}', [ProductController::class, 'show'])
        ->middleware('permission:products.view');
    Route::put('products/{product}', [ProductController::class, 'update'])
        ->middleware('permission:products.edit');
    Route::patch('products/{product}', [ProductController::class, 'update'])
        ->middleware('permission:products.edit');
    Route::delete('products/{product}', [ProductController::class, 'destroy'])
        ->middleware('permission:products.delete');

    // Inventory
    Route::get('inventory', [InventoryController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('inventory/low-stock', [InventoryController::class, 'lowStock'])
        ->middleware('permission:inventory.view');
    Route::get('inventory/product/{productId}', [InventoryController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::post('inventory/adjust', [InventoryController::class, 'adjust'])
        ->middleware('permission:inventory.adjust');
    Route::post('inventory/stock-take', [InventoryController::class, 'stockTake'])
        ->middleware('permission:inventory.stock_take');
    Route::post('inventory/transfer', [InventoryController::class, 'transfer'])
        ->middleware('permission:inventory.transfer');
    Route::patch('inventory/transfers/{transfer}/approve', [InventoryController::class, 'approveTransfer'])
        ->middleware('permission:inventory.approve');

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

    // Suppliers & Purchase Orders (Sprint 2)
    Route::get('suppliers', [SupplierController::class, 'index'])
        ->middleware('permission:purchase_orders.view');
    Route::post('suppliers', [SupplierController::class, 'store'])
        ->middleware('permission:purchase_orders.create');
    Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])
        ->middleware('permission:purchase_orders.view');
    Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])
        ->middleware('permission:purchase_orders.create');
    Route::patch('suppliers/{supplier}', [SupplierController::class, 'update'])
        ->middleware('permission:purchase_orders.create');
    Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])
        ->middleware('permission:purchase_orders.create');

    Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])
        ->middleware('permission:purchase_orders.view');
    Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])
        ->middleware('permission:purchase_orders.create');
    Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])
        ->middleware('permission:purchase_orders.view');
    Route::patch('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])
        ->middleware('permission:purchase_orders.approve');
    Route::patch('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])
        ->middleware('permission:purchase_orders.approve');
});
