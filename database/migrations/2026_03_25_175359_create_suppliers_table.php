<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('company_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('phone_alt', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('contact_person')->nullable();
            $table->decimal('outstanding_balance', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            // Performance tracking
            $table->unsignedInteger('total_orders')->default(0);
            $table->decimal('avg_delivery_days', 5, 2)->default(0);
            $table->decimal('fill_rate', 5, 2)->default(100);          // percentage
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
