<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('operation_type'); // promotion|expense|purchase_order|stock_movement|expiry_disposal|wholesale_order|bulk_pricing
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('operation_type');
            $table->index('is_active');
        });

        Schema::create('approval_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows')->cascadeOnDelete();
            $table->unsignedTinyInteger('stage_order');
            $table->string('stage_name');
            $table->string('approver_type'); // role|user|any_of_role
            $table->string('approver_role')->nullable();
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('min_approvers')->default(1);
            $table->unsignedSmallInteger('timeout_hours')->default(48);
            $table->string('timeout_action')->default('escalate'); // escalate|auto_approve|auto_reject
            $table->timestamps();

            $table->index(['workflow_id', 'stage_order']);
        });

        Schema::create('approval_thresholds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows')->cascadeOnDelete();
            $table->string('field');       // e.g. 'total_amount', 'quantity'
            $table->string('operator');    // >, >=, <, <=, =
            $table->decimal('threshold_value', 15, 2);
            $table->foreignId('escalate_to_workflow_id')->nullable()->constrained('approval_workflows')->nullOnDelete();
            $table->timestamps();

            $table->index('workflow_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_thresholds');
        Schema::dropIfExists('approval_stages');
        Schema::dropIfExists('approval_workflows');
    }
};
