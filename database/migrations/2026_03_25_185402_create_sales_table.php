<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number')->unique();                 // BRANCH-YYYYMMDD-XXXX
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('cashier_session_id')->nullable()->constrained('cashier_sessions')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            // Financials
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('amount_tendered', 12, 2)->default(0);
            $table->decimal('change_given', 12, 2)->default(0);
            // Payment
            $table->enum('payment_method', ['cash', 'opay_pos', 'moniepoint_pos', 'transfer', 'split'])
                  ->default('cash');
            $table->json('split_payments')->nullable();                 // breakdown for split payment
            // Status
            $table->enum('status', ['completed', 'voided', 'refunded', 'partial_refund'])
                  ->default('completed');
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->text('notes')->nullable();
            // Offline sync fields
            $table->uuid('local_id')->nullable()->index();
            $table->uuid('cloud_id')->nullable()->index();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('receipt_number');
            $table->index('branch_id');
            $table->index('cashier_id');
            $table->index('customer_id');
            $table->index('status');
            $table->index('payment_method');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
