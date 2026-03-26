<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 20)->unique();          // e.g. HQ, BR01, BR02
            $table->enum('type', ['head_office', 'branch'])->default('branch');
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('manager_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('settings')->nullable();           // branch-specific config
            $table->timestamps();
            $table->softDeletes();

            $table->index('code');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
