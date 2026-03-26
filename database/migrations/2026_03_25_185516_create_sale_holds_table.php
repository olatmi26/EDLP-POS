<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_holds', function (Blueprint $table) {
            $table->id();
            $table->string('hold_number')->unique();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->json('cart_data');                                  // full cart snapshot
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('label')->nullable();                        // cashier note
            $table->boolean('is_recalled')->default(false);
            $table->timestamp('recalled_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index('branch_id');
            $table->index('cashier_id');
            $table->index('is_recalled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_holds');
    }
};
