<?php

namespace App\Services;

use App\Events\ApprovalDecisionMade;
use App\Events\ApprovalFullyApproved;
use App\Events\ApprovalRejected;
use App\Models\ApprovalDecision;
use App\Models\ApprovalRequest;
use App\Models\ApprovalStage;
use App\Models\ApprovalThreshold;
use App\Models\ApprovalWorkflow;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ApprovalWorkflowService
{
    /**
     * Initiate an approval workflow for any operation.
     *
     * @param  string  $operationType  One of ApprovalWorkflow::OPERATION_TYPES
     * @param  int     $operationId    ID of the model being approved
     * @param  User    $requestedBy    User initiating the request
     * @param  array   $context        Snapshot data for audit (e.g. ['amount' => 500000])
     * @param  int|null $branchId
     * @return ApprovalRequest
     */
    public function initiate(
        string $operationType,
        int    $operationId,
        User   $requestedBy,
        array  $context = [],
        ?int   $branchId = null
    ): ApprovalRequest {
        return DB::transaction(function () use ($operationType, $operationId, $requestedBy, $context, $branchId) {

            // Resolve which workflow to use — evaluate thresholds to potentially escalate
            $workflow = $this->resolveWorkflow($operationType, $context);

            if (! $workflow) {
                throw new \RuntimeException("No active approval workflow configured for operation type: {$operationType}");
            }

            $request = ApprovalRequest::create([
                'workflow_id'    => $workflow->id,
                'operation_type' => $operationType,
                'operation_id'   => $operationId,
                'current_stage'  => 1,
                'status'         => ApprovalRequest::STATUS_PENDING,
                'requested_by'   => $requestedBy->id,
                'branch_id'      => $branchId ?? $requestedBy->branch_id,
                'context_json'   => $context,
            ]);

            $this->notifyEligibleApprovers($request);

            return $request->load(['workflow.stages', 'requester']);
        });
    }

    /**
     * Record an approval or rejection decision for a request.
     *
     * @param  int    $requestId
     * @param  User   $decidedBy
     * @param  string $decision   'approved' | 'rejected'
     * @param  string $comment
     * @return ApprovalRequest
     */
    public function decide(int $requestId, User $decidedBy, string $decision, string $comment = ''): ApprovalRequest
    {
        return DB::transaction(function () use ($requestId, $decidedBy, $decision, $comment) {

            $request = ApprovalRequest::with(['workflow.stages'])->lockForUpdate()->findOrFail($requestId);

            if (! $request->isPending()) {
                throw new \RuntimeException('This approval request is no longer pending.');
            }

            $stage = $request->currentStageModel();

            if (! $stage) {
                throw new \RuntimeException('Current approval stage not found.');
            }

            if (! $stage->canBeApprovedBy($decidedBy)) {
                throw new \RuntimeException('You are not eligible to approve this request at the current stage.');
            }

            // Prevent duplicate decision from same user on same stage
            $alreadyDecided = ApprovalDecision::where('request_id', $request->id)
                ->where('stage_id', $stage->id)
                ->where('decided_by', $decidedBy->id)
                ->exists();

            if ($alreadyDecided) {
                throw new \RuntimeException('You have already submitted a decision for this stage.');
            }

            // Record the decision
            $decisionRecord = ApprovalDecision::create([
                'request_id' => $request->id,
                'stage_id'   => $stage->id,
                'decided_by' => $decidedBy->id,
                'decision'   => $decision,
                'comment'    => $comment,
                'decided_at' => now(),
            ]);

            event(new ApprovalDecisionMade($request, $decisionRecord, $decidedBy));

            if ($decision === 'rejected') {
                $request->update([
                    'status'           => ApprovalRequest::STATUS_REJECTED,
                    'rejection_reason' => $comment,
                    'resolved_at'      => now(),
                ]);
                event(new ApprovalRejected($request));
                return $request->fresh(['workflow.stages', 'requester', 'decisions.decider']);
            }

            // Count approvals for this stage
            $approvalCount = ApprovalDecision::where('request_id', $request->id)
                ->where('stage_id', $stage->id)
                ->where('decision', 'approved')
                ->count();

            if ($approvalCount >= $stage->min_approvers) {
                // Stage is satisfied — move to next stage or resolve
                $nextStage = $request->workflow->stages
                    ->where('stage_order', '>', $stage->stage_order)
                    ->sortBy('stage_order')
                    ->first();

                if ($nextStage) {
                    $request->update(['current_stage' => $nextStage->stage_order]);
                    $this->notifyEligibleApprovers($request->fresh());
                } else {
                    // All stages approved — fully approved
                    $request->update([
                        'status'      => ApprovalRequest::STATUS_APPROVED,
                        'resolved_at' => now(),
                    ]);
                    event(new ApprovalFullyApproved($request->fresh()));
                }
            }

            return $request->fresh(['workflow.stages', 'requester', 'decisions.decider']);
        });
    }

    /**
     * Escalate timed-out requests. Called by the scheduler.
     */
    public function escalateTimedOut(): int
    {
        $escalated = 0;

        ApprovalRequest::pending()
            ->with(['workflow.stages'])
            ->get()
            ->each(function (ApprovalRequest $request) use (&$escalated) {
                $stage = $request->currentStageModel();
                if (! $stage) return;

                $timeoutAt = $request->updated_at->addHours($stage->timeout_hours);

                if (now()->lt($timeoutAt)) return;

                try {
                    match ($stage->timeout_action) {
                        'auto_approve' => $this->autoApproveStage($request, $stage),
                        'auto_reject'  => $request->update([
                            'status'      => ApprovalRequest::STATUS_TIMED_OUT,
                            'resolved_at' => now(),
                        ]),
                        default => $this->escalateToNextStage($request, $stage),
                    };
                    $escalated++;
                } catch (\Throwable $e) {
                    Log::error("Approval escalation failed for request #{$request->id}: " . $e->getMessage());
                }
            });

        return $escalated;
    }

    /**
     * Cancel a pending approval request.
     */
    public function cancel(int $requestId, User $cancelledBy): ApprovalRequest
    {
        $request = ApprovalRequest::findOrFail($requestId);

        if (! $request->isPending()) {
            throw new \RuntimeException('Only pending requests can be cancelled.');
        }

        $request->update([
            'status'      => ApprovalRequest::STATUS_CANCELLED,
            'resolved_at' => now(),
        ]);

        return $request->fresh();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Resolve which workflow to use for an operation type,
     * accounting for threshold-based escalation rules.
     */
    private function resolveWorkflow(string $operationType, array $context): ?ApprovalWorkflow
    {
        $workflows = ApprovalWorkflow::active()
            ->forOperation($operationType)
            ->with(['thresholds.escalateTo'])
            ->get();

        if ($workflows->isEmpty()) return null;

        // Start with the first (lowest-tier) workflow
        $selected = $workflows->first();

        // Evaluate each workflow's thresholds to find if we need escalation
        foreach ($workflows as $workflow) {
            foreach ($workflow->thresholds as $threshold) {
                $contextValue = data_get($context, $threshold->field, 0);
                if ($threshold->evaluate((float) $contextValue) && $threshold->escalateTo) {
                    $selected = $threshold->escalateTo;
                }
            }
        }

        return $selected;
    }

    private function notifyEligibleApprovers(ApprovalRequest $request): void
    {
        // Dispatches in-app notification — Pusher broadcast handled by event listener
        // The actual notification is wired through Laravel Notifications in Sprint 5
        // For now: log it
        Log::info("Approval request #{$request->id} ({$request->operation_type}) awaiting stage {$request->current_stage}");
    }

    private function autoApproveStage(ApprovalRequest $request, ApprovalStage $stage): void
    {
        // System auto-approves on timeout
        $systemUser = User::where('email', 'system@edlp.ng')->first()
            ?? User::role('super-admin')->first();

        if ($systemUser) {
            ApprovalDecision::create([
                'request_id' => $request->id,
                'stage_id'   => $stage->id,
                'decided_by' => $systemUser->id,
                'decision'   => 'approved',
                'comment'    => 'Auto-approved: stage timeout exceeded',
                'decided_at' => now(),
            ]);
        }

        // Advance to next stage or resolve
        $nextStage = $request->workflow->stages
            ->where('stage_order', '>', $stage->stage_order)
            ->sortBy('stage_order')
            ->first();

        if ($nextStage) {
            $request->update(['current_stage' => $nextStage->stage_order]);
        } else {
            $request->update(['status' => ApprovalRequest::STATUS_APPROVED, 'resolved_at' => now()]);
            event(new ApprovalFullyApproved($request->fresh()));
        }
    }

    private function escalateToNextStage(ApprovalRequest $request, ApprovalStage $stage): void
    {
        $nextStage = $request->workflow->stages
            ->where('stage_order', '>', $stage->stage_order)
            ->sortBy('stage_order')
            ->first();

        if ($nextStage) {
            $request->update(['current_stage' => $nextStage->stage_order]);
            $this->notifyEligibleApprovers($request->fresh());
        } else {
            $request->update(['status' => ApprovalRequest::STATUS_TIMED_OUT, 'resolved_at' => now()]);
        }
    }
}
