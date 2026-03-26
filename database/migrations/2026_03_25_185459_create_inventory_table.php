<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            $table->integer('reserved_quantity')->default(0);           // held for pending orders
            $table->enum('status', ['ok', 'low', 'out'])->default('ok');
            $table->timestamp('last_counted_at')->nullable();
            $table->foreignId('last_counted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'branch_id']);
            $table->index('branch_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
