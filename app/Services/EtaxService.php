<?php

namespace App\Services;

use App\Models\EtaxConfig;
use App\Models\EtaxSubmission;
use App\Models\Sale;
use App\Models\WholesaleOrder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * EtaxService — FIRS eTax Compliance Integration
 *
 * Nigeria's Finance Act 2026 / FIRS TaxPro-Max mandate:
 * - Every invoice/receipt must be transmitted to FIRS in real time
 * - FIRS assigns a Fiscal Document Number (FDN)
 * - The FDN and a QR code must appear on the printed receipt
 * - VAT (7.5%) must be calculated and reported per transaction
 *
 * Sandbox: https://etax.firs.gov.ng/api/sandbox/v1
 * Production: https://etax.firs.gov.ng/api/v1
 *
 * This service is decoupled from the sale flow via a queued job
 * so network failures never block a cashier at the POS.
 */
class EtaxService
{
    private const SANDBOX_URL    = 'https://etax.firs.gov.ng/api/sandbox/v1';
    private const PRODUCTION_URL = 'https://etax.firs.gov.ng/api/v1';
    private const TIMEOUT        = 10; // seconds — never hold up the cashier

    /**
     * Submit a retail sale receipt to FIRS.
     * Called as a queued job after sale is confirmed.
     *
     * @return EtaxSubmission
     */
    public function submitSale(Sale $sale): EtaxSubmission
    {
        $config = $this->getConfig($sale->branch_id);

        if (! $config || ! $config->is_enabled) {
            Log::info("EtaxService: eTax not enabled for branch #{$sale->branch_id} — skipping submission");
            return $this->createSkippedRecord($sale->branch_id, 'sale', $sale->id, $sale->receipt_number, $sale->total, $sale->vat_amount);
        }

        $payload = $this->buildSalePayload($sale, $config);

        return $this->submitDocument(
            branchId:       $sale->branch_id,
            config:         $config,
            sourceType:     'sale',
            sourceId:       $sale->id,
            documentType:   'receipt',
            documentNumber: $sale->receipt_number,
            taxableAmount:  (float)$sale->subtotal,
            vatAmount:      (float)$sale->vat_amount,
            totalAmount:    (float)$sale->total,
            payload:        $payload,
        );
    }

    /**
     * Submit a wholesale B2B invoice to FIRS.
     *
     * @return EtaxSubmission
     */
    public function submitWholesaleInvoice(WholesaleOrder $order): EtaxSubmission
    {
        $config = $this->getConfig($order->branch_id);

        if (! $config || ! $config->is_enabled) {
            return $this->createSkippedRecord($order->branch_id, 'wholesale_order', $order->id, $order->order_number, $order->total, $order->tax_amount);
        }

        $payload = $this->buildWholesalePayload($order, $config);

        return $this->submitDocument(
            branchId:       $order->branch_id,
            config:         $config,
            sourceType:     'wholesale_order',
            sourceId:       $order->id,
            documentType:   'invoice',
            documentNumber: $order->order_number,
            taxableAmount:  (float)$order->subtotal,
            vatAmount:      (float)$order->tax_amount,
            totalAmount:    (float)$order->total,
            payload:        $payload,
        );
    }

    /**
     * Retry all failed submissions for a branch.
     */
    public function retryFailed(int $branchId): int
    {
        $retried = 0;
        EtaxSubmission::failed()
            ->where('branch_id', $branchId)
            ->where('retry_count', '<', 3)
            ->get()
            ->each(function (EtaxSubmission $submission) use (&$retried) {
                $config = $this->getConfig($submission->branch_id);
                if (! $config) return;

                $this->transmit($submission, $config);
                $retried++;
            });

        return $retried;
    }

    /**
     * Verify a fiscal document number with FIRS (for receipt scanning/audit).
     */
    public function verifyFDN(string $fdn, int $branchId): array
    {
        $config = $this->getConfig($branchId);
        if (! $config) return ['valid' => false, 'message' => 'eTax not configured for this branch'];

        try {
            $response = Http::withHeaders($this->headers($config))
                ->timeout(self::TIMEOUT)
                ->get($this->baseUrl($config) . "/verify/{$fdn}");

            return $response->json() ?? ['valid' => false];
        } catch (\Throwable $e) {
            return ['valid' => false, 'message' => 'Verification service unavailable'];
        }
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private function submitDocument(
        int    $branchId,
        EtaxConfig $config,
        string $sourceType,
        int    $sourceId,
        string $documentType,
        string $documentNumber,
        float  $taxableAmount,
        float  $vatAmount,
        float  $totalAmount,
        array  $payload,
    ): EtaxSubmission {

        $submission = EtaxSubmission::create([
            'branch_id'        => $branchId,
            'source_type'      => $sourceType,
            'source_id'        => $sourceId,
            'document_type'    => $documentType,
            'document_number'  => $documentNumber,
            'submission_status'=> EtaxSubmission::STATUS_PENDING,
            'request_payload'  => $payload,
            'taxable_amount'   => $taxableAmount,
            'vat_amount'       => $vatAmount,
            'total_amount'     => $totalAmount,
        ]);

        $this->transmit($submission, $config);

        return $submission->fresh();
    }

    private function transmit(EtaxSubmission $submission, EtaxConfig $config): void
    {
        try {
            $submission->update([
                'submission_status' => EtaxSubmission::STATUS_SUBMITTED,
                'submitted_at'      => now(),
            ]);

            $response = Http::withHeaders($this->headers($config))
                ->timeout(self::TIMEOUT)
                ->post($this->baseUrl($config) . '/invoice/submit', $submission->request_payload ?? []);

            $responseBody = $response->json() ?? [];

            if ($response->successful() && isset($responseBody['data']['fiscal_document_number'])) {
                $submission->update([
                    'submission_status'      => EtaxSubmission::STATUS_ACCEPTED,
                    'fiscal_document_number' => $responseBody['data']['fiscal_document_number'],
                    'qr_code_data'           => $responseBody['data']['qr_code'] ?? null,
                    'response_payload'       => $responseBody,
                    'accepted_at'            => now(),
                ]);

                Log::info("EtaxService: FDN {$responseBody['data']['fiscal_document_number']} assigned to {$submission->document_number}");
            } else {
                $submission->update([
                    'submission_status' => EtaxSubmission::STATUS_REJECTED,
                    'response_payload'  => $responseBody,
                    'error_message'     => $responseBody['message'] ?? "HTTP {$response->status()}",
                    'retry_count'       => $submission->retry_count + 1,
                ]);

                Log::warning("EtaxService: Submission rejected for {$submission->document_number}: " . ($responseBody['message'] ?? 'unknown'));
            }
        } catch (\Throwable $e) {
            $submission->update([
                'submission_status' => EtaxSubmission::STATUS_FAILED,
                'error_message'     => $e->getMessage(),
                'retry_count'       => $submission->retry_count + 1,
            ]);
            Log::error("EtaxService: Transmission failed for {$submission->document_number}: " . $e->getMessage());
        }
    }

    private function buildSalePayload(Sale $sale, EtaxConfig $config): array
    {
        $lineItems = $sale->items->map(fn ($item) => [
            'product_name'  => $item->product?->name ?? 'Item',
            'quantity'      => $item->quantity,
            'unit_price'    => (float)$item->unit_price,
            'line_total'    => (float)$item->subtotal,
            'vat_rate'      => $item->product?->is_vat_exempt ? 0 : (float)$config->vat_rate,
            'vat_amount'    => $item->product?->is_vat_exempt ? 0 : round((float)$item->subtotal * ((float)$config->vat_rate / 100), 2),
        ])->toArray();

        return [
            'tin'               => $config->tin,
            'taxpayer_name'     => $config->taxpayer_name,
            'device_serial'     => $config->device_serial,
            'document_type'     => 'receipt',
            'document_number'   => $sale->receipt_number,
            'transaction_date'  => $sale->created_at->toIso8601String(),
            'currency'          => 'NGN',
            'customer_name'     => $sale->customer?->name ?? 'Walk-in Customer',
            'customer_tin'      => null,
            'line_items'        => $lineItems,
            'subtotal'          => (float)$sale->subtotal,
            'vat_rate'          => (float)$config->vat_rate,
            'vat_amount'        => (float)$sale->vat_amount,
            'discount_amount'   => (float)$sale->discount_amount,
            'total_amount'      => (float)$sale->total,
            'payment_method'    => $sale->payment_method,
        ];
    }

    private function buildWholesalePayload(WholesaleOrder $order, EtaxConfig $config): array
    {
        $lineItems = $order->items->map(fn ($item) => [
            'product_name' => $item->product?->name ?? 'Item',
            'quantity'     => $item->quantity,
            'unit_price'   => (float)$item->unit_price,
            'line_total'   => (float)$item->line_total,
            'vat_rate'     => (float)$config->vat_rate,
            'vat_amount'   => round((float)$item->line_total * ((float)$config->vat_rate / 100), 2),
        ])->toArray();

        return [
            'tin'              => $config->tin,
            'taxpayer_name'    => $config->taxpayer_name,
            'device_serial'    => $config->device_serial,
            'document_type'    => 'invoice',
            'document_number'  => $order->order_number,
            'transaction_date' => $order->created_at->toIso8601String(),
            'currency'         => 'NGN',
            'customer_name'    => $order->customer?->business_name,
            'customer_tin'     => $order->customer?->cac_number,
            'line_items'       => $lineItems,
            'subtotal'         => (float)$order->subtotal,
            'vat_rate'         => (float)$config->vat_rate,
            'vat_amount'       => (float)$order->tax_amount,
            'total_amount'     => (float)$order->total,
            'payment_terms'    => $order->customer?->payment_terms,
            'due_date'         => $order->due_date?->toDateString(),
        ];
    }

    private function getConfig(int $branchId): ?EtaxConfig
    {
        return EtaxConfig::where('branch_id', $branchId)->first();
    }

    private function headers(EtaxConfig $config): array
    {
        return [
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
            'X-API-KEY'     => $config->api_key,
            'X-API-SECRET'  => $config->api_secret,
            'X-DEVICE-SERIAL' => $config->device_serial ?? '',
        ];
    }

    private function baseUrl(EtaxConfig $config): string
    {
        return $config->api_environment === 'production' ? self::PRODUCTION_URL : self::SANDBOX_URL;
    }

    private function createSkippedRecord(int $branchId, string $sourceType, int $sourceId, string $docNumber, float $total, float $vat): EtaxSubmission
    {
        return EtaxSubmission::create([
            'branch_id'        => $branchId,
            'source_type'      => $sourceType,
            'source_id'        => $sourceId,
            'document_type'    => 'receipt',
            'document_number'  => $docNumber,
            'submission_status'=> 'skipped',
            'taxable_amount'   => $total - $vat,
            'vat_amount'       => $vat,
            'total_amount'     => $total,
            'error_message'    => 'eTax not enabled for this branch',
        ]);
    }
}
