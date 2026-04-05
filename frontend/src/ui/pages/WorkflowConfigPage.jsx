import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Settings, Plus, Pencil, ChevronUp, ChevronDown, X,
  ShieldCheck, BarChart2, GitBranch, CheckCircle,
  XCircle, Clock, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader, Btn, SearchInput, Card, Badge, Modal, FormField, FormInput, FormSelect, Spinner, StatCard } from '../components/shared'

const TYPE_LABELS = {
  promotion:'Promotion', expense:'Expense', iou:'IOU / Staff Advance',
  travel_allowance:'Travel Allowance', petty_cash:'Petty Cash',
  purchase_order:'Purchase Order', stock_movement:'Stock Movement',
  expiry_disposal:'Expiry Disposal', wholesale_order:'Wholesale Order',
  bulk_pricing:'Bulk Pricing',
}
const TYPE_COLORS = {
  promotion:'#5B3FA6', expense:'#C45A00', iou:'#C0392B', travel_allowance:'#1A3FA6',
  petty_cash:'#0F6E6E', purchase_order:'#1A3FA6', stock_movement:'#C45A00',
  expiry_disposal:'#C0392B', wholesale_order:'#0F6E6E', bulk_pricing:'#5B3FA6',
}
const ALL_ROLES = ['super-admin','ceo','admin','accountant','receivable-accountant','quality-control','b2b-sales-rep','branch-manager','cashier']
const GL_ACCOUNTS = [
  { code:'EXP-MISC',label:'Miscellaneous Expenses' },{ code:'EXP-TRAVEL',label:'Travel & Transport' },
  { code:'EXP-IOU',label:'Staff Advances / IOU' },{ code:'EXP-PETTY',label:'Petty Cash Expenses' },
  { code:'EXP-DAMAGE',label:'Stock Damage' },{ code:'EXP-EXPIRY',label:'Expiry Write-off' },
  { code:'5000',label:'Cost of Goods Sold' },
]

function WorkflowCard({ workflow, onEdit }) {
  const type  = workflow.operation_type
  const color = TYPE_COLORS[type] ?? '#8A9AB5'
  const bg    = `${color}10`
  return (
    <div style={{ background:'#fff',border:'1px solid #E5EBF2',borderRadius:14,padding:18,display:'flex',flexDirection:'column',gap:12,transition:'box-shadow 0.15s' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow=''}
    >
      {/* Type chip + edit */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
        <span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:bg,color }}>
          <GitBranch size={10}/>{TYPE_LABELS[type] ?? type}
        </span>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          {!workflow.is_active && <Badge color="default">Inactive</Badge>}
          {workflow.requires_payment_processing && <Badge color="warning">💰 Payment</Badge>}
          <button onClick={() => onEdit(workflow)}
            style={{ background:'none',border:'1px solid #E5EBF2',cursor:'pointer',color:'#8A9AB5',padding:'4px 8px',borderRadius:6,display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600 }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.color=color}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#E5EBF2';e.currentTarget.style.color='#8A9AB5'}}
          ><Pencil size={11}/> Edit</button>
        </div>
      </div>

      {/* Workflow name */}
      <div style={{ fontWeight:700,color:'#1C2B3A',fontSize:14,lineHeight:1.3 }}>{workflow.name}</div>

      {/* Stage pipeline visual */}
      <div style={{ display:'flex',alignItems:'center',gap:4,flexWrap:'wrap' }}>
        {(workflow.stages ?? []).map((s, i, arr) => {
          const stageKey = s.id ?? `${i}-${s.stage_name ?? ''}`
          const arrowKey = `arrow-${stageKey}`
          return [
            <span key={stageKey} style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#EAF0FB',color:'#1A3FA6',fontWeight:600,whiteSpace:'nowrap' }}>
              {s.stage_name}
            </span>,
            i < arr.length - 1 && (
              <ArrowRight key={arrowKey} size={11} color="#D5DFE9" />
            )
          ]
        }).flat()}
      </div>

      {/* Viewer roles */}
      {(workflow.post_approval_viewer_roles ?? []).length > 0 && (
        <div style={{ display:'flex',alignItems:'center',gap:5,flexWrap:'wrap' }}>
          <ShieldCheck size={11} color="#1A6E3A" />
          <span style={{ fontSize:11,color:'#8A9AB5' }}>Visible to:</span>
          {(workflow.post_approval_viewer_roles ?? []).map(r => (
            <span key={r} style={{ fontSize:10,padding:'2px 8px',borderRadius:10,background:'#EAF5EE',color:'#1A6E3A',fontWeight:600 }}>{r}</span>
          ))}
        </div>
      )}

      {/* GL accounts */}
      {workflow.payment_account_code && (
        <div style={{ fontSize:11,color:'#8A9AB5' }}>
          DR <code style={{ background:'#F0F4F8',padding:'1px 4px',borderRadius:4,color:'#C45A00' }}>{workflow.payment_account_code}</code>
          {' → CR '}
          <code style={{ background:'#F0F4F8',padding:'1px 4px',borderRadius:4,color:'#1A3FA6' }}>{workflow.credit_account_code ?? 'AP-PAYABLE'}</code>
        </div>
      )}
    </div>
  )
}

// ── Multi-step form stages ────────────────────────────────────────────────────
const FORM_STEPS = [
  { id:'basic',    label:'Basic Info',    icon:Settings },
  { id:'payment',  label:'Payment',       icon:ShieldCheck },
  { id:'viewers',  label:'Visibility',    icon:ShieldCheck },
  { id:'stages',   label:'Stages',        icon:GitBranch },
]

export function WorkflowConfigPage() {
  const queryClient = useQueryClient()
  const [mainTab, setMainTab]     = useState('workflows') // workflows | analytics
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editWorkflow, setEditWorkflow] = useState(null)
  const [step, setStep]           = useState(0) // multi-step index

  // ── Data ──────────────────────────────────────────────────────────────────
  const workflowsQuery = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      const res = await api.get('/approval-workflows')
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const analyticsQuery = useQuery({
    queryKey: ['approval-analytics'],
    enabled: mainTab === 'analytics',
    queryFn: async () => {
      const [inbox, history] = await Promise.all([
        api.get('/approvals/inbox', { params: { per_page:100 } }),
        api.get('/approvals/history', { params: { per_page:100 } }),
      ])
      return {
        pending:   inbox.data?.meta?.total ?? 0,
        history:   history.data?.data ?? [],
        meta:      history.data?.meta,
      }
    },
    staleTime: 60_000,
  })

  const workflows = workflowsQuery.data ?? []

  const filtered = useMemo(() => workflows.filter(w => {
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || w.operation_type === typeFilter
    return matchSearch && matchType
  }), [workflows, search, typeFilter])

  // Group by type for card grid
  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(w => {
      if (!g[w.operation_type]) g[w.operation_type] = []
      g[w.operation_type].push(w)
    })
    return g
  }, [filtered])

  // Analytics
  const histData = analyticsQuery.data?.history ?? []
  const analytics = useMemo(() => ({
    total:     histData.length,
    approved:  histData.filter(r => r.status === 'approved').length,
    rejected:  histData.filter(r => r.status === 'rejected').length,
    pending:   analyticsQuery.data?.pending ?? 0,
    cancelled: histData.filter(r => r.status === 'cancelled').length,
    timed_out: histData.filter(r => r.status === 'timed_out').length,
  }), [histData, analyticsQuery.data])

  // ── Form ──────────────────────────────────────────────────────────────────
  const defaultValues = {
    name:'', operation_type:'expense', is_active:true, description:'',
    requires_payment_processing:false, payment_account_code:'EXP-MISC', credit_account_code:'AP-PAYABLE',
    post_approval_viewer_roles:[],
    stages:[{ stage_order:1,stage_name:'',approver_type:'role',approver_role:'branch-manager',min_approvers:1,timeout_hours:48,timeout_action:'escalate' }],
  }

  const { register, handleSubmit, control, watch, reset, setValue, formState:{ errors, isSubmitting } } = useForm({ defaultValues })
  const { fields:stageFields, append:appendStage, remove:removeStage, move:moveStage } = useFieldArray({ control, name:'stages' })

  function openCreate() { setEditWorkflow(null); reset(defaultValues); setStep(0); setModalOpen(true) }
  function openEdit(w) {
    setEditWorkflow(w)
    reset({
      name:w.name, operation_type:w.operation_type, is_active:w.is_active, description:w.description??'',
      requires_payment_processing:w.requires_payment_processing??false,
      payment_account_code:w.payment_account_code??'EXP-MISC', credit_account_code:w.credit_account_code??'AP-PAYABLE',
      post_approval_viewer_roles:w.post_approval_viewer_roles??[],
      stages:(w.stages??[]).map(s=>({...s})),
    })
    setStep(0); setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (d) => {
      // Ensure all required backend fields are present
      const payload = {
        name: d.name,
        operation_type: d.operation_type,
        is_active: d.is_active ?? true,
        description: d.description ?? null,
        requires_payment_processing: d.requires_payment_processing ?? false,
        payment_account_code: d.payment_account_code ?? null,
        credit_account_code: d.credit_account_code ?? 'AP-PAYABLE',
        post_approval_viewer_roles: d.post_approval_viewer_roles ?? [],
        stages: d.stages.map((s, i) => ({
          stage_order: i + 1,
          stage_name: s.stage_name,
          approver_type: s.approver_type || 'role',
          approver_role: s.approver_role || null,
          approver_user_id: s.approver_user_id || null,
          min_approvers: Number(s.min_approvers) || 1,
          timeout_hours: Number(s.timeout_hours) || 48,
          timeout_action: s.timeout_action || 'escalate',
        })),
      }
      return editWorkflow ? api.put(`/approval-workflows/${editWorkflow.id}`, payload) : api.post('/approval-workflows', payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['approval-workflows'] }); toast.success(editWorkflow ? 'Workflow updated' : 'Workflow created'); setModalOpen(false) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const requiresPayment   = watch('requires_payment_processing')
  const viewerRoles       = watch('post_approval_viewer_roles') ?? []
  const OPERATION_TYPES   = Object.keys(TYPE_LABELS)

  const stepValid = useMemo(() => ({
    basic:   Boolean(watch('name') && watch('operation_type')),
    payment: true,
    viewers: true,
    stages:  stageFields.length > 0,
  }), [watch('name'), watch('operation_type'), stageFields.length])

  return (
    <div>
      <PageHeader title="Approval Workflow Configuration"
        subtitle="Design, manage and analyse all approval workflows. Changes take effect immediately."
        actions={<Btn icon={Plus} onClick={openCreate}>New Workflow</Btn>}
      />

      {/* Main tabs */}
      <div style={{ display:'flex',gap:2,marginBottom:20 }}>
        {[
          { id:'workflows', label:'Workflow Configurations', icon:GitBranch },
          { id:'analytics', label:'Analytics & Stats', icon:BarChart2 },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'9px 18px',fontSize:13,fontWeight:600,borderRadius:8,cursor:'pointer',
                border: mainTab===t.id?'1px solid var(--edlp-primary)':'1px solid #E5EBF2',
                background: mainTab===t.id?'rgba(232,160,32,0.08)':'#fff',
                color: mainTab===t.id?'#C98516':'#8A9AB5' }}>
              <Icon size={14}/>{t.label}
            </button>
          )
        })}
      </div>

      {/* ── WORKFLOWS TAB ─────────────────────────────────────────────────── */}
      {mainTab === 'workflows' && (
        <div>
          {/* Search + filter bar */}
          <div style={{ display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search workflow name…" style={{ flex:1,minWidth:220 }} />
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
              style={{ fontSize:12,padding:'8px 12px',border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C',cursor:'pointer',background:'#fff' }}>
              <option value="">All Types</option>
              {OPERATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <span style={{ fontSize:12,color:'#8A9AB5' }}>{filtered.length} workflow{filtered.length!==1?'s':''}</span>
          </div>

          {workflowsQuery.isLoading ? (
            <div style={{ textAlign:'center',padding:40,color:'#8A9AB5' }}>Loading workflows…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center',padding:60,color:'#8A9AB5',fontSize:13 }}>
              {search || typeFilter ? 'No workflows match your search.' : 'No workflows configured yet.'}
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
              {Object.entries(grouped).map(([type, wfs]) => (
                <div key={type}>
                  <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:10,paddingLeft:2 }}>
                    {TYPE_LABELS[type] ?? type} ({wfs.length})
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14 }}>
                    {wfs.map(w => <WorkflowCard key={w.id} workflow={w} onEdit={openEdit} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────────────────────── */}
      {mainTab === 'analytics' && (
        <div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20 }}>
            <StatCard label="Total Requests" value={analytics.total}     icon={BarChart2} />
            <StatCard label="Approved"        value={analytics.approved}  icon={CheckCircle} accent="#1A6E3A" />
            <StatCard label="Rejected"        value={analytics.rejected}  icon={XCircle}     accent="#C0392B" />
            <StatCard label="Pending Now"     value={analytics.pending}   icon={Clock}       accent="#C45A00" />
            <StatCard label="Cancelled"       value={analytics.cancelled} icon={X}           accent="#8A9AB5" />
            <StatCard label="Timed Out"       value={analytics.timed_out} icon={AlertTriangle} accent="#C0392B" />
          </div>
          <Card>
            <div style={{ fontSize:14,fontWeight:600,color:'#1C2B3A',marginBottom:14 }}>
              Recent Approval Activity
            </div>
            {analyticsQuery.isLoading ? (
              <div style={{ textAlign:'center',color:'#8A9AB5',padding:30 }}>Loading…</div>
            ) : (
              <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#F6F8FB' }}>
                    {['Type','Description','Requested By','Status','Date'].map(h => (
                      <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.04em',textTransform:'uppercase',whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {histData.slice(0,20).map((r) => {
                    const STATUS_C = { approved:'success', rejected:'danger', pending:'warning', cancelled:'default', timed_out:'danger' }
                    return (
                      <tr key={r.id} style={{ borderBottom:'1px solid #F0F4F8' }}>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{
                            fontSize:11,
                            padding:'2px 8px',
                            borderRadius:10,
                            background:`${TYPE_COLORS[r.operation_type] ?? '#8A9AB5'}15`,
                            color:TYPE_COLORS[r.operation_type] ?? '#8A9AB5',
                            fontWeight:600
                          }}>
                            {TYPE_LABELS[r.operation_type] ?? r.operation_type}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px',color:'#3A4A5C' }}>
                          {r.context_json?.name ?? r.context_json?.description ?? `#${r.operation_id}`}
                        </td>
                        <td style={{ padding:'10px 14px',color:'#6B7A8D',fontSize:12 }}>
                          {r.requester?.name ?? '—'}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <Badge color={STATUS_C[r.status] ?? 'default'}>{r.status}</Badge>
                        </td>
                        <td style={{ padding:'10px 14px',color:'#8A9AB5',fontSize:11 }}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-NG') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── Create / Edit Modal — Multi-step ─────────────────────────────── */}
      {modalOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(10,22,40,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',overflowY:'auto' }}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:680,boxShadow:'0 24px 80px rgba(0,0,0,0.2)',marginTop:20,marginBottom:20 }}>

            {/* Header */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid #F0F4F8' }}>
              <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:'#1C2B3A' }}>{editWorkflow ? `Edit: ${editWorkflow.name}` : 'Create Approval Workflow'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:4,display:'flex' }}><X size={18}/></button>
            </div>

            {/* Step indicator */}
            <div style={{ display:'flex',borderBottom:'1px solid #F0F4F8' }}>
              {FORM_STEPS.map((s, i) => {
                const Icon   = s.icon
                const active = step === i
                const done   = step > i
                return (
                  <button key={s.id} onClick={() => setStep(i)}
                    style={{ flex:1,padding:'12px 8px',border:'none',cursor:'pointer',background:'transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                      borderBottom: active ? '2px solid var(--edlp-primary)' : '2px solid transparent',
                      color: active ? '#C98516' : done ? '#1A6E3A' : '#8A9AB5',
                      transition:'all 0.15s',
                    }}>
                    <Icon size={14}/>
                    <span style={{ fontSize:11,fontWeight:600 }}>{s.label}</span>
                  </button>
                )
              })}
            </div>

            <form style={{ padding:'24px' }} onSubmit={handleSubmit((d) => saveMutation.mutate(d))}>
              {/* Step 0 — Basic */}
              {step === 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                  <FormField label="Workflow Name" required error={errors.name?.message}>
                    <FormInput register={register('name',{required:'Name required'})} placeholder="e.g. Expense Approval (High Value)" />
                  </FormField>
                  <FormField label="Operation Type" required>
                    <FormSelect register={register('operation_type')} disabled={Boolean(editWorkflow)}>
                      {OPERATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </FormSelect>
                  </FormField>
                  <FormField label="Description">
                    <FormInput register={register('description')} placeholder="When does this workflow apply?" />
                  </FormField>
                  <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
                    <input type="checkbox" {...register('is_active')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
                    Active (inactive workflows are skipped by the engine)
                  </label>
                </div>
              )}

              {/* Step 1 — Payment */}
              {step === 1 && (
                <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                  <div style={{ padding:'12px 16px',background:'#EAF0FB',borderRadius:10,fontSize:12,color:'#1A3FA6' }}>
                    Enable this for workflows that produce a payable voucher (expense, IOU, travel allowance). The payable accountant will see approved requests in their Payment Queue.
                  </div>
                  <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
                    <input type="checkbox" {...register('requires_payment_processing')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
                    This workflow produces a payable voucher
                  </label>
                  {requiresPayment && (
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'14px',background:'#FEF0E6',borderRadius:10 }}>
                      <FormField label="GL Debit Account" hint="Expense account to charge">
                        <FormSelect register={register('payment_account_code')}>
                          {GL_ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.code} — {a.label}</option>)}
                        </FormSelect>
                      </FormField>
                      <FormField label="GL Credit Account" hint="Default: AP-PAYABLE">
                        <FormInput register={register('credit_account_code')} placeholder="AP-PAYABLE" />
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 — Visibility */}
              {step === 2 && (
                <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                  <div style={{ fontSize:13,color:'#6B7A8D',lineHeight:1.6 }}>
                    Select roles that can READ approved requests — even if they were not approvers. Payable accountants need this to process payments.
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                    {ALL_ROLES.map(role => {
                      const checked = viewerRoles.includes(role)
                      return (
                        <label key={role} style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,
                          background: checked?'#EAF5EE':'#F0F4F8',
                          color: checked?'#1A6E3A':'#6B7A8D',
                          border:`1px solid ${checked?'#C3E6CB':'#E5EBF2'}`,
                          transition:'all 0.15s' }}>
                          <input type="checkbox" style={{ display:'none' }} checked={checked}
                            onChange={(e) => {
                              let next
                              if (e.target.checked) {
                                // Prevent duplicates
                                next = Array.from(new Set([...viewerRoles,role]))
                              } else {
                                next = viewerRoles.filter(r=>r!==role)
                              }
                              setValue('post_approval_viewer_roles', next, { shouldDirty: true, shouldTouch: true })
                            }}
                          />
                          {checked ? '✓ ':''}{role}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 3 — Stages (scrollable) */}
              {step === 3 && (
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <div style={{ fontSize:12,color:'#8A9AB5' }}>
                      {stageFields.length} stage{stageFields.length!==1?'s':''}
                    </div>
                    <Btn variant="secondary" size="sm" icon={Plus}
                      onClick={() => appendStage({ stage_order:stageFields.length+1,stage_name:'',approver_type:'role',approver_role:'branch-manager',min_approvers:1,timeout_hours:48,timeout_action:'escalate' })}>
                      Add Stage
                    </Btn>
                  </div>

                  {/* Scrollable stage list */}
                  <div style={{ maxHeight:340,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingRight:4 }}>
                    {stageFields.map((field, idx) => (
                      <div key={field.id} style={{ padding:'14px',background:'#F6F8FB',borderRadius:10,border:'1px solid #E5EBF2',display:'flex',flexDirection:'column',gap:10 }}>
                        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                            <span style={{ width:22,height:22,borderRadius:'50%',background:'var(--edlp-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--edlp-navy)',fontSize:11,fontWeight:700 }}>{idx+1}</span>
                            <span style={{ fontSize:12,fontWeight:700,color:'#3A4A5C' }}>Stage {idx+1}</span>
                          </div>
                          <div style={{ display:'flex',gap:2 }}>
                            {idx>0 && <button type="button" onClick={()=>moveStage(idx,idx-1)} style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:3 }}><ChevronUp size={13}/></button>}
                            {idx<stageFields.length-1 && <button type="button" onClick={()=>moveStage(idx,idx+1)} style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:3 }}><ChevronDown size={13}/></button>}
                            {stageFields.length>1 && <button type="button" onClick={()=>removeStage(idx)} style={{ background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:3 }}><X size={13}/></button>}
                          </div>
                        </div>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                          <FormField label="Stage Name"><FormInput register={register(`stages.${idx}.stage_name`)} placeholder="e.g. Branch Manager Review" /></FormField>
                          <FormField label="Approver Type">
                            <FormSelect register={register(`stages.${idx}.approver_type`)}>
                              <option value="role">By Role</option>
                              <option value="any_of_role">Any of Role</option>
                              <option value="user">Specific User</option>
                            </FormSelect>
                          </FormField>
                          <FormField label="Approver Role">
                            <FormSelect register={register(`stages.${idx}.approver_role`)}>
                              <option value="">—</option>
                              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </FormSelect>
                          </FormField>
                          <FormField label="Min Approvers"><FormInput register={register(`stages.${idx}.min_approvers`)} type="number" min={1} /></FormField>
                          <FormField label="Timeout (hours)"><FormInput register={register(`stages.${idx}.timeout_hours`)} type="number" min={1} /></FormField>
                          <FormField label="On Timeout" style={{ gridColumn:'1/-1' }}>
                            <FormSelect register={register(`stages.${idx}.timeout_action`)}>
                              <option value="escalate">escalate</option>
                              <option value="auto_approve">auto_approve</option>
                              <option value="auto_reject">auto_reject</option>
                            </FormSelect>
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* Footer nav */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderTop:'1px solid #F0F4F8',background:'#FAFCFF',borderRadius:'0 0 16px 16px' }}>
              <Btn variant="ghost" onClick={() => step > 0 ? setStep(s=>s-1) : setModalOpen(false)}>
                {step === 0 ? 'Cancel' : '← Back'}
              </Btn>
              {step < FORM_STEPS.length - 1 ? (
                <Btn onClick={() => setStep(s=>s+1)} disabled={!Object.values(stepValid)[step]}>Continue →</Btn>
              ) : (
                <Btn type="submit" disabled={isSubmitting || saveMutation.isPending}>
                  {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editWorkflow ? 'Save Changes' : 'Create Workflow'}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
