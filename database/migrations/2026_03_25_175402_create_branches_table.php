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
            $table->string('address')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_head_office')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('manager_id')->nullable();      // FK to users table
            $table->time('opening_time')->nullable();
            $table->time('closing_time')->nullable();
            $table->string('timezone')->nullable();
            $table->json('meta')->nullable();                          // branch-specific config or metadata
            $table->timestamps();
            $table->softDeletes();

            $table->index('code');
            $table->index('is_active');
            $table->index('manager_id');

            // Foreign key constraint for manager_id (if users table exists)
            $table->foreign('manager_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
