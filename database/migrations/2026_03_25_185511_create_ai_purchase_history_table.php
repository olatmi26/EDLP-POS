<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_purchase_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedInteger('frequency')->default(1);           // how many times purchased
            $table->decimal('total_quantity', 10, 2)->default(0);
            $table->decimal('total_spent', 12, 2)->default(0);
            $table->timestamp('first_purchased_at')->nullable();
            $table->timestamp('last_purchased_at')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'product_id']);
            $table->index('customer_id');
            $table->index('product_id');
            $table->index('frequency');
            $table->index('last_purchased_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_purchase_history');
    }
};
