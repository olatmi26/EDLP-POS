<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('batch_number');
            $table->date('manufactured_date')->nullable();
            $table->date('expiry_date');
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('quantity_remaining');
            $table->decimal('cost_per_unit', 12, 2);
            $table->foreignId('received_by')->constrained('users');
            $table->string('status')->default('active'); // active|near_expiry|expired|disposed
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_id', 'branch_id', 'expiry_date']); // FEFO query index
            $table->index('status');
            $table->index('expiry_date');
            $table->unique(['product_id', 'branch_id', 'batch_number']);
        });

        Schema::create('expiry_disposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained('product_batches')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained();
            $table->unsignedInteger('quantity');
            $table->string('reason'); // expired|near_expiry|damaged|recalled
            $table->string('disposal_method'); // destroy|return_to_supplier|donate|markdown_sale
            $table->decimal('write_off_value', 12, 2)->default(0);
            $table->foreignId('disposed_by')->constrained('users');
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('disposed_at')->nullable();
            $table->timestamps();

            $table->index('batch_id');
            $table->index('branch_id');
            $table->index('approval_request_id');
        });

        // Add batch_id FK to sale_items for FEFO audit trail
        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreignId('batch_id')->nullable()->after('promotion_id')->constrained('product_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batch_id');
        });
        Schema::dropIfExists('expiry_disposals');
        Schema::dropIfExists('product_batches');
    }
};
