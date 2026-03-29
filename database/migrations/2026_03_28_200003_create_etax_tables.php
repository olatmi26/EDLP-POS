<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FIRS eTax Compliance — Nigeria Finance Act 2021 / TaxPro-Max Integration
 *
 * etax_submissions — Every fiscal document (sale receipt, B2B invoice, credit note)
 *                    transmitted to the FIRS gateway gets a row here.
 *
 * etax_config      — Per-branch FIRS API credentials and configuration
 *                    (TIN, device serial, secret key — encrypted at rest)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── FIRS Configuration per Branch ─────────────────────────────────────
        Schema::create('etax_config', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('tin');                          // Tax Identification Number
            $table->string('taxpayer_name');                // Legal business name
            $table->string('device_serial')->nullable();    // FIRS-assigned device serial
            $table->string('api_environment')->default('sandbox'); // sandbox|production
            $table->text('api_key')->nullable();            // Encrypted FIRS API key
            $table->text('api_secret')->nullable();         // Encrypted FIRS API secret
            $table->string('vat_rate')->default('7.5');     // Current Nigerian VAT rate
            $table->boolean('is_enabled')->default(false);  // Must be explicitly enabled
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamps();
        });

        // ── eTax Submission Log ────────────────────────────────────────────────
        Schema::create('etax_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();

            // Source document (polymorphic — sale, wholesale_order, purchase_order)
            $table->string('source_type');              // 'sale'|'wholesale_order'|'credit_note'
            $table->unsignedBigInteger('source_id');

            $table->string('document_type');            // invoice|receipt|credit_note|debit_note
            $table->string('document_number');          // EDLP internal receipt/order number

            // FIRS response fields
            $table->string('fiscal_document_number')->nullable(); // FDN assigned by FIRS
            $table->string('qr_code_data')->nullable();           // QR content for printed receipt
            $table->string('submission_status')->default('pending'); // pending|submitted|accepted|rejected|failed
            $table->json('request_payload')->nullable();           // Full payload sent to FIRS
            $table->json('response_payload')->nullable();          // Full FIRS response
            $table->text('error_message')->nullable();

            $table->decimal('taxable_amount', 15, 2)->default(0);
            $table->decimal('vat_amount',     15, 2)->default(0);
            $table->decimal('total_amount',   15, 2)->default(0);

            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index('submission_status');
            $table->index('branch_id');
            $table->index('fiscal_document_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etax_submissions');
        Schema::dropIfExists('etax_config');
    }
};
