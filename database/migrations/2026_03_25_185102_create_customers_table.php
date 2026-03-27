<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone', 20)->unique()->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            // Analytics fields — updated on every sale
            $table->unsignedInteger('visit_count')->default(0);
            $table->decimal('total_spend', 14, 2)->default(0);
            $table->timestamp('last_visit_at')->nullable();
            $table->foreignId('preferred_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->json('customer_preferences')->nullable();           // AI top-10 products cache
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            // Offline sync fields
            $table->uuid('local_id')->nullable()->index();
            $table->uuid('cloud_id')->nullable()->index();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('phone');
            $table->index('is_active');
            $table->index('visit_count');
            $table->index('total_spend');
            // SQLite (used in PHPUnit) does not support FULLTEXT indexes.
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $table->fullText(['name', 'phone']);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
