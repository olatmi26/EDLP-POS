<?php

namespace App\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Disable the outer data wrapper on API resources
        // so the React frontend gets clean objects, not { data: { ... } }
        JsonResource::withoutWrapping();
    }
}
