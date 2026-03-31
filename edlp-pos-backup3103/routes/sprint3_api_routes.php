<?php

/**
 * EDLP POS — Sprint 3 API Routes
 * APPEND this block inside the auth:sanctum middleware group in routes/api.php
 *
 * Add these use statements at the top of routes/api.php:
 * use App\Http\Controllers\ApprovalController;
 * use App\Http\Controllers\PromotionController;
 * use App\Http\Controllers\WholesaleController;
 * use App\Http\Controllers\ExpiryController;
 * use App\Http\Controllers\StockMovementController;
 */

// ── Approvals ─────────────────────────────────────────────────────────────────
Route::prefix('approvals')->group(function () {
    Route::get('inbox',   [ApprovalController::class, 'inbox']);
    Route::get('history', [ApprovalController::class, 'history']);
    Route::get('pending-count', [ApprovalController::class, 'pendingCount']);
    Route::get('{approvalRequest}',          [ApprovalController::class, 'show']);
    Route::post('{approvalRequest}/decide',  [ApprovalController::class, 'decide']);
    Route::delete('{approvalRequest}/cancel',[ApprovalController::class, 'cancel']);
});

// ── Approval Workflow Configuration (Super Admin) ──────────────────────────────
Route::prefix('approval-workflows')->middleware('role:super-admin|admin')->group(function () {
    Route::get('/',                             [ApprovalController::class, 'workflowIndex']);
    Route::post('/',                            [ApprovalController::class, 'workflowStore']);
    Route::put('{approvalWorkflow}',            [ApprovalController::class, 'workflowUpdate']);
});

// ── Promotions ────────────────────────────────────────────────────────────────
Route::prefix('promotions')->group(function () {
    Route::get('active',                        [PromotionController::class, 'active']);
    Route::get('/',                             [PromotionController::class, 'index'])
        ->middleware('permission:products.view');
    Route::post('/',                            [PromotionController::class, 'store'])
        ->middleware('permission:products.edit');
    Route::get('{promotion}',                   [PromotionController::class, 'show'])
        ->middleware('permission:products.view');
    Route::put('{promotion}',                   [PromotionController::class, 'update'])
        ->middleware('permission:products.edit');
    Route::delete('{promotion}',                [PromotionController::class, 'destroy'])
        ->middleware('permission:products.edit');
    Route::patch('{promotion}/pause',           [PromotionController::class, 'pause'])
        ->middleware('permission:products.edit');
    Route::patch('{promotion}/activate',        [PromotionController::class, 'activate'])
        ->middleware('permission:products.edit');
    Route::post('{promotion}/coupons/generate', [PromotionController::class, 'generateCoupons'])
        ->middleware('permission:products.edit');
});

// ── Wholesale / B2B ───────────────────────────────────────────────────────────
Route::prefix('wholesale')->middleware('permission:sales.b2b')->group(function () {
    Route::apiResource('customers', WholesaleController::class . '@b2bCustomers', ['as' => 'wholesale.customers']);
    Route::get('customers',                     [WholesaleController::class, 'customerIndex']);
    Route::post('customers',                    [WholesaleController::class, 'customerStore']);
    Route::get('customers/{b2bCustomer}',       [WholesaleController::class, 'customerShow']);
    Route::put('customers/{b2bCustomer}',       [WholesaleController::class, 'customerUpdate']);
    Route::post('customers/{b2bCustomer}/payments', [WholesaleController::class, 'recordPayment']);

    Route::get('orders',                        [WholesaleController::class, 'orderIndex']);
    Route::post('orders',                       [WholesaleController::class, 'orderStore']);
    Route::get('orders/{wholesaleOrder}',       [WholesaleController::class, 'orderShow']);
    Route::patch('orders/{wholesaleOrder}/advance', [WholesaleController::class, 'advanceStatus']);
    Route::get('price-tiers',                   [WholesaleController::class, 'priceTiers']);
    Route::post('price-tiers',                  [WholesaleController::class, 'updatePriceTiers'])
        ->middleware('permission:products.price_update');
    Route::get('reports/aged-debt',             [WholesaleController::class, 'agedDebtReport']);
});

// ── Product Batches & Expiry (FEFO) ───────────────────────────────────────────
Route::prefix('batches')->middleware('permission:inventory.view')->group(function () {
    Route::get('/',                             [ExpiryController::class, 'index']);
    Route::post('/',                            [ExpiryController::class, 'store'])
        ->middleware('permission:inventory.adjust');
    Route::get('{productBatch}',                [ExpiryController::class, 'show']);
    Route::get('product/{productId}/active',    [ExpiryController::class, 'activeBatch']);
    Route::get('near-expiry',                   [ExpiryController::class, 'nearExpiry']);
    Route::post('disposals',                    [ExpiryController::class, 'requestDisposal'])
        ->middleware('permission:inventory.adjust');
    Route::get('disposals',                     [ExpiryController::class, 'disposalIndex']);
});

// ── Stock Movements ───────────────────────────────────────────────────────────
Route::prefix('stock-movements')->group(function () {
    Route::get('/',                             [StockMovementController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::post('/',                            [StockMovementController::class, 'store']);  // Any authenticated user
    Route::get('{stockMovement}',               [StockMovementController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::get('reports/shrinkage',             [StockMovementController::class, 'shrinkageReport'])
        ->middleware('permission:reports.view');
});
