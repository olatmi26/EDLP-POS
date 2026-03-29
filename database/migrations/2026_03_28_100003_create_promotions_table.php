<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type'); // percentage_discount|fixed_discount|buy_X_get_Y|bundle_price|flash_sale
            $table->decimal('value', 12, 2);
            $table->string('scope')->default('all'); // all|category|product
            $table->unsignedInteger('buy_quantity')->nullable();   // for buy_X_get_Y
            $table->unsignedInteger('get_quantity')->nullable();   // for buy_X_get_Y
            $table->boolean('is_stackable')->default(false);
            $table->unsignedInteger('priority')->default(0);
            $table->timestamp('start_date')->nullable();
            $table->timestamp('end_date')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->string('status')->default('draft'); // draft|pending_approval|approved|active|paused|expired
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete(); // null = all branches
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index(['start_date', 'end_date']);
            $table->index('branch_id');
        });

        Schema::create('promotion_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unique(['promotion_id', 'product_id']);
        });

        Schema::create('promotion_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->unique(['promotion_id', 'category_id']);
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete(); // null = any customer
            $table->unsignedInteger('max_uses')->default(1);
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('code');
            $table->index('promotion_id');
            $table->index('customer_id');
        });

        Schema::create('coupon_uses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->decimal('discount_applied', 12, 2);
            $table->timestamp('used_at');
            $table->timestamps();

            $table->unique(['coupon_id', 'sale_id']);
        });

        // Add promotion_id FK to sale_items for full audit trail
        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreignId('promotion_id')->nullable()->after('product_id')->constrained('promotions')->nullOnDelete();
            $table->decimal('original_price', 12, 2)->nullable()->after('promotion_id');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('original_price');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promotion_id');
            $table->dropColumn(['original_price', 'discount_amount']);
        });
        Schema::dropIfExists('coupon_uses');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('promotion_categories');
        Schema::dropIfExists('promotion_products');
        Schema::dropIfExists('promotions');
    }
};
