<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('device_id')->nullable();                    // desktop machine identifier
            $table->enum('operation', [
                'CREATE_SALE', 'UPDATE_INVENTORY', 'CREATE_CUSTOMER',
                'UPDATE_CUSTOMER', 'CREATE_EXPENSE', 'STOCK_TAKE'
            ]);
            $table->string('model');                                    // e.g. Sale, Customer
            $table->uuid('local_id');
            $table->unsignedBigInteger('cloud_id')->nullable();
            $table->json('payload');
            $table->enum('status', ['pending', 'synced', 'failed', 'conflict'])->default('pending');
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->text('error_message')->nullable();
            $table->json('conflict_data')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->index('branch_id');
            $table->index('status');
            $table->index('local_id');
            $table->index('operation');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_logs');
    }
};
