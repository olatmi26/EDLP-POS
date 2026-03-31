<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CORS Configuration — EDLP POS
    |--------------------------------------------------------------------------
    | Allows the decoupled React SPA to call the Laravel API from:
    |  - localhost:5173 (Vite dev server)
    |  - Staging domain
    |  - Production CDN
    |  - Desktop app (file:// URI — WebView2)
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter([
        'http://localhost:5173',
        'http://localhost:3000',
        env('FRONTEND_URL'),
        env('CDN_URL'),
    ]),

    // Allow file:// for C++ WebView2 desktop app
    /* 'allowed_origins_patterns' => [
        '/^file:\/\//',
        '/^https?:\/\/.*\.edlpnigeria\.com$/',
    ], */
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],

    'max_age' => 0,

     /*
    | Credentials must be true for Sanctum cookie-based auth.
    | For token-based (what we are using), false is fine and simpler.
    */
    'supports_credentials' => true,

];
