<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('movement_type'); // sampling|internal_use|staff_welfare|damaged|management_consumption|recalled
            $table->text('reason');
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('executed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->string('status')->default('pending'); // pending|approved|rejected|executed
            $table->timestamp('executed_at')->nullable();
            $table->decimal('estimated_cost_value', 12, 2)->default(0); // product.cost_price * quantity
            $table->timestamps();
            $table->softDeletes();

            $table->index(['branch_id', 'status']);
            $table->index('product_id');
            $table->index('movement_type');
            $table->index('approval_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
