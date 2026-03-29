/**
 * WorkflowConfigPage — Approval Workflow Configuration
 * Super Admin only. Configure stages, viewer roles, payment processing per workflow.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Settings, Plus, Pencil, ChevronUp, ChevronDown, X, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import {
  PageHeader, Btn, Card, Badge, Modal, FormField,
  FormInput, FormSelect, Spinner,
} from '../components/shared'

const OPERATION_TYPES = [
  'promotion','expense','iou','travel_allowance','petty_cash',
  'purchase_order','stock_movement','expiry_disposal','wholesale_order','bulk_pricing',
]

const TIMEOUT_ACTIONS = ['escalate','auto_approve','auto_reject']
const APPROVER_TYPES  = ['role','user','any_of_role']
const ALL_ROLES = [
  'super-admin','ceo','admin','accountant','receivable-accountant',
  'quality-control','b2b-sales-rep','branch-manager','cashier',
]

const GL_ACCOUNTS = [
  { code:'EXP-MISC',   name:'Miscellaneous Expenses' },
  { code:'EXP-TRAVEL', name:'Travel & Transport' },
  { code:'EXP-IOU',    name:'Staff Advances / IOU' },
  { code:'EXP-PETTY',  name:'Petty Cash Expenses' },
  { code:'EXP-DAMAGE', name:'Stock Damage Write-off' },
  { code:'EXP-EXPIRY', name:'Expiry Write-off' },
  { code:'5000',       name:'Cost of Goods Sold (COGS)' },
]

const TYPE_LABELS = {
  promotion:'Promotion', expense:'Expense', iou:'IOU / Staff Advance',
  travel_allowance:'Travel Allowance', petty_cash:'Petty Cash',
  purchase_order:'Purchase Order', stock_movement:'Stock Movement',
  expiry_disposal:'Expiry Disposal', wholesale_order:'Wholesale Order',
  bulk_pricing:'Bulk Pricing',
}

export function WorkflowConfigPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen]   = useState(false)
  const [editWorkflow, setEditWorkflow] = useState(null)

  const workflowsQuery = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      const res = await api.get('/approval-workflows')
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const workflows = workflowsQuery.data ?? []

  // Group by operation type
  const grouped = OPERATION_TYPES.reduce((acc, type) => {
    acc[type] = workflows.filter(w => w.operation_type === type)
    return acc
  }, {})

  const { register, handleSubmit, control, watch, reset, formState:{ errors, isSubmitting } } = useForm({
    defaultValues: {
      name:'', operation_type:'expense', is_active:true, description:'',
      requires_payment_processing: false,
      payment_account_code: 'EXP-MISC',
      credit_account_code: 'AP-PAYABLE',
      post_approval_viewer_roles: [],
      stages: [{ stage_order:1, stage_name:'', approver_type:'role', approver_role:'branch-manager', min_approvers:1, timeout_hours:48, timeout_action:'escalate' }],
    },
  })

  const { fields: stageFields, append: appendStage, remove: removeStage, move: moveStage } = useFieldArray({ control, name:'stages' })

  function openCreate() {
    setEditWorkflow(null)
    reset({
      name:'', operation_type:'expense', is_active:true, description:'',
      requires_payment_processing:false, payment_account_code:'EXP-MISC', credit_account_code:'AP-PAYABLE',
      post_approval_viewer_roles:[],
      stages:[{ stage_order:1,stage_name:'',approver_type:'role',approver_role:'branch-manager',min_approvers:1,timeout_hours:48,timeout_action:'escalate' }],
    })
    setModalOpen(true)
  }

  function openEdit(w) {
    setEditWorkflow(w)
    reset({
      name: w.name,
      operation_type: w.operation_type,
      is_active: w.is_active,
      description: w.description ?? '',
      requires_payment_processing: w.requires_payment_processing ?? false,
      payment_account_code: w.payment_account_code ?? 'EXP-MISC',
      credit_account_code: w.credit_account_code ?? 'AP-PAYABLE',
      post_approval_viewer_roles: w.post_approval_viewer_roles ?? [],
      stages: (w.stages ?? []).map(s => ({
        stage_order:   s.stage_order,
        stage_name:    s.stage_name,
        approver_type: s.approver_type,
        approver_role: s.approver_role ?? '',
        approver_user_id: s.approver_user_id ?? '',
        min_approvers: s.min_approvers,
        timeout_hours: s.timeout_hours,
        timeout_action:s.timeout_action,
      })),
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        stages: data.stages.map((s, i) => ({ ...s, stage_order: i + 1 })),
      }
      return editWorkflow
        ? api.put(`/approval-workflows/${editWorkflow.id}`, payload)
        : api.post('/approval-workflows', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['approval-workflows'] })
      toast.success(editWorkflow ? 'Workflow updated' : 'Workflow created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  })

  const requiresPayment = watch('requires_payment_processing')

  return (
    <div>
      <PageHeader
        title="Approval Workflow Configuration"
        subtitle="Configure who approves what, escalation rules, and post-approval access. Changes take effect immediately."
        actions={<Btn icon={Plus} onClick={openCreate}>New Workflow</Btn>}
      />

      {workflowsQuery.isLoading ? (
        <div style={{ textAlign:'center',padding:40,color:'#8A9AB5' }}>Loading workflows…</div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          {OPERATION_TYPES.map(type => {
            const wfs = grouped[type] ?? []
            if (wfs.length === 0) return null
            return (
              <Card key={type}>
                <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:12 }}>
                  {TYPE_LABELS[type]}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {wfs.map(w => (
                    <div key={w.id} style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'12px 14px',borderRadius:10,background:'#F6F8FB',gap:16 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                          <span style={{ fontWeight:700,color:'#1C2B3A',fontSize:13 }}>{w.name}</span>
                          {!w.is_active && <Badge color="default">Inactive</Badge>}
                          {w.requires_payment_processing && <Badge color="warning">Payment Workflow</Badge>}
                        </div>

                        {/* Stages preview */}
                        <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:6 }}>
                          {(w.stages ?? []).map((s, i) => (
                            <span key={i} style={{ fontSize:11,padding:'2px 10px',borderRadius:10,background:'#EAF0FB',color:'#1A3FA6',fontWeight:600 }}>
                              Stage {s.stage_order}: {s.stage_name} ({s.approver_role ?? 'User'})
                            </span>
                          ))}
                        </div>

                        {/* Post-approval viewers */}
                        {(w.post_approval_viewer_roles ?? []).length > 0 && (
                          <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#6B7A8D' }}>
                            <ShieldCheck size={11} />
                            <span>Visible after approval to: </span>
                            {(w.post_approval_viewer_roles ?? []).map(r => (
                              <span key={r} style={{ padding:'1px 7px',borderRadius:10,background:'#EAF5EE',color:'#1A6E3A',fontWeight:600 }}>{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => openEdit(w)}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:6,borderRadius:6,display:'flex' }}
                        onMouseEnter={e=>e.currentTarget.style.color='#3A4A5C'}
                        onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
                      ><Pencil size={14}/></button>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editWorkflow ? `Edit: ${editWorkflow.name}` : 'Create Workflow'} width={680}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editWorkflow ? 'Save Changes' : 'Create Workflow'}
          </Btn>
        </>}
      >
        <form style={{ display:'flex',flexDirection:'column',gap:16 }}>
          {/* Basic info */}
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:12 }}>
            <FormField label="Workflow Name" required error={errors.name?.message}>
              <FormInput register={register('name',{required:'Name required'})} placeholder="e.g. Expense Approval (High Value)" />
            </FormField>
            <FormField label="Operation Type" required>
              <FormSelect register={register('operation_type')} disabled={Boolean(editWorkflow)}>
                {OPERATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <FormField label="Description">
            <FormInput register={register('description')} placeholder="When does this workflow apply?" />
          </FormField>

          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
            <input type="checkbox" {...register('is_active')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
            Active (inactive workflows are skipped)
          </label>

          {/* ── Payment processing ─────────────────────────────────────────── */}
          <div style={{ height:1,background:'#F0F4F8' }} />
          <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.06em',textTransform:'uppercase' }}>Payment Processing</div>

          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
            <input type="checkbox" {...register('requires_payment_processing')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
            This workflow produces a payable voucher (expense, IOU, travel, petty cash)
          </label>

          {requiresPayment && (
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'12px 14px',background:'#FEF0E6',borderRadius:8 }}>
              <FormField label="GL Debit Account" hint="Expense account to charge">
                <FormSelect register={register('payment_account_code')}>
                  {GL_ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="GL Credit Account" hint="Liability account (default: AP-PAYABLE)">
                <FormInput register={register('credit_account_code')} placeholder="AP-PAYABLE" />
              </FormField>
            </div>
          )}

          {/* ── Post-approval visibility ───────────────────────────────────── */}
          <div style={{ height:1,background:'#F0F4F8' }} />
          <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.06em',textTransform:'uppercase' }}>
            Post-Approval Visibility
          </div>
          <div style={{ fontSize:12,color:'#6B7A8D',lineHeight:1.6 }}>
            Select roles that can READ this request after it is approved — even if they are not approvers.
            Ideal for payable accountants who must see approved expense requests to process payment.
          </div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
            {ALL_ROLES.map(role => {
              const viewers = watch('post_approval_viewer_roles') ?? []
              const checked = viewers.includes(role)
              return (
                <label key={role} style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                  background: checked ? '#EAF5EE' : '#F0F4F8',
                  color: checked ? '#1A6E3A' : '#6B7A8D',
                  border: `1px solid ${checked ? '#C3E6CB' : '#E5EBF2'}`,
                  transition:'all 0.15s',
                }}>
                  <input type="checkbox" style={{ display:'none' }}
                    checked={checked}
                    onChange={(e) => {
                      const current = watch('post_approval_viewer_roles') ?? []
                      const next = e.target.checked
                        ? [...current, role]
                        : current.filter(r => r !== role)
                      reset({ ...watch(), post_approval_viewer_roles: next })
                    }}
                  />
                  {checked ? '✓ ' : ''}{role}
                </label>
              )
            })}
          </div>

          {/* ── Approval Stages ────────────────────────────────────────────── */}
          <div style={{ height:1,background:'#F0F4F8' }} />
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.06em',textTransform:'uppercase' }}>Approval Stages</div>
            <Btn variant="ghost" size="sm" icon={Plus}
              onClick={() => appendStage({ stage_order:stageFields.length+1,stage_name:'',approver_type:'role',approver_role:'branch-manager',min_approvers:1,timeout_hours:48,timeout_action:'escalate' })}>
              Add Stage
            </Btn>
          </div>

          {stageFields.map((field, idx) => (
            <div key={field.id} style={{ padding:'14px',background:'#F6F8FB',borderRadius:10,border:'1px solid #E5EBF2',display:'flex',flexDirection:'column',gap:10 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#3A4A5C' }}>Stage {idx+1}</span>
                <div style={{ display:'flex',gap:4 }}>
                  {idx > 0 && (
                    <button type="button" onClick={() => moveStage(idx, idx-1)}
                      style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:4 }}>
                      <ChevronUp size={14}/>
                    </button>
                  )}
                  {idx < stageFields.length - 1 && (
                    <button type="button" onClick={() => moveStage(idx, idx+1)}
                      style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:4 }}>
                      <ChevronDown size={14}/>
                    </button>
                  )}
                  {stageFields.length > 1 && (
                    <button type="button" onClick={() => removeStage(idx)}
                      style={{ background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:4 }}>
                      <X size={14}/>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                <FormField label="Stage Name">
                  <FormInput register={register(`stages.${idx}.stage_name`)} placeholder="e.g. Branch Manager Review" />
                </FormField>
                <FormField label="Approver Type">
                  <FormSelect register={register(`stages.${idx}.approver_type`)}>
                    {APPROVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </FormSelect>
                </FormField>
                <FormField label="Approver Role">
                  <FormSelect register={register(`stages.${idx}.approver_role`)}>
                    <option value="">— select role —</option>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </FormSelect>
                </FormField>
                <FormField label="Min Approvers">
                  <FormInput register={register(`stages.${idx}.min_approvers`)} type="number" min={1} />
                </FormField>
                <FormField label="Timeout (hours)">
                  <FormInput register={register(`stages.${idx}.timeout_hours`)} type="number" min={1} />
                </FormField>
                <FormField label="On Timeout">
                  <FormSelect register={register(`stages.${idx}.timeout_action`)}>
                    {TIMEOUT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </FormSelect>
                </FormField>
              </div>
            </div>
          ))}
        </form>
      </Modal>
    </div>
  )
}
