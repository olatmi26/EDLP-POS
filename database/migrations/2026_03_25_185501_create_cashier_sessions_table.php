<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->decimal('opening_float', 12, 2)->default(0);
            $table->decimal('closing_cash', 12, 2)->nullable();
            $table->decimal('expected_cash', 12, 2)->nullable();
            $table->decimal('cash_variance', 12, 2)->nullable();
            $table->decimal('total_sales', 12, 2)->default(0);
            $table->decimal('total_cash_sales', 12, 2)->default(0);
            $table->decimal('total_pos_sales', 12, 2)->default(0);
            $table->decimal('total_transfer_sales', 12, 2)->default(0);
            $table->unsignedInteger('transaction_count')->default(0);
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index('opened_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cashier_sessions');
    }
};
