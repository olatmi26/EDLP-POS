<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku')->unique()->nullable();
            $table->string('barcode')->unique()->nullable();
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->decimal('wholesale_price', 12, 2)->nullable();
            $table->decimal('vat_rate', 5, 2)->default(0);             // percentage, 0 = VAT exempt
            $table->string('unit')->default('piece');                   // piece, kg, litre, carton, etc.
            $table->decimal('unit_weight', 8, 3)->nullable();
            $table->unsignedInteger('reorder_level')->default(10);
            $table->unsignedInteger('reorder_quantity')->default(50);
            $table->boolean('track_inventory')->default(true);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->string('image')->nullable();
            $table->json('images')->nullable();                         // additional product images
            $table->json('attributes')->nullable();                     // flexible product attributes
            $table->timestamps();
            $table->softDeletes();

            $table->index('sku');
            $table->index('barcode');
            $table->index('category_id');
            $table->index('supplier_id');
            $table->index('is_active');
            $table->fullText(['name', 'sku', 'barcode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
