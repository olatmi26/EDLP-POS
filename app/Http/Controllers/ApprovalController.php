<?php

namespace App\Http\Controllers;

use App\Http\Resources\ApprovalRequestResource;
use App\Models\ApprovalDecision;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStage;
use App\Models\ApprovalThreshold;
use App\Models\ApprovalWorkflow;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    public function __construct(private readonly ApprovalWorkflowService $approvalService) {}

    // ── Approver Inbox ────────────────────────────────────────────────────────

    /**
     * GET /api/approvals/inbox
     * Pending requests the authenticated user is eligible to act on.
     */
    public function inbox(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ApprovalRequest::with([
                'workflow',
                'requester:id,name,email',
                'branch:id,name',
                'decisions.decider:id,name',
            ])
            ->scopeEligibleFor($user)
            ->when($request->operation_type, fn ($q, $t) => $q->where('operation_type', $t))
            ->when($request->branch_id && $user->isSuperAdmin(), fn ($q) => $q->where('branch_id', $request->branch_id))
            ->when(! $user->isSuperAdmin() && ! $user->isAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/approvals/history
     * Full immutable audit log.
     */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ApprovalRequest::with([
                'workflow:id,name,operation_type',
                'requester:id,name,email',
                'branch:id,name',
                'decisions.decider:id,name',
            ])
            ->when(! $user->isSuperAdmin() && ! $user->isAdmin(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->status,         fn ($q, $s) => $q->where('status', $s))
            ->when($request->operation_type, fn ($q, $t) => $q->where('operation_type', $t))
            ->when($request->branch_id && $user->isSuperAdmin(), fn ($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->date_from, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->date_to,   fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest();

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * GET /api/approvals/{request}
     * Single request detail with full decision trail.
     */
    public function show(ApprovalRequest $approvalRequest): JsonResponse
    {
        $approvalRequest->load([
            'workflow.stages.approverUser:id,name',
            'requester:id,name,email',
            'branch:id,name',
            'decisions.decider:id,name',
            'decisions.stage:id,stage_name,stage_order',
        ]);

        return $this->success($approvalRequest);
    }

    /**
     * POST /api/approvals/{request}/decide
     * Approve or reject a pending request.
     */
    public function decide(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $request->validate([
            'decision' => 'required|in:approved,rejected',
            'comment'  => 'nullable|string|max:1000',
        ]);

        $updated = $this->approvalService->decide(
            requestId: $approvalRequest->id,
            decidedBy: $request->user(),
            decision:  $request->decision,
            comment:   $request->comment ?? '',
        );

        return $this->success($updated, "Request {$request->decision}");
    }

    /**
     * DELETE /api/approvals/{request}/cancel
     * Cancel a pending request (requester or admin only).
     */
    public function cancel(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->approvalService->cancel($approvalRequest->id, $request->user());
        return $this->success(null, 'Approval request cancelled');
    }

    // ── Workflow Configuration (Super Admin only) ─────────────────────────────

    /**
     * GET /api/approval-workflows
     */
    public function workflowIndex(): JsonResponse
    {
        $workflows = ApprovalWorkflow::with(['stages.approverUser:id,name', 'thresholds.escalateTo:id,name'])
            ->orderBy('operation_type')
            ->get();

        return $this->success($workflows);
    }

    /**
     * POST /api/approval-workflows
     */
    public function workflowStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:200',
            'operation_type' => 'required|in:' . implode(',', ApprovalWorkflow::OPERATION_TYPES),
            'is_active'      => 'boolean',
            'description'    => 'nullable|string',
            'stages'         => 'required|array|min:1',
            'stages.*.stage_order'     => 'required|integer|min:1',
            'stages.*.stage_name'      => 'required|string|max:100',
            'stages.*.approver_type'   => 'required|in:role,user,any_of_role',
            'stages.*.approver_role'   => 'nullable|string',
            'stages.*.approver_user_id'=> 'nullable|integer|exists:users,id',
            'stages.*.min_approvers'   => 'integer|min:1',
            'stages.*.timeout_hours'   => 'integer|min:1',
            'stages.*.timeout_action'  => 'in:escalate,auto_approve,auto_reject',
        ]);

        $workflow = \Illuminate\Support\Facades\DB::transaction(function () use ($data) {
            $workflow = ApprovalWorkflow::create([
                'name'           => $data['name'],
                'operation_type' => $data['operation_type'],
                'is_active'      => $data['is_active'] ?? true,
                'description'    => $data['description'] ?? null,
            ]);

            foreach ($data['stages'] as $stageData) {
                $workflow->stages()->create($stageData);
            }

            return $workflow->load('stages');
        });

        return $this->created($workflow, 'Workflow created');
    }

    /**
     * PUT /api/approval-workflows/{workflow}
     */
    public function workflowUpdate(Request $request, ApprovalWorkflow $approvalWorkflow): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:200',
            'is_active'   => 'boolean',
            'description' => 'nullable|string',
            'stages'      => 'sometimes|array|min:1',
            'stages.*.stage_order'     => 'required_with:stages|integer|min:1',
            'stages.*.stage_name'      => 'required_with:stages|string|max:100',
            'stages.*.approver_type'   => 'required_with:stages|in:role,user,any_of_role',
            'stages.*.approver_role'   => 'nullable|string',
            'stages.*.approver_user_id'=> 'nullable|integer|exists:users,id',
            'stages.*.min_approvers'   => 'integer|min:1',
            'stages.*.timeout_hours'   => 'integer|min:1',
            'stages.*.timeout_action'  => 'in:escalate,auto_approve,auto_reject',
        ]);

        \Illuminate\Support\Facades\DB::transaction(function () use ($approvalWorkflow, $data) {
            $approvalWorkflow->update(\Illuminate\Support\Arr::except($data, ['stages']));

            if (isset($data['stages'])) {
                $approvalWorkflow->stages()->delete();
                foreach ($data['stages'] as $stageData) {
                    $approvalWorkflow->stages()->create($stageData);
                }
            }
        });

        return $this->success($approvalWorkflow->load('stages'), 'Workflow updated');
    }

    /**
     * GET /api/approval-workflows/pending-count
     * Badge count for sidebar notification.
     */
    public function pendingCount(Request $request): JsonResponse
    {
        $count = ApprovalRequest::scopeEligibleFor($request->user())->count();
        return $this->success(['count' => $count]);
    }
}
