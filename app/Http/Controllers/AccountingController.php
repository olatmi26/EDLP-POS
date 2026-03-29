<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\ApprovalRequest;
use App\Models\EtaxConfig;
use App\Models\EtaxSubmission;
use App\Models\JournalEntry;
use App\Services\EtaxService;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingController extends Controller
{
    public function __construct(
        private readonly VoucherService $voucherService,
        private readonly EtaxService    $etaxService,
    ) {}

    // ── Chart of Accounts ─────────────────────────────────────────────────────

    /**
     * GET /api/accounting/accounts
     */
    public function accountIndex(Request $request): JsonResponse
    {
        $accounts = Account::with('parent:id,code,name')
            ->when($request->type,      fn ($q, $t) => $q->where('type', $t))
            ->when($request->branch_id, fn ($q, $id) => $q->where(fn ($inner) => $inner->whereNull('branch_id')->orWhere('branch_id', $id)))
            ->active()
            ->orderBy('code')
            ->get();

        return $this->success($accounts);
    }

    /**
     * POST /api/accounting/accounts
     */
    public function accountStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'      => 'required|string|max:20|unique:accounts,code',
            'name'      => 'required|string|max:200',
            'type'      => 'required|in:asset,liability,equity,revenue,expense',
            'sub_type'  => 'nullable|string',
            'parent_id' => 'nullable|integer|exists:accounts,id',
            'branch_id' => 'nullable|integer|exists:branches,id',
            'description'=> 'nullable|string',
        ]);

        $account = Account::create($data);
        return $this->created($account, 'Account created');
    }

    /**
     * PUT /api/accounting/accounts/{account}
     */
    public function accountUpdate(Request $request, Account $account): JsonResponse
    {
        if ($account->is_system) {
            return $this->error('System accounts cannot be modified.', 422);
        }

        $data = $request->validate([
            'name'      => 'sometimes|string|max:200',
            'sub_type'  => 'nullable|string',
            'is_active' => 'boolean',
            'description'=> 'nullable|string',
        ]);

        $account->update($data);
        return $this->success($account, 'Account updated');
    }

    // ── Journal Entries ───────────────────────────────────────────────────────

    /**
     * GET /api/accounting/journal-entries
     */
    public function journalIndex(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = JournalEntry::with(['createdBy:id,name', 'branch:id,name', 'lines.account:id,code,name'])
            ->when(! $user->isSuperAdmin() && ! $user->isAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->type,       fn ($q, $t) => $q->where('type', $t))
            ->when($request->status,     fn ($q, $s) => $q->where('status', $s))
            ->when($request->date_from,  fn ($q, $d) => $q->whereDate('entry_date', '>=', $d))
            ->when($request->date_to,    fn ($q, $d) => $q->whereDate('entry_date', '<=', $d))
            ->when($request->branch_id && $user->isSuperAdmin(), fn ($q) => $q->where('branch_id', $request->branch_id))
            ->latest('entry_date');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/accounting/journal-entries/{entry}
     */
    public function journalShow(JournalEntry $journalEntry): JsonResponse
    {
        $journalEntry->load(['lines.account:id,code,name', 'createdBy:id,name', 'approvedBy:id,name', 'approvalRequest']);
        return $this->success($journalEntry);
    }

    /**
     * POST /api/accounting/journal-entries/{entry}/reverse
     */
    public function journalReverse(Request $request, JournalEntry $journalEntry): JsonResponse
    {
        $data = $request->validate(['reason' => 'required|string|max:500']);

        $reversal = $this->voucherService->reverse($journalEntry, $request->user(), $data['reason']);
        return $this->created($reversal, 'Journal entry reversed');
    }

    // ── Trial Balance ──────────────────────────────────────────────────────────

    /**
     * GET /api/accounting/trial-balance
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $user     = $request->user();
        $branchId = $request->branch_id ?? ($user->isSuperAdmin() ? null : $user->branch_id);

        $balance = $this->voucherService->trialBalance($branchId, $request->date_from, $request->date_to);
        return $this->success($balance);
    }

    // ── Payment Confirmation (Payable Accountant) ─────────────────────────────

    /**
     * GET /api/accounting/payment-queue
     * All approved requests awaiting payment processing — visible only to roles
     * configured in post_approval_viewer_roles for the relevant workflows.
     */
    public function paymentQueue(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ApprovalRequest::with([
                'workflow:id,name,operation_type,payment_account_code',
                'requester:id,name,email',
                'branch:id,name',
                'journalEntries:id,voucher_number,status,total_amount',
            ])
            ->awaitingPayment()
            ->scopeVisibleTo($user)
            ->when($request->operation_type, fn ($q, $t) => $q->where('operation_type', $t))
            ->when(! $user->isSuperAdmin() && ! $user->isAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->latest('resolved_at');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/accounting/payment-queue/{request}/confirm
     * Payable accountant confirms payment has been made.
     * Posts the settlement journal entry (DR Payable, CR Bank).
     */
    public function confirmPayment(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $user = $request->user();

        // Verify the user is a configured post-approval viewer for this workflow
        if (! $approvalRequest->workflow->isPostApprovalViewer($user) && ! $user->isSuperAdmin() && ! $user->isAdmin()) {
            return $this->forbidden('You do not have permission to process payments for this request.');
        }

        if (! $approvalRequest->isPaymentPending()) {
            return $this->error('This request is not awaiting payment processing.', 422);
        }

        $data = $request->validate([
            'payment_reference'  => 'required|string|max:100',
            'bank_account_code'  => 'required|string|exists:accounts,code',
            'notes'              => 'nullable|string|max:1000',
        ]);

        $entry = $this->voucherService->confirmPayment($approvalRequest, $data, $user);

        return $this->success([
            'journal_entry'   => $entry,
            'approval_request'=> $approvalRequest->fresh(['workflow', 'paymentProcessor']),
        ], 'Payment confirmed and ledger updated');
    }

    // ── eTax / FIRS ───────────────────────────────────────────────────────────

    /**
     * GET /api/accounting/etax/config/{branchId}
     */
    public function etaxConfig(int $branchId): JsonResponse
    {
        $config = EtaxConfig::where('branch_id', $branchId)->first();
        return $this->success($config);
    }

    /**
     * POST /api/accounting/etax/config/{branchId}
     */
    public function etaxConfigUpdate(Request $request, int $branchId): JsonResponse
    {
        $data = $request->validate([
            'tin'              => 'required|string',
            'taxpayer_name'    => 'required|string',
            'device_serial'    => 'nullable|string',
            'api_environment'  => 'required|in:sandbox,production',
            'api_key'          => 'nullable|string',
            'api_secret'       => 'nullable|string',
            'vat_rate'         => 'numeric|min:0|max:100',
            'is_enabled'       => 'boolean',
        ]);

        $config = EtaxConfig::updateOrCreate(['branch_id' => $branchId], $data);
        return $this->success($config, 'eTax configuration saved');
    }

    /**
     * GET /api/accounting/etax/submissions
     */
    public function etaxSubmissions(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = EtaxSubmission::with('branch:id,name')
            ->when(! $user->isSuperAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->status, fn ($q, $s) => $q->where('submission_status', $s))
            ->when($request->source_type, fn ($q, $t) => $q->where('source_type', $t))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/accounting/etax/retry/{branchId}
     * Retry all failed eTax submissions for a branch.
     */
    public function etaxRetry(int $branchId): JsonResponse
    {
        $retried = $this->etaxService->retryFailed($branchId);
        return $this->success(['retried' => $retried], "Retried {$retried} failed submissions");
    }

    /**
     * GET /api/accounting/etax/verify/{fdn}
     * Verify a Fiscal Document Number with FIRS.
     */
    public function etaxVerify(Request $request, string $fdn): JsonResponse
    {
        $result = $this->etaxService->verifyFDN($fdn, $request->user()->branch_id ?? 1);
        return $this->success($result);
    }
}
