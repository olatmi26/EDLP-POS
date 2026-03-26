<?php

/**
 * EDLP POS — Migration Content Filler
 * Run from project root: php fill_migrations.php
 * Fills all 19 custom migration files with complete schema.
 */

$base = __DIR__ . '/database/migrations/';

$migrations = [

// ──────────────────────────────────────────────────────────
'2026_03_25_185456_create_branches_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'branches\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'code\', 20)->unique();          // e.g. HQ, BR01
            $table->enum(\'type\', [\'head_office\', \'branch\'])->default(\'branch\');
            $table->string(\'address\')->nullable();
            $table->string(\'city\')->nullable();
            $table->string(\'state\')->nullable();
            $table->string(\'phone\')->nullable();
            $table->string(\'email\')->nullable();
            $table->string(\'manager_name\')->nullable();
            $table->boolean(\'is_active\')->default(true);
            $table->json(\'settings\')->nullable();           // branch-specific config
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'code\');
            $table->index(\'is_active\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'branches\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185456_add_branch_fields_to_users_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(\'users\', function (Blueprint $table) {
            $table->foreignId(\'branch_id\')->nullable()->after(\'id\')
                  ->constrained(\'branches\')->nullOnDelete();
            $table->string(\'phone\', 20)->nullable()->after(\'email\');
            $table->string(\'pin\', 6)->nullable()->after(\'phone\');  // hashed 4-digit PIN for cashiers
            $table->string(\'profile_photo\')->nullable()->after(\'pin\');
            $table->boolean(\'is_active\')->default(true)->after(\'profile_photo\');
            $table->timestamp(\'last_login_at\')->nullable()->after(\'is_active\');

            $table->index(\'branch_id\');
            $table->index(\'is_active\');
        });
    }

    public function down(): void
    {
        Schema::table(\'users\', function (Blueprint $table) {
            $table->dropForeign([\'branch_id\']);
            $table->dropColumn([\'branch_id\', \'phone\', \'pin\', \'profile_photo\', \'is_active\', \'last_login_at\']);
        });
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185457_create_categories_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'categories\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'slug\')->unique();
            $table->text(\'description\')->nullable();
            $table->foreignId(\'parent_id\')->nullable()->constrained(\'categories\')->nullOnDelete();
            $table->string(\'image\')->nullable();
            $table->boolean(\'is_active\')->default(true);
            $table->unsignedInteger(\'sort_order\')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'slug\');
            $table->index(\'parent_id\');
            $table->index(\'is_active\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'categories\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185458_create_suppliers_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'suppliers\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'company_name\')->nullable();
            $table->string(\'email\')->nullable();
            $table->string(\'phone\', 20)->nullable();
            $table->string(\'phone_alt\', 20)->nullable();
            $table->text(\'address\')->nullable();
            $table->string(\'city\')->nullable();
            $table->string(\'state\')->nullable();
            $table->string(\'contact_person\')->nullable();
            $table->decimal(\'outstanding_balance\', 12, 2)->default(0);
            $table->boolean(\'is_active\')->default(true);
            $table->text(\'notes\')->nullable();
            // Performance tracking
            $table->unsignedInteger(\'total_orders\')->default(0);
            $table->decimal(\'avg_delivery_days\', 5, 2)->default(0);
            $table->decimal(\'fill_rate\', 5, 2)->default(100); // percentage
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'is_active\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'suppliers\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185459_create_products_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'products\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'slug\')->unique();
            $table->string(\'sku\')->unique()->nullable();
            $table->string(\'barcode\')->unique()->nullable();
            $table->text(\'description\')->nullable();
            $table->foreignId(\'category_id\')->nullable()->constrained(\'categories\')->nullOnDelete();
            $table->foreignId(\'supplier_id\')->nullable()->constrained(\'suppliers\')->nullOnDelete();
            $table->decimal(\'cost_price\', 12, 2)->default(0);
            $table->decimal(\'selling_price\', 12, 2)->default(0);
            $table->decimal(\'wholesale_price\', 12, 2)->nullable();
            $table->decimal(\'vat_rate\', 5, 2)->default(0);    // percentage, 0 = VAT exempt
            $table->string(\'unit\')->default(\'piece\');         // piece, kg, litre, etc.
            $table->decimal(\'unit_weight\', 8, 3)->nullable();
            $table->unsignedInteger(\'reorder_level\')->default(10);
            $table->unsignedInteger(\'reorder_quantity\')->default(50);
            $table->boolean(\'track_inventory\')->default(true);
            $table->boolean(\'is_active\')->default(true);
            $table->boolean(\'is_featured\')->default(false);
            $table->string(\'image\')->nullable();
            $table->json(\'images\')->nullable();                // additional images
            $table->json(\'attributes\')->nullable();            // flexible product attributes
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'sku\');
            $table->index(\'barcode\');
            $table->index(\'category_id\');
            $table->index(\'supplier_id\');
            $table->index(\'is_active\');
            $table->fullText([\'name\', \'sku\', \'barcode\']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'products\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185459_create_inventory_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'inventory\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->integer(\'quantity\')->default(0);
            $table->integer(\'reserved_quantity\')->default(0);  // held for pending orders
            $table->enum(\'status\', [\'ok\', \'low\', \'out\'])->default(\'ok\');
            $table->timestamp(\'last_counted_at\')->nullable();
            $table->foreignId(\'last_counted_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->timestamps();

            $table->unique([\'product_id\', \'branch_id\']);
            $table->index(\'branch_id\');
            $table->index(\'status\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'inventory\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185500_create_customers_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'customers\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'phone\', 20)->unique()->nullable();
            $table->string(\'email\')->nullable();
            $table->string(\'address\')->nullable();
            $table->date(\'date_of_birth\')->nullable();
            $table->enum(\'gender\', [\'male\', \'female\', \'other\'])->nullable();
            // AI & analytics fields
            $table->unsignedInteger(\'visit_count\')->default(0);
            $table->decimal(\'total_spend\', 14, 2)->default(0);
            $table->timestamp(\'last_visit_at\')->nullable();
            $table->foreignId(\'preferred_branch_id\')->nullable()->constrained(\'branches\')->nullOnDelete();
            $table->json(\'customer_preferences\')->nullable(); // AI top-10 products cache
            $table->boolean(\'is_active\')->default(true);
            $table->text(\'notes\')->nullable();
            // Sync fields for offline support
            $table->uuid(\'local_id\')->nullable()->index();
            $table->uuid(\'cloud_id\')->nullable()->index();
            $table->timestamp(\'synced_at\')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'phone\');
            $table->index(\'is_active\');
            $table->index(\'visit_count\');
            $table->index(\'total_spend\');
            $table->fullText([\'name\', \'phone\']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'customers\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185501_create_cashier_sessions_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'cashier_sessions\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'user_id\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->decimal(\'opening_float\', 12, 2)->default(0);
            $table->decimal(\'closing_cash\', 12, 2)->nullable();
            $table->decimal(\'expected_cash\', 12, 2)->nullable();
            $table->decimal(\'cash_variance\', 12, 2)->nullable();
            $table->decimal(\'total_sales\', 12, 2)->default(0);
            $table->decimal(\'total_cash_sales\', 12, 2)->default(0);
            $table->decimal(\'total_pos_sales\', 12, 2)->default(0);
            $table->decimal(\'total_transfer_sales\', 12, 2)->default(0);
            $table->unsignedInteger(\'transaction_count\')->default(0);
            $table->enum(\'status\', [\'open\', \'closed\'])->default(\'open\');
            $table->timestamp(\'opened_at\');
            $table->timestamp(\'closed_at\')->nullable();
            $table->text(\'notes\')->nullable();
            $table->timestamps();

            $table->index([\'user_id\', \'status\']);
            $table->index([\'branch_id\', \'status\']);
            $table->index(\'opened_at\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'cashier_sessions\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185502_create_sales_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'sales\', function (Blueprint $table) {
            $table->id();
            $table->string(\'receipt_number\')->unique();  // BRANCH-YYYYMMDD-XXXX
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'cashier_id\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'cashier_session_id\')->nullable()->constrained(\'cashier_sessions\')->nullOnDelete();
            $table->foreignId(\'customer_id\')->nullable()->constrained(\'customers\')->nullOnDelete();
            // Financials
            $table->decimal(\'subtotal\', 12, 2)->default(0);
            $table->decimal(\'discount_amount\', 12, 2)->default(0);
            $table->decimal(\'discount_percent\', 5, 2)->default(0);
            $table->decimal(\'tax_amount\', 12, 2)->default(0);
            $table->decimal(\'total_amount\', 12, 2)->default(0);
            $table->decimal(\'amount_tendered\', 12, 2)->default(0);
            $table->decimal(\'change_given\', 12, 2)->default(0);
            // Payment
            $table->enum(\'payment_method\', [\'cash\', \'opay_pos\', \'moniepoint_pos\', \'transfer\', \'split\'])
                  ->default(\'cash\');
            $table->json(\'split_payments\')->nullable();  // for split payment breakdown
            // Status
            $table->enum(\'status\', [\'completed\', \'voided\', \'refunded\', \'partial_refund\'])
                  ->default(\'completed\');
            $table->foreignId(\'voided_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->timestamp(\'voided_at\')->nullable();
            $table->text(\'void_reason\')->nullable();
            $table->text(\'notes\')->nullable();
            // Sync fields
            $table->uuid(\'local_id\')->nullable()->index();
            $table->uuid(\'cloud_id\')->nullable()->index();
            $table->timestamp(\'synced_at\')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'receipt_number\');
            $table->index(\'branch_id\');
            $table->index(\'cashier_id\');
            $table->index(\'customer_id\');
            $table->index(\'status\');
            $table->index(\'payment_method\');
            $table->index(\'created_at\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'sales\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185502_create_sale_items_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'sale_items\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'sale_id\')->constrained(\'sales\')->cascadeOnDelete();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->string(\'product_name\');    // snapshot at time of sale
            $table->string(\'product_sku\')->nullable();
            $table->decimal(\'unit_price\', 12, 2);
            $table->decimal(\'cost_price\', 12, 2)->default(0);
            $table->unsignedInteger(\'quantity\');
            $table->decimal(\'discount_amount\', 12, 2)->default(0);
            $table->decimal(\'tax_amount\', 12, 2)->default(0);
            $table->decimal(\'line_total\', 12, 2);
            // Refund tracking
            $table->unsignedInteger(\'refunded_quantity\')->default(0);
            $table->timestamps();

            $table->index(\'sale_id\');
            $table->index(\'product_id\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'sale_items\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185503_create_expenses_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'expenses\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'expense_category_id\')->constrained(\'expense_categories\')->cascadeOnDelete();
            $table->foreignId(\'recorded_by\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'approved_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->string(\'title\');
            $table->text(\'description\')->nullable();
            $table->decimal(\'amount\', 12, 2);
            $table->date(\'expense_date\');
            $table->enum(\'status\', [\'pending\', \'approved\', \'rejected\'])->default(\'approved\');
            $table->string(\'receipt_image\')->nullable();
            $table->timestamp(\'approved_at\')->nullable();
            $table->text(\'rejection_reason\')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'branch_id\');
            $table->index(\'expense_date\');
            $table->index(\'status\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'expenses\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185504_create_expense_categories_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'expense_categories\', function (Blueprint $table) {
            $table->id();
            $table->string(\'name\');
            $table->string(\'slug\')->unique();
            $table->string(\'color\', 7)->default(\'#6B7280\'); // hex color for UI
            $table->boolean(\'requires_approval\')->default(false);
            $table->decimal(\'approval_threshold\', 12, 2)->nullable(); // amount above which approval needed
            $table->boolean(\'is_active\')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'expense_categories\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185505_create_purchase_orders_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'purchase_orders\', function (Blueprint $table) {
            $table->id();
            $table->string(\'po_number\')->unique();
            $table->foreignId(\'supplier_id\')->constrained(\'suppliers\')->cascadeOnDelete();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'created_by\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'approved_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->foreignId(\'received_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->decimal(\'subtotal\', 12, 2)->default(0);
            $table->decimal(\'tax_amount\', 12, 2)->default(0);
            $table->decimal(\'total_amount\', 12, 2)->default(0);
            $table->enum(\'status\', [\'draft\', \'pending\', \'approved\', \'sent\', \'partially_received\', \'received\', \'cancelled\'])
                  ->default(\'draft\');
            $table->date(\'expected_delivery_date\')->nullable();
            $table->timestamp(\'approved_at\')->nullable();
            $table->timestamp(\'received_at\')->nullable();
            $table->unsignedInteger(\'delivery_days\')->nullable(); // actual days taken
            $table->text(\'notes\')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(\'supplier_id\');
            $table->index(\'branch_id\');
            $table->index(\'status\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'purchase_orders\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185506_create_purchase_order_items_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'purchase_order_items\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'purchase_order_id\')->constrained(\'purchase_orders\')->cascadeOnDelete();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->decimal(\'unit_cost\', 12, 2);
            $table->unsignedInteger(\'quantity_ordered\');
            $table->unsignedInteger(\'quantity_received\')->default(0);
            $table->decimal(\'line_total\', 12, 2);
            $table->timestamps();

            $table->index(\'purchase_order_id\');
            $table->index(\'product_id\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'purchase_order_items\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185507_create_price_history_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'price_history\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->foreignId(\'changed_by\')->constrained(\'users\')->cascadeOnDelete();
            $table->decimal(\'old_selling_price\', 12, 2);
            $table->decimal(\'new_selling_price\', 12, 2);
            $table->decimal(\'old_cost_price\', 12, 2)->nullable();
            $table->decimal(\'new_cost_price\', 12, 2)->nullable();
            $table->string(\'change_reason\')->nullable();
            $table->enum(\'change_type\', [\'manual\', \'bulk_update\', \'percentage_adjustment\', \'csv_import\'])
                  ->default(\'manual\');
            $table->timestamps();

            $table->index(\'product_id\');
            $table->index(\'created_at\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'price_history\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185508_create_inventory_transfers_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'inventory_transfers\', function (Blueprint $table) {
            $table->id();
            $table->string(\'transfer_number\')->unique();
            $table->foreignId(\'from_branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'to_branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'requested_by\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'approved_by\')->nullable()->constrained(\'users\')->nullOnDelete();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->unsignedInteger(\'quantity_requested\');
            $table->unsignedInteger(\'quantity_transferred\')->nullable();
            $table->enum(\'status\', [\'pending\', \'approved\', \'in_transit\', \'completed\', \'rejected\'])
                  ->default(\'pending\');
            $table->timestamp(\'approved_at\')->nullable();
            $table->timestamp(\'completed_at\')->nullable();
            $table->text(\'notes\')->nullable();
            $table->text(\'rejection_reason\')->nullable();
            $table->timestamps();

            $table->index(\'from_branch_id\');
            $table->index(\'to_branch_id\');
            $table->index(\'status\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'inventory_transfers\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185510_create_sync_logs_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'sync_logs\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->string(\'device_id\')->nullable();           // desktop machine identifier
            $table->enum(\'operation\', [
                \'CREATE_SALE\', \'UPDATE_INVENTORY\', \'CREATE_CUSTOMER\',
                \'UPDATE_CUSTOMER\', \'CREATE_EXPENSE\', \'STOCK_TAKE\'
            ]);
            $table->string(\'model\');                           // e.g. Sale, Customer
            $table->uuid(\'local_id\');
            $table->unsignedBigInteger(\'cloud_id\')->nullable();
            $table->json(\'payload\');
            $table->enum(\'status\', [\'pending\', \'synced\', \'failed\', \'conflict\'])->default(\'pending\');
            $table->unsignedTinyInteger(\'attempt_count\')->default(0);
            $table->text(\'error_message\')->nullable();
            $table->json(\'conflict_data\')->nullable();
            $table->timestamp(\'synced_at\')->nullable();
            $table->timestamps();

            $table->index(\'branch_id\');
            $table->index(\'status\');
            $table->index(\'local_id\');
            $table->index(\'operation\');
            $table->index(\'created_at\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'sync_logs\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185511_create_ai_purchase_history_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'ai_purchase_history\', function (Blueprint $table) {
            $table->id();
            $table->foreignId(\'customer_id\')->constrained(\'customers\')->cascadeOnDelete();
            $table->foreignId(\'product_id\')->constrained(\'products\')->cascadeOnDelete();
            $table->unsignedInteger(\'frequency\')->default(1);  // how many times bought
            $table->decimal(\'total_quantity\', 10, 2)->default(0);
            $table->decimal(\'total_spent\', 12, 2)->default(0);
            $table->timestamp(\'first_purchased_at\')->nullable();
            $table->timestamp(\'last_purchased_at\')->nullable();
            $table->timestamps();

            $table->unique([\'customer_id\', \'product_id\']);
            $table->index(\'customer_id\');
            $table->index(\'product_id\');
            $table->index(\'frequency\');
            $table->index(\'last_purchased_at\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'ai_purchase_history\');
    }
};
',

// ──────────────────────────────────────────────────────────
'2026_03_25_185516_create_sale_holds_table.php' => '<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(\'sale_holds\', function (Blueprint $table) {
            $table->id();
            $table->string(\'hold_number\')->unique();
            $table->foreignId(\'branch_id\')->constrained(\'branches\')->cascadeOnDelete();
            $table->foreignId(\'cashier_id\')->constrained(\'users\')->cascadeOnDelete();
            $table->foreignId(\'customer_id\')->nullable()->constrained(\'customers\')->nullOnDelete();
            $table->json(\'cart_data\');                  // full cart snapshot
            $table->decimal(\'subtotal\', 12, 2)->default(0);
            $table->decimal(\'total_amount\', 12, 2)->default(0);
            $table->string(\'label\')->nullable();         // cashier note e.g. "Customer left, returning"
            $table->boolean(\'is_recalled\')->default(false);
            $table->timestamp(\'recalled_at\')->nullable();
            $table->timestamp(\'expires_at\')->nullable(); // auto-expire after X hours
            $table->timestamps();

            $table->index(\'branch_id\');
            $table->index(\'cashier_id\');
            $table->index(\'is_recalled\');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(\'sale_holds\');
    }
};
',

]; // end $migrations array

// ── Write all files ──────────────────────────────────────
$written  = 0;
$skipped  = 0;
$errors   = 0;

foreach ($migrations as $filename => $content) {
    $path = $base . $filename;
    if (!file_exists($path)) {
        echo "SKIP (not found): $filename\n";
        $skipped++;
        continue;
    }
    if (file_put_contents($path, $content) !== false) {
        echo "OK: $filename\n";
        $written++;
    } else {
        echo "ERROR writing: $filename\n";
        $errors++;
    }
}

echo "\n";
echo "─────────────────────────────────\n";
echo "Written : $written\n";
echo "Skipped : $skipped\n";
echo "Errors  : $errors\n";
echo "─────────────────────────────────\n";
echo "Done. Now run: php artisan migrate\n";
