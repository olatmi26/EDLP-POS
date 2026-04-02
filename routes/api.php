<?php

use App\Http\Controllers\AccountingController;
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProductBatchController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WholesaleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| EDLP POS — API Routes v1.2
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

    // ── Auth management ───────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::delete('/logout',      [AuthController::class, 'logout']);
        Route::post('/switch-branch', [AuthController::class, 'switchBranch']);
    });

    Route::get('/me', [AuthController::class, 'me']);

    // ── Branches ──────────────────────────────────────────────────────────────
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

    // ── Categories (read-only — used by Products page filter) ─────────────────
    Route::get('categories', function (\Illuminate\Http\Request $request) {
        $cats = \App\Models\Category::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'parent_id']);
        return response()->json(['success' => true, 'data' => $cats]);
    })->middleware('permission:products.view');

    // ── Products ──────────────────────────────────────────────────────────────
    // Specific routes BEFORE resource routes (avoid route collision)
    Route::get('products/search', [ProductController::class, 'search'])
        ->middleware('permission:products.view');
    Route::post('products/bulk-price-update', [ProductController::class, 'bulkPriceUpdate'])
        ->middleware('permission:products.price_update');
    Route::post('products/import', [ProductController::class, 'import'])
        ->middleware('permission:products.import');
    Route::post('products/import/preview', [ProductController::class, 'importPreview'])
        ->middleware('permission:products.view');
    Route::get('products/export', [ProductController::class, 'export'])
        ->middleware('permission:products.view');

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
    Route::patch('products/{product}/price', [ProductController::class, 'updatePrice'])
        ->middleware('permission:products.price_update');
    Route::delete('products/{product}', [ProductController::class, 'destroy'])
        ->middleware('permission:products.delete');
    Route::post('products/{product}/image', [ProductController::class, 'uploadImage'])
        ->middleware('permission:products.edit');

    // ── Inventory ─────────────────────────────────────────────────────────────
    Route::get('inventory', [InventoryController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('inventory/low-stock', [InventoryController::class, 'lowStock'])
        ->middleware('permission:inventory.view');
    Route::get('inventory/analytics', [InventoryController::class, 'analytics'])
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

    // ── Product Batches & Expiry (FEFO) ───────────────────────────────────────
    Route::prefix('batches')->middleware('permission:inventory.view')->group(function () {
        Route::get('near-expiry', [ProductBatchController::class, 'nearExpiry']);
        Route::get('disposals',   [ProductBatchController::class, 'disposalIndex']);
        Route::get('product/{productId}/active', [ProductBatchController::class, 'activeBatch']);

        Route::get('/',           [ProductBatchController::class, 'index']);
        Route::post('/',          [ProductBatchController::class, 'store'])
            ->middleware('permission:inventory.adjust');
        Route::get('{productBatch}', [ProductBatchController::class, 'show']);
        Route::post('disposals',  [ProductBatchController::class, 'requestDisposal'])
            ->middleware('permission:inventory.adjust');
    });

    // ── Stock Movements ───────────────────────────────────────────────────────
    Route::prefix('stock-movements')->group(function () {
        Route::get('reports/shrinkage', [StockMovementController::class, 'shrinkageReport'])
            ->middleware('permission:reports.view');
        Route::get('/',              [StockMovementController::class, 'index'])
            ->middleware('permission:inventory.view');
        Route::post('/',             [StockMovementController::class, 'store']); // Any authenticated user
        Route::get('{stockMovement}', [StockMovementController::class, 'show'])
            ->middleware('permission:inventory.view');
    });

    // ── Customers ─────────────────────────────────────────────────────────────
    Route::post('customers/merge',                      [CustomerController::class, 'merge']);
    Route::get('customers/{customer}/suggestions',      [CustomerController::class, 'suggestions']);
    Route::get('customers/{customer}/purchase-history', [CustomerController::class, 'purchaseHistory']);
    Route::apiResource('customers', CustomerController::class);

    // ── Users ─────────────────────────────────────────────────────────────────
    Route::post('users/{user}/avatar',         [UserController::class, 'uploadAvatar']);
    Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
    Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
    Route::get('users/{user}/sales-stats',     [UserController::class, 'salesStats']);
    Route::apiResource('users', UserController::class);

    // ── Roles & Permissions ───────────────────────────────────────────────────
    Route::middleware('role:super-admin|admin|branch-manager')->group(function () {
        Route::get('roles',                              [RolePermissionController::class, 'index']);
        Route::post('roles',                             [RolePermissionController::class, 'store']);
        Route::get('roles/{role}/permissions',           [RolePermissionController::class, 'rolePermissions']);
        Route::put('roles/{role}/permissions',           [RolePermissionController::class, 'syncRolePermissions']);
        Route::get('permissions',                        [RolePermissionController::class, 'allPermissions']);
        Route::post('permissions',                       [RolePermissionController::class, 'storePermission']);
    });

    // ── Suppliers & Purchase Orders ───────────────────────────────────────────
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

    // ── Approvals ─────────────────────────────────────────────────────────────
    Route::prefix('approvals')->group(function () {
        Route::get('inbox',         [ApprovalController::class, 'inbox']);
        Route::get('history',       [ApprovalController::class, 'history']);
        Route::get('pending-count', [ApprovalController::class, 'pendingCount']);
        Route::get('{approvalRequest}',          [ApprovalController::class, 'show']);
        Route::post('{approvalRequest}/decide',  [ApprovalController::class, 'decide']);
        Route::delete('{approvalRequest}/cancel', [ApprovalController::class, 'cancel']);
    });

    // ── Approval Workflow Configuration (Super Admin / Admin) ─────────────────
    Route::prefix('approval-workflows')->middleware('role:super-admin|admin')->group(function () {
        Route::get('/',                  [ApprovalController::class, 'workflowIndex']);
        Route::post('/',                 [ApprovalController::class, 'workflowStore']);
        Route::put('{approvalWorkflow}', [ApprovalController::class, 'workflowUpdate']);
    });

    // ── Promotions ────────────────────────────────────────────────────────────
    Route::prefix('promotions')->group(function () {
        Route::get('active', [PromotionController::class, 'active']);
        Route::get('/',      [PromotionController::class, 'index'])
            ->middleware('permission:products.view');
        Route::post('/',     [PromotionController::class, 'store'])
            ->middleware('permission:products.edit');
        Route::get('{promotion}',            [PromotionController::class, 'show'])
            ->middleware('permission:products.view');
        Route::put('{promotion}',            [PromotionController::class, 'update'])
            ->middleware('permission:products.edit');
        Route::delete('{promotion}',         [PromotionController::class, 'destroy'])
            ->middleware('permission:products.edit');
        Route::patch('{promotion}/pause',    [PromotionController::class, 'pause'])
            ->middleware('permission:products.edit');
        Route::patch('{promotion}/activate', [PromotionController::class, 'activate'])
            ->middleware('permission:products.edit');
        Route::post('{promotion}/coupons/generate', [PromotionController::class, 'generateCoupons'])
            ->middleware('permission:products.edit');
    });

    // ── Wholesale / B2B ───────────────────────────────────────────────────────
    Route::prefix('wholesale')->middleware('permission:sales.b2b')->group(function () {
        Route::get('customers',                         [WholesaleController::class, 'customerIndex']);
        Route::post('customers',                        [WholesaleController::class, 'customerStore']);
        Route::get('customers/{b2bCustomer}',           [WholesaleController::class, 'customerShow']);
        Route::put('customers/{b2bCustomer}',           [WholesaleController::class, 'customerUpdate']);
        Route::post('customers/{b2bCustomer}/payments', [WholesaleController::class, 'recordPayment']);

        Route::get('orders',                            [WholesaleController::class, 'orderIndex']);
        Route::post('orders',                           [WholesaleController::class, 'orderStore']);
        Route::get('orders/{wholesaleOrder}',           [WholesaleController::class, 'orderShow']);
        Route::patch('orders/{wholesaleOrder}/advance', [WholesaleController::class, 'advanceStatus']);
        Route::get('price-tiers',                       [WholesaleController::class, 'priceTiers']);
        Route::post('price-tiers',                      [WholesaleController::class, 'updatePriceTiers'])
            ->middleware('permission:products.price_update');
        Route::get('reports/aged-debt',                 [WholesaleController::class, 'agedDebtReport']);
    });

    // ── Accounting ────────────────────────────────────────────────────────────
    Route::prefix('accounting')->middleware('permission:accounting.view')->group(function () {
        Route::get('accounts',           [AccountingController::class, 'accountIndex']);
        Route::post('accounts',          [AccountingController::class, 'accountStore'])
            ->middleware('permission:accounting.ledger');
        Route::put('accounts/{account}', [AccountingController::class, 'accountUpdate'])
            ->middleware('permission:accounting.ledger');

        Route::get('journal-entries',                           [AccountingController::class, 'journalIndex']);
        Route::get('journal-entries/{journalEntry}',            [AccountingController::class, 'journalShow']);
        Route::post('journal-entries/{journalEntry}/reverse',   [AccountingController::class, 'journalReverse'])
            ->middleware('permission:accounting.journal');

        Route::get('trial-balance', [AccountingController::class, 'trialBalance']);

        Route::get('payment-queue', [AccountingController::class, 'paymentQueue']);
        Route::post('payment-queue/{approvalRequest}/confirm', [AccountingController::class, 'confirmPayment'])
            ->middleware('permission:accounting.make_payment');

        Route::get('etax/config/{branchId}',  [AccountingController::class, 'etaxConfig']);
        Route::post('etax/config/{branchId}', [AccountingController::class, 'etaxConfigUpdate'])
            ->middleware('permission:settings.edit');
        Route::get('etax/submissions',        [AccountingController::class, 'etaxSubmissions']);
        Route::post('etax/retry/{branchId}',  [AccountingController::class, 'etaxRetry']);
        Route::get('etax/verify/{fdn}',       [AccountingController::class, 'etaxVerify']);
    });


    // ── Categories ────────────────────────────────────────────────────────────
    Route::get("categories", [CategoryController::class, "index"])->middleware("permission:products.view");
    Route::post("categories", [CategoryController::class, "store"])->middleware("permission:products.create");
    Route::get("categories/{category}", [CategoryController::class, "show"])->middleware("permission:products.view");
    Route::put("categories/{category}", [CategoryController::class, "update"])->middleware("permission:products.edit");
    Route::patch("categories/{category}", [CategoryController::class, "update"])->middleware("permission:products.edit");
    Route::delete("categories/{category}", [CategoryController::class, "destroy"])->middleware("permission:products.delete");
    Route::patch("categories/{category}/toggle", [CategoryController::class, "toggle"])->middleware("permission:products.edit");

    // ── Brands ────────────────────────────────────────────────────────────────
    Route::get("brands", [BrandController::class, "index"])->middleware("permission:products.view");
    Route::post("brands", [BrandController::class, "store"])->middleware("permission:products.create");
    Route::get("brands/{brand}", [BrandController::class, "show"])->middleware("permission:products.view");
    Route::put("brands/{brand}", [BrandController::class, "update"])->middleware("permission:products.edit");
    Route::patch("brands/{brand}", [BrandController::class, "update"])->middleware("permission:products.edit");
    Route::delete("brands/{brand}", [BrandController::class, "destroy"])->middleware("permission:products.delete");

    // ── Units ─────────────────────────────────────────────────────────────────
    Route::get("units", [UnitController::class, "index"])->middleware("permission:products.view");
    Route::post("units", [UnitController::class, "store"])->middleware("permission:products.create");
    Route::put("units/{unit}", [UnitController::class, "update"])->middleware("permission:products.edit");
    Route::patch("units/{unit}", [UnitController::class, "update"])->middleware("permission:products.edit");
    Route::delete("units/{unit}", [UnitController::class, "destroy"])->middleware("permission:products.delete");

}); // end auth:sanctum
