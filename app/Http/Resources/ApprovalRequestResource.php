<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApprovalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'workflow_id'    => $this->workflow_id,
            'operation_type' => $this->operation_type,
            'operation_id'   => $this->operation_id,
            'current_stage'  => $this->current_stage,
            'status'         => $this->status,
            'requested_by'   => $this->requested_by,
            'branch_id'      => $this->branch_id,
            'context_json'   => $this->context_json,
            'rejection_reason' => $this->rejection_reason,
            'resolved_at'    => $this->resolved_at?->toISOString(),
            'created_at'     => $this->created_at?->toISOString(),
            'updated_at'     => $this->updated_at?->toISOString(),

            // Relationships
            'workflow'   => $this->whenLoaded('workflow', fn () => [
                'id'             => $this->workflow->id,
                'name'           => $this->workflow->name,
                'operation_type' => $this->workflow->operation_type,
                'stages'         => $this->workflow->relationLoaded('stages')
                    ? $this->workflow->stages->map(fn ($s) => [
                        'id'             => $s->id,
                        'stage_order'    => $s->stage_order,
                        'stage_name'     => $s->stage_name,
                        'approver_type'  => $s->approver_type,
                        'approver_role'  => $s->approver_role,
                        'approver_user_id' => $s->approver_user_id,
                        'min_approvers'  => $s->min_approvers,
                        'timeout_hours'  => $s->timeout_hours,
                        'timeout_action' => $s->timeout_action,
                    ])
                    : [],
            ]),

            'requester'  => $this->whenLoaded('requester', fn () => [
                'id'    => $this->requester->id,
                'name'  => $this->requester->name,
                'email' => $this->requester->email,
            ]),

            'branch'     => $this->whenLoaded('branch', fn () => [
                'id'   => $this->branch->id,
                'name' => $this->branch->name,
            ]),

            'decisions'  => $this->whenLoaded('decisions', fn () =>
                $this->decisions->map(fn ($d) => [
                    'id'         => $d->id,
                    'stage_id'   => $d->stage_id,
                    'decided_by' => $d->decided_by,
                    'decision'   => $d->decision,
                    'comment'    => $d->comment,
                    'decided_at' => $d->decided_at?->toISOString(),
                    'decider'    => $d->relationLoaded('decider') ? [
                        'id'   => $d->decider->id,
                        'name' => $d->decider->name,
                    ] : null,
                    'stage' => $d->relationLoaded('stage') ? [
                        'id'          => $d->stage->id,
                        'stage_name'  => $d->stage->stage_name,
                        'stage_order' => $d->stage->stage_order,
                    ] : null,
                ])
            ),
        ];
    }
}
