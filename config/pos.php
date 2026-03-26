<?php

return [

    /*
    |--------------------------------------------------------------------------
    | EDLP POS — Application Config
    |--------------------------------------------------------------------------
    */

    'vat_rate' => env('POS_VAT_RATE', 7.5),

    'currency' => [
        'code'   => 'NGN',
        'symbol' => '₦',
        'locale' => 'en-NG',
    ],

    'sale_hold' => [
        'max_per_session' => 10,
        'expires_minutes' => 480,  // 8 hours — auto-expire held sales
    ],

    'cashier_session' => [
        'auto_close_hours' => 12,
    ],

    'sync' => [
        'batch_size'       => 100,
        'max_attempts'     => 3,
        'backoff_seconds'  => [1, 2, 4],
    ],

    'ai' => [
        'suggestion_ttl'       => 3600,   // 1 hour Redis TTL for POS suggestions
        'frequent_customer_ttl' => 900,   // 15 min TTL for leaderboard
        'dashboard_stats_ttl'  => 300,    // 5 min TTL for dashboard stats
        'product_search_ttl'   => 120,    // 2 min TTL for product search cache
        'top_products_count'   => 10,
    ],

    'receipts' => [
        'paper_width_mm' => 80,
        'logo_path'      => public_path('images/edlp-logo.png'),
    ],

    'low_stock_threshold' => env('LOW_STOCK_THRESHOLD', 5),

    'pagination' => [
        'default' => 20,
        'max'     => 100,
    ],

];
