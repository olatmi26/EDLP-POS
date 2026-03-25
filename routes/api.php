<?php


use Illuminate\Support\Facades\Route;



/*
|--------------------------------------------------------------------------
| EDLP POS — API Routes
|--------------------------------------------------------------------------
| All routes are prefixed with /api automatically by bootstrap/app.php.
| Auth routes are public. Everything else requires a Sanctum token.
*/

// ── Public routes ────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('login',     [\App\Http\Controllers\Api\Auth\AuthController::class, 'login']);
    Route::post('login-pin', [\App\Http\Controllers\Api\Auth\AuthController::class, 'loginPin']);
});

// ── Authenticated routes ─────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::get('me',            [\App\Http\Controllers\Api\Auth\AuthController::class, 'me']);
        Route::delete('logout',     [\App\Http\Controllers\Api\Auth\AuthController::class, 'logout']);
        Route::post('switch-branch',[\App\Http\Controllers\Api\Auth\AuthController::class, 'switchBranch']);
    });

    // Branches
    Route::apiResource('branches', \App\Http\Controllers\Api\BranchController::class);

    // Users
    Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);

    // Products
    Route::get('products/search',   [\App\Http\Controllers\Api\ProductController::class, 'search']);
    Route::post('products/import',  [\App\Http\Controllers\Api\ProductController::class, 'import']);
    Route::post('products/bulk-price', [\App\Http\Controllers\Api\ProductController::class, 'bulkPrice']);
    Route::apiResource('products',  \App\Http\Controllers\Api\ProductController::class);

    // Categories
    Route::apiResource('categories', \App\Http\Controllers\Api\CategoryController::class);

    // Suppliers
    Route::apiResource('suppliers', \App\Http\Controllers\Api\SupplierController::class);

    // Inventory
    Route::get('inventory',                     [\App\Http\Controllers\Api\InventoryController::class, 'index']);
    Route::post('inventory/adjust',             [\App\Http\Controllers\Api\InventoryController::class, 'adjust']);
    Route::post('inventory/transfer',           [\App\Http\Controllers\Api\InventoryController::class, 'transfer']);
    Route::post('inventory/stock-take',         [\App\Http\Controllers\Api\InventoryController::class, 'stockTake']);

    // Customers
    Route::get('customers/{customer}/suggestions', [\App\Http\Controllers\Api\CustomerController::class, 'suggestions']);
    Route::post('customers/merge',                 [\App\Http\Controllers\Api\CustomerController::class, 'merge']);
    Route::apiResource('customers', \App\Http\Controllers\Api\CustomerController::class);

    // Sales
    Route::post('sales/{sale}/void',    [\App\Http\Controllers\Api\SaleController::class, 'void']);
    Route::post('sales/{sale}/refund',  [\App\Http\Controllers\Api\SaleController::class, 'refund']);
    Route::get('sales/{sale}/receipt',  [\App\Http\Controllers\Api\SaleController::class, 'receipt']);
    Route::apiResource('sales',         \App\Http\Controllers\Api\SaleController::class);

    // Cashier Sessions
    Route::post('sessions/open',    [\App\Http\Controllers\Api\CashierSessionController::class, 'open']);
    Route::post('sessions/close',   [\App\Http\Controllers\Api\CashierSessionController::class, 'close']);
    Route::get('sessions/current',  [\App\Http\Controllers\Api\CashierSessionController::class, 'current']);

    // Expenses
    Route::apiResource('expenses', \App\Http\Controllers\Api\ExpenseController::class);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('sales',              [\App\Http\Controllers\Api\ReportController::class, 'sales']);
        Route::get('inventory',          [\App\Http\Controllers\Api\ReportController::class, 'inventory']);
        Route::get('frequent-customers', [\App\Http\Controllers\Api\ReportController::class, 'frequentCustomers']);
        Route::get('insights',           [\App\Http\Controllers\Api\ReportController::class, 'insights']);
        Route::get('dashboard',          [\App\Http\Controllers\Api\ReportController::class, 'dashboard']);
    });

    // Notifications
    Route::get('notifications',           [\App\Http\Controllers\Api\NotificationController::class, 'index']);
    Route::post('notifications/read-all', [\App\Http\Controllers\Api\NotificationController::class, 'readAll']);
    Route::patch('notifications/{id}/read', [\App\Http\Controllers\Api\NotificationController::class, 'markRead']);

    // Offline Sync
    Route::prefix('sync')->group(function () {
        Route::post('push', [\App\Http\Controllers\Api\SyncController::class, 'push']);
        Route::get('pull',  [\App\Http\Controllers\Api\SyncController::class, 'pull']);
    });

});
