<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend'   => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses'      => [
        'key'    => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack'    => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel'              => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'firs'     => [
        'public_key'     => env('FIRS_PUBLIC'),
        'secret_key'     => env('FIRS_SECRET'),
        'api_url'        => env('FIRS_API_URL'),
        'sandbox_url'    => env('FIRS_SANDBOX_URL', 'https://etax.firs.gov.ng/api/sandbox/v1'),
        'production_url' => env('FIRS_PRODUCTION_URL', 'https://etax.firs.gov.ng/api/v1'),
    ],    

];
