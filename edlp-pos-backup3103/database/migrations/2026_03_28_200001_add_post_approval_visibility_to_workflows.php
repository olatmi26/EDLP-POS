<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Post-Approval Visibility Extension
 *
 * Adds to approval_workflows:
 *   post_approval_viewer_roles  — JSON array of role names that gain read access on approval
 *   post_approval_viewer_users  — JSON array of user IDs that gain read access on approval
 *   requires_payment_processing — flag: this workflow produces a payable voucher
 *   payment_account_code        — GL account to debit (e.g. 'EXP-TRAVEL', 'EXP-MISC')
 *
 * Adds to approval_requests:
 *   voucher_posted_at           — when the accounting voucher was posted
 *   etax_submitted_at           — when submitted to FIRS eTax gateway
 *   payment_processed_at        — when the payable accountant confirmed payment
 *   payment_processed_by        — FK to users
 *   payment_reference           — bank transfer ref / cheque number
 *   payment_notes               — accountant's notes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->json('post_approval_viewer_roles')->nullable()->after('description')
                ->comment('Roles that can read this request after approval (e.g. ["accountant","receivable-accountant"])');
            $table->json('post_approval_viewer_users')->nullable()->after('post_approval_viewer_roles')
                ->comment('Specific user IDs that can read this request after approval');
            $table->boolean('requires_payment_processing')->default(false)->after('post_approval_viewer_users')
                ->comment('True for expense/IOU/travel — accountant must confirm payment');
            $table->string('payment_account_code')->nullable()->after('requires_payment_processing')
                ->comment('GL debit account code for auto-voucher posting');
            $table->string('credit_account_code')->nullable()->after('payment_account_code')
                ->comment('GL credit account code (defaults to Cash/Bank)');
        });

        Schema::table('approval_requests', function (Blueprint $table) {
            $table->timestamp('voucher_posted_at')->nullable()->after('resolved_at');
            $table->timestamp('etax_submitted_at')->nullable()->after('voucher_posted_at');
            $table->timestamp('payment_processed_at')->nullable()->after('etax_submitted_at');
            $table->foreignId('payment_processed_by')->nullable()->after('payment_processed_at')
                ->constrained('users')->nullOnDelete();
            $table->string('payment_reference')->nullable()->after('payment_processed_by');
            $table->text('payment_notes')->nullable()->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('approval_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_processed_by');
            $table->dropColumn([
                'voucher_posted_at','etax_submitted_at','payment_processed_at',
                'payment_reference','payment_notes',
            ]);
        });

        Schema::table('approval_workflows', function (Blueprint $table) {
            $table->dropColumn([
                'post_approval_viewer_roles','post_approval_viewer_users',
                'requires_payment_processing','payment_account_code','credit_account_code',
            ]);
        });
    }
};
