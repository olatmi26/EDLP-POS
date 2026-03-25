<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Laravel CORS — configured for decoupled React SPA
    |--------------------------------------------------------------------------
    | Allows the React frontend (Vite dev server, production CDN, and the
    | C++ WebView2 desktop host loading from file://) to call the API.
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',   // Vite dev server
        'http://localhost:3000',   // alternative dev port
        env('FRONTEND_URL', 'http://localhost:5173'),
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    /*
    | Credentials must be true for Sanctum cookie-based auth.
    | For token-based (what we are using), false is fine and simpler.
    */
    'supports_credentials' => true,

];