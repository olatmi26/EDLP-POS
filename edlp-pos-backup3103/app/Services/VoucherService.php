<?php

namespace App\Services;

use App\Models\Account;
use App\Models\ApprovalRequest;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VoucherService
{
    /**
     * Post a payment voucher when an expense/IOU/travel request is fully approved.
     * Called by HandleApprovalFullyApproved listener for workflows with requires_payment_processing = true.
     *
     * Accounting entry:
     *   DR  Expense Account (from workflow.payment_account_code)
     *   CR  Accounts Payable (liability) — pending actual payment
     */
    public function postApprovalVoucher(ApprovalRequest $request): JournalEntry
    {
        $workflow = $request->workflow;

        if (! $workflow->requires_payment_processing) {
            throw new \RuntimeException("Workflow '{$workflow->name}' does not require payment processing.");
        }

        return DB::transaction(function () use ($request, $workflow) {
            $debitAccount  = $this->resolveAccount($workflow->payment_account_code,  'expense');
            $creditAccount = $this->resolveAccount($workflow->credit_account_code ?? 'AP-PAYABLE', 'liability');

            $amount      = (float) data_get($request->context_json, 'amount', 0);
            $description = data_get($request->context_json, 'description', "Approved request #{$request->id}");

            $entry = JournalEntry::create([
                'voucher_number'     => JournalEntry::generateVoucherNumber('PMT'),
                'type'               => JournalEntry::TYPE_PAYMENT,
                'description'        => $description,
                'total_amount'       => $amount,
                'entry_date'         => now()->toDateString(),
                'status'             => JournalEntry::STATUS_DRAFT,
                'created_by'         => $request->requested_by,
                'branch_id'          => $request->branch_id,
                'approval_request_id'=> $request->id,
                'source_type'        => $request->operation_type,
                'source_id'          => $request->operation_id,
            ]);

            // DR Expense
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'account_id'       => $debitAccount->id,
                'description'      => $description,
                'debit'            => $amount,
                'credit'           => 0,
                'branch_id'        => $request->branch_id,
            ]);

            // CR Accounts Payable
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'account_id'       => $creditAccount->id,
                'description'      => "Payable: {$description}",
                'debit'            => 0,
                'credit'           => $amount,
                'branch_id'        => $request->branch_id,
            ]);

            // Post immediately (moves to posted status)
            $this->post($entry, null);

            // Update the approval request
            $request->update(['voucher_posted_at' => now()]);

            Log::info("VoucherService: posted voucher #{$entry->voucher_number} for approval request #{$request->id}");

            return $entry->load('lines.account');
        });
    }

    /**
     * Confirm payment and replace the AP credit with a Bank/Cash credit.
     * Called by the payable accountant via POST /api/approvals/{request}/confirm-payment.
     *
     * Accounting entry:
     *   DR  Accounts Payable  (clears the payable)
     *   CR  Cash / Bank       (records actual outflow)
     */
    public function confirmPayment(ApprovalRequest $request, array $paymentData, User $accountant): JournalEntry
    {
        return DB::transaction(function () use ($request, $paymentData, $accountant) {
            $amount      = (float) data_get($request->context_json, 'amount', 0);
            $bankAccount = $this->resolveAccount($paymentData['bank_account_code'] ?? 'CASH-MAIN', 'asset');
            $apAccount   = $this->resolveAccount('AP-PAYABLE', 'liability');
            $description = "Payment confirmation: " . data_get($request->context_json, 'description', "Request #{$request->id}");

            $entry = JournalEntry::create([
                'voucher_number'     => JournalEntry::generateVoucherNumber('PAY'),
                'reference'          => $paymentData['payment_reference'] ?? null,
                'type'               => JournalEntry::TYPE_PAYMENT,
                'description'        => $description,
                'total_amount'       => $amount,
                'entry_date'         => now()->toDateString(),
                'status'             => JournalEntry::STATUS_DRAFT,
                'created_by'         => $accountant->id,
                'approved_by'        => $accountant->id,
                'branch_id'          => $request->branch_id,
                'approval_request_id'=> $request->id,
                'source_type'        => $request->operation_type,
                'source_id'          => $request->operation_id,
            ]);

            // DR Accounts Payable (clear the liability)
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'account_id'       => $apAccount->id,
                'description'      => "Clear payable: {$description}",
                'debit'            => $amount,
                'credit'           => 0,
                'branch_id'        => $request->branch_id,
            ]);

            // CR Bank / Cash
            JournalLine::create([
                'journal_entry_id' => $entry->id,
                'account_id'       => $bankAccount->id,
                'description'      => $description,
                'debit'            => 0,
                'credit'           => $amount,
                'branch_id'        => $request->branch_id,
            ]);

            $this->post($entry, $accountant);

            // Mark the approval request as payment-processed
            $request->update([
                'payment_processed_at' => now(),
                'payment_processed_by' => $accountant->id,
                'payment_reference'    => $paymentData['payment_reference'] ?? null,
                'payment_notes'        => $paymentData['notes'] ?? null,
            ]);

            return $entry->load('lines.account');
        });
    }

    /**
     * Post a sales receipt voucher.
     *
     *   DR  Cash / Bank (or AR for credit sales)
     *   CR  Sales Revenue
     *   CR  VAT Payable
     */
    public function postSalesVoucher(
        \App\Models\Sale $sale,
        User $cashier
    ): JournalEntry {
        return DB::transaction(function () use ($sale, $cashier) {
            $cashAccount    = $this->resolveAccount('CASH-MAIN', 'asset');
            $revenueAccount = $this->resolveAccount('REV-SALES', 'revenue');
            $vatAccount     = $this->resolveAccount('VAT-PAYABLE', 'liability');

            $entry = JournalEntry::create([
                'voucher_number' => JournalEntry::generateVoucherNumber('SAL'),
                'reference'      => $sale->receipt_number,
                'type'           => JournalEntry::TYPE_SALES,
                'description'    => "Sale: {$sale->receipt_number}",
                'total_amount'   => $sale->total,
                'entry_date'     => $sale->created_at->toDateString(),
                'status'         => JournalEntry::STATUS_DRAFT,
                'created_by'     => $cashier->id,
                'branch_id'      => $sale->branch_id,
                'source_type'    => 'sale',
                'source_id'      => $sale->id,
            ]);

            // DR Cash
            JournalLine::create(['journal_entry_id'=>$entry->id,'account_id'=>$cashAccount->id,'description'=>"Cash receipt: {$sale->receipt_number}",'debit'=>$sale->total,'credit'=>0,'branch_id'=>$sale->branch_id]);
            // CR Revenue (net of VAT)
            JournalLine::create(['journal_entry_id'=>$entry->id,'account_id'=>$revenueAccount->id,'description'=>"Sales revenue: {$sale->receipt_number}",'debit'=>0,'credit'=>$sale->subtotal,'branch_id'=>$sale->branch_id]);
            // CR VAT Payable
            if ($sale->vat_amount > 0) {
                JournalLine::create(['journal_entry_id'=>$entry->id,'account_id'=>$vatAccount->id,'description'=>"VAT collected: {$sale->receipt_number}",'debit'=>0,'credit'=>$sale->vat_amount,'branch_id'=>$sale->branch_id]);
            }

            $this->post($entry, $cashier);

            return $entry;
        });
    }

    /**
     * Reverse a posted journal entry. Creates a mirror entry with opposite debits/credits.
     */
    public function reverse(JournalEntry $entry, User $reversedBy, string $reason): JournalEntry
    {
        if (! $entry->isPosted()) {
            throw new \RuntimeException('Only posted journal entries can be reversed.');
        }

        return DB::transaction(function () use ($entry, $reversedBy, $reason) {
            $reversal = JournalEntry::create([
                'voucher_number' => JournalEntry::generateVoucherNumber('REV'),
                'reference'      => "Reversal of {$entry->voucher_number}",
                'type'           => $entry->type,
                'description'    => "REVERSAL: {$entry->description}",
                'total_amount'   => $entry->total_amount,
                'entry_date'     => now()->toDateString(),
                'status'         => JournalEntry::STATUS_DRAFT,
                'created_by'     => $reversedBy->id,
                'branch_id'      => $entry->branch_id,
                'source_type'    => $entry->source_type,
                'source_id'      => $entry->source_id,
            ]);

            foreach ($entry->lines as $line) {
                JournalLine::create([
                    'journal_entry_id' => $reversal->id,
                    'account_id'       => $line->account_id,
                    'description'      => "Reversal: {$line->description}",
                    'debit'            => $line->credit, // swap
                    'credit'           => $line->debit,  // swap
                    'branch_id'        => $line->branch_id,
                ]);
            }

            $this->post($reversal, $reversedBy);

            $entry->update([
                'status'          => JournalEntry::STATUS_REVERSED,
                'reversed_at'     => now(),
                'reversed_by'     => $reversedBy->id,
                'reversal_reason' => $reason,
            ]);

            return $reversal;
        });
    }

    /**
     * Get trial balance for a branch and period.
     */
    public function trialBalance(?int $branchId, string $periodFrom, string $periodTo): array
    {
        $lines = JournalLine::with('account:id,code,name,type')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereHas('entry', fn ($q) => $q->posted()->whereBetween('entry_date', [$periodFrom, $periodTo]))
            ->selectRaw('account_id, SUM(debit) as total_debit, SUM(credit) as total_credit')
            ->groupBy('account_id')
            ->get();

        return $lines->map(fn ($row) => [
            'account_code' => $row->account?->code,
            'account_name' => $row->account?->name,
            'account_type' => $row->account?->type,
            'total_debit'  => round((float)$row->total_debit,  2),
            'total_credit' => round((float)$row->total_credit, 2),
            'net_balance'  => round((float)$row->total_debit - (float)$row->total_credit, 2),
        ])->sortBy('account_code')->values()->toArray();
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private function post(JournalEntry $entry, ?User $by): void
    {
        if (! $entry->load('lines')->isBalanced()) {
            throw new \RuntimeException("Journal entry #{$entry->id} is not balanced. Cannot post.");
        }
        $entry->update([
            'status'      => JournalEntry::STATUS_POSTED,
            'posted_at'   => now(),
            'approved_by' => $by?->id ?? $entry->approved_by,
        ]);
        $this->updateAccountBalances($entry);
    }

    private function updateAccountBalances(JournalEntry $entry): void
    {
        $period = now()->format('Y-m');
        foreach ($entry->lines as $line) {
            \App\Models\AccountBalance::updateOrCreate(
                ['account_id' => $line->account_id, 'branch_id' => $line->branch_id, 'period' => $period],
                []
            );
            \App\Models\AccountBalance::where('account_id', $line->account_id)
                ->where('branch_id', $line->branch_id)
                ->where('period', $period)
                ->increment('total_debits',  (float)$line->debit);
            \App\Models\AccountBalance::where('account_id', $line->account_id)
                ->where('branch_id', $line->branch_id)
                ->where('period', $period)
                ->increment('total_credits', (float)$line->credit);
            \App\Models\AccountBalance::where('account_id', $line->account_id)
                ->where('branch_id', $line->branch_id)
                ->where('period', $period)
                ->update(['closing_balance' => \Illuminate\Support\Facades\DB::raw('total_debits - total_credits')]);
        }
    }

    private function resolveAccount(string $code, string $expectedType): Account
    {
        $account = Account::where('code', $code)->where('is_active', true)->first();
        if (! $account) {
            // Auto-create if missing (with a warning — admin should set up COA properly)
            Log::warning("VoucherService: Account '{$code}' not found — auto-creating. Please configure your Chart of Accounts.");
            $account = Account::create([
                'code'      => $code,
                'name'      => $code,
                'type'      => $expectedType,
                'is_active' => true,
                'is_system' => true,
            ]);
        }
        return $account;
    }
}
