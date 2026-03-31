<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Accounting Ledger — Chart of Accounts + Journal Entries
 *
 * accounts        — Chart of Accounts (COA) with account codes and types
 * journal_entries — Voucher header (one per approved transaction)
 * journal_lines   — Double-entry lines (debit + credit pairs, always balanced)
 * account_balances— Running balance cache per account per period
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Chart of Accounts ─────────────────────────────────────────────────
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();           // e.g. 1000, 2000, EXP-TRAVEL
            $table->string('name');                     // e.g. Cash and Bank, Travel Expense
            $table->string('type');                     // asset|liability|equity|revenue|expense
            $table->string('sub_type')->nullable();     // current_asset|fixed_asset|operating_expense|etc.
            $table->foreignId('parent_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete(); // null = group level
            $table->string('currency')->default('NGN');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false); // system accounts cannot be deleted
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'is_active']);
            $table->index('branch_id');
        });

        // ── Journal Entries (Voucher Headers) ─────────────────────────────────
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_number')->unique();  // VCH-YYYYMMDD-0001
            $table->string('reference')->nullable();      // cheque no, bank ref, receipt no
            $table->string('type');                       // payment|receipt|journal|expense|sales|purchase
            $table->text('description');
            $table->decimal('total_amount', 15, 2);
            $table->date('entry_date');
            $table->string('status')->default('draft'); // draft|posted|reversed
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();

            // Polymorphic source — links voucher to original transaction
            $table->string('source_type')->nullable();   // 'expense'|'sale'|'purchase_order'|'wholesale_order'
            $table->unsignedBigInteger('source_id')->nullable();

            $table->timestamp('posted_at')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->foreignId('reversed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reversal_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'status']);
            $table->index('entry_date');
            $table->index(['source_type', 'source_id']);
            $table->index('branch_id');
        });

        // ── Journal Lines (Double-Entry) ───────────────────────────────────────
        Schema::create('journal_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts');
            $table->string('description')->nullable();
            $table->decimal('debit',  15, 2)->default(0);
            $table->decimal('credit', 15, 2)->default(0);
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->timestamps();

            $table->index('journal_entry_id');
            $table->index('account_id');
            $table->index('branch_id');
        });

        // ── Running Account Balances (Cache) ───────────────────────────────────
        Schema::create('account_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('period');               // YYYY-MM format
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->decimal('total_debits',    15, 2)->default(0);
            $table->decimal('total_credits',   15, 2)->default(0);
            $table->decimal('closing_balance', 15, 2)->default(0);
            $table->timestamps();

            $table->unique(['account_id', 'branch_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_balances');
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('accounts');
    }
};
