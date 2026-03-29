<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('b2b_customers', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('cac_number')->nullable()->unique();
            $table->string('contact_person')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('tier')->default('bronze'); // gold|silver|bronze
            $table->decimal('credit_limit', 15, 2)->default(0);
            $table->decimal('outstanding_balance', 15, 2)->default(0);
            $table->string('payment_terms')->default('cod'); // net30|net60|cod
            $table->boolean('is_active')->default(true);
            $table->boolean('on_credit_hold')->default(false);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tier');
            $table->index('is_active');
        });

        Schema::create('wholesale_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('tier'); // gold|silver|bronze
            $table->decimal('unit_price', 12, 2);
            $table->unsignedInteger('min_quantity')->default(1);
            $table->timestamps();

            $table->unique(['product_id', 'tier']);
            $table->index('product_id');
        });

        Schema::create('wholesale_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('b2b_customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('draft'); // draft|confirmed|picking|dispatched|delivered|invoiced|cancelled
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->string('payment_status')->default('unpaid'); // unpaid|partial|paid|overdue
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->string('delivery_address')->nullable();
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('invoiced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('payment_status');
            $table->index('b2b_customer_id');
            $table->index('branch_id');
        });

        Schema::create('wholesale_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wholesale_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->string('tier_applied')->nullable();
            $table->timestamps();

            $table->index('wholesale_order_id');
        });

        Schema::create('b2b_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('b2b_customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('wholesale_order_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('payment_method'); // bank_transfer|cash|cheque|pos
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->index('b2b_customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2b_payments');
        Schema::dropIfExists('wholesale_order_items');
        Schema::dropIfExists('wholesale_orders');
        Schema::dropIfExists('wholesale_price_tiers');
        Schema::dropIfExists('b2b_customers');
    }
};
