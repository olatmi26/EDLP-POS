<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('changed_by')->constrained('users')->cascadeOnDelete();
            $table->decimal('old_selling_price', 12, 2);
            $table->decimal('new_selling_price', 12, 2);
            $table->decimal('old_cost_price', 12, 2)->nullable();
            $table->decimal('new_cost_price', 12, 2)->nullable();
            $table->string('change_reason')->nullable();
            $table->enum('change_type', ['manual', 'bulk_update', 'percentage_adjustment', 'csv_import'])
                  ->default('manual');
            $table->timestamps();

            $table->index('product_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_history');
    }
};
