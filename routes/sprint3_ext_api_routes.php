<?php

/**
 * EDLP POS — Sprint 3 Extension API Routes
 *
 * ADD these use statements at the top of routes/api.php:
 * use App\Http\Controllers\AccountingController;
 *
 * APPEND this block inside the auth:sanctum middleware group in routes/api.php
 */

// ── Accounting — Chart of Accounts ────────────────────────────────────────────
Route::prefix('accounting')->middleware('permission:accounting.view')->group(function () {

    // Chart of Accounts
    Route::get('accounts',              [AccountingController::class, 'accountIndex']);
    Route::post('accounts',             [AccountingController::class, 'accountStore'])
        ->middleware('permission:accounting.ledger');
    Route::put('accounts/{account}',    [AccountingController::class, 'accountUpdate'])
        ->middleware('permission:accounting.ledger');

    // Journal Entries / Vouchers
    Route::get('journal-entries',       [AccountingController::class, 'journalIndex']);
    Route::get('journal-entries/{journalEntry}', [AccountingController::class, 'journalShow']);
    Route::post('journal-entries/{journalEntry}/reverse', [AccountingController::class, 'journalReverse'])
        ->middleware('permission:accounting.journal');

    // Trial Balance
    Route::get('trial-balance',         [AccountingController::class, 'trialBalance']);

    // Payment Queue (payable accountant workflow)
    Route::get('payment-queue',         [AccountingController::class, 'paymentQueue']);
    Route::post('payment-queue/{approvalRequest}/confirm', [AccountingController::class, 'confirmPayment'])
        ->middleware('permission:accounting.make_payment');

    // eTax / FIRS Compliance
    Route::get('etax/config/{branchId}',    [AccountingController::class, 'etaxConfig']);
    Route::post('etax/config/{branchId}',   [AccountingController::class, 'etaxConfigUpdate'])
        ->middleware('permission:settings.edit');
    Route::get('etax/submissions',           [AccountingController::class, 'etaxSubmissions']);
    Route::post('etax/retry/{branchId}',    [AccountingController::class, 'etaxRetry']);
    Route::get('etax/verify/{fdn}',         [AccountingController::class, 'etaxVerify']);
});
