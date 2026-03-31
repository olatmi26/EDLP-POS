<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('approval_workflows');
            $table->string('operation_type');
            $table->unsignedBigInteger('operation_id');  // polymorphic ID (promotion_id, expense_id, etc.)
            $table->unsignedTinyInteger('current_stage')->default(1);
            $table->string('status')->default('pending'); // pending|approved|rejected|cancelled|timed_out
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->json('context_json')->nullable(); // snapshot of the operation for audit
            $table->text('rejection_reason')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['operation_type', 'operation_id']);
            $table->index(['status', 'current_stage']);
            $table->index('requested_by');
            $table->index('branch_id');
        });

        Schema::create('approval_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('approval_requests')->cascadeOnDelete();
            $table->foreignId('stage_id')->constrained('approval_stages')->cascadeOnDelete();
            $table->foreignId('decided_by')->constrained('users');
            $table->string('decision'); // approved|rejected
            $table->text('comment')->nullable();
            $table->timestamp('decided_at');
            $table->timestamps();

            $table->index(['request_id', 'stage_id']);
            $table->index('decided_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_decisions');
        Schema::dropIfExists('approval_requests');
    }
};
