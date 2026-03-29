/**
 * ApprovalsPage — Approval Inbox + History + Payment Queue
 *
 * Matches design Image 6:
 *   - Dark card grid of pending approval items with type icons
 *   - Gold "Approve" + gray "Reject" buttons per card
 *   - History table below with Approved/Rejected status dots
 *   - Tab: Payment Queue (for accountants)
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'
import {
  CheckCircle, XCircle, Clock, AlertTriangle, ShoppingCart,
  Package, DollarSign, Truck, BarChart2, Layers, RefreshCw,
  CreditCard, History, Inbox, ChevronRight,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

// ── Operation type metadata ───────────────────────────────────────────────────
const OP_META = {
  promotion:       { label: 'Promotion',       icon: Layers,       color: '#5B3FA6', bg: '#F0ECFB' },
  expense:         { label: 'Expense',          icon: DollarSign,   color: '#C45A00', bg: '#FEF0E6' },
  iou:             { label: 'IOU / Advance',    icon: DollarSign,   color: '#C0392B', bg: '#FDECEA' },
  travel_allowance:{ label: 'Travel Allowance', icon: Truck,        color: '#1A3FA6', bg: '#EAF0FB' },
  petty_cash:      { label: 'Petty Cash',       icon: CreditCard,   color: '#0F6E6E', bg: '#E6F5F5' },
  purchase_order:  { label: 'Purchase Order',   icon: ShoppingCart, color: '#1A3FA6', bg: '#EAF0FB' },
  stock_movement:  { label: 'Stock Movement',   icon: Package,      color: '#C45A00', bg: '#FEF0E6' },
  expiry_disposal: { label: 'Expiry Disposal',  icon: AlertTriangle,color: '#C0392B', bg: '#FDECEA' },
  wholesale_order: { label: 'Wholesale Order',  icon: Truck,        color: '#0F6E6E', bg: '#E6F5F5' },
  bulk_pricing:    { label: 'Bulk Pricing',     icon: BarChart2,    color: '#5B3FA6', bg: '#F0ECFB' },
}

function OpBadge({ type }) {
  const m = OP_META[type] ?? { label: type, icon: Clock, color: '#8A9AB5', bg: '#F0F4F8' }
  const Icon = m.icon
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:m.bg,color:m.color }}>
      <Icon size={11} /> {m.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const MAP = {
    pending:   { label:'Pending',   color:'#C45A00', bg:'#FEF0E6' },
    approved:  { label:'Approved',  color:'#1A6E3A', bg:'#EAF5EE' },
    rejected:  { label:'Rejected',  color:'#C0392B', bg:'#FDECEA' },
    cancelled: { label:'Cancelled', color:'#8A9AB5', bg:'#F0F4F8' },
    timed_out: { label:'Timed Out', color:'#C0392B', bg:'#FDECEA' },
  }
  const m = MAP[status] ?? { label:status, color:'#8A9AB5', bg:'#F0F4F8' }
  return <span style={{ display:'inline-block',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:m.bg,color:m.color }}>{m.label}</span>
}

// ── Pending approval card (Image 6 style) ─────────────────────────────────────
function ApprovalCard({ request, onDecide }) {
  const m    = OP_META[request.operation_type] ?? { label: request.operation_type, icon: Clock, color: '#8A9AB5', bg: '#F0F4F8' }
  const Icon = m.icon
  const ctx  = request.context_json ?? {}
  const amount = ctx.amount ?? ctx.total ?? ctx.total_amount ?? ctx.write_off_value ?? null

  return (
    <div style={{
      background: '#19273A',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <Icon size={16} color={m.color} />
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:'#fff' }}>{m.label}</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)' }}>
              {ctx.name ?? ctx.description ?? ctx.product_name ?? `#${request.operation_id}`}
            </div>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Details */}
      <div style={{ fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.7 }}>
        <div><span style={{ color:'rgba(255,255,255,0.35)' }}>Requested by</span> {request.requester?.name ?? '—'}</div>
        {amount !== null && (
          <div><span style={{ color:'rgba(255,255,255,0.35)' }}>Amount</span>{' '}
            <span style={{ color:'#E8A020',fontWeight:700 }}>{money(amount)}</span>
          </div>
        )}
        {ctx.quantity && (
          <div><span style={{ color:'rgba(255,255,255,0.35)' }}>Quantity</span> {ctx.quantity} units</div>
        )}
        <div><span style={{ color:'rgba(255,255,255,0.35)' }}>Stage</span> {request.current_stage} · {formatDistanceToNow(new Date(request.created_at), { addSuffix:true })}</div>
      </div>

      {/* Action buttons */}
      {request.status === 'pending' && (
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => onDecide(request, 'approved')}
            style={{ flex:1,padding:'9px 0',borderRadius:8,border:'none',cursor:'pointer',background:'var(--edlp-primary)',color:'var(--edlp-navy)',fontSize:13,fontWeight:700 }}
            onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.9)'}
            onMouseLeave={e=>e.currentTarget.style.filter=''}
          >
            Approve
          </button>
          <button
            onClick={() => onDecide(request, 'rejected')}
            style={{ flex:1,padding:'9px 0',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.75)',fontSize:13,fontWeight:700 }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(192,57,43,0.15)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore((s) => s.user)
  const [tab, setTab] = useState('inbox') // inbox | history | payment
  const [page, setPage] = useState(1)
  const [histPage, setHistPage] = useState(1)
  const [payPage, setPayPage]   = useState(1)
  const [decideTarget, setDecideTarget] = useState(null) // { request, decision }
  const [payTarget, setPayTarget]       = useState(null)

  // ── Inbox (pending — user eligible to act on) ─────────────────────────────
  const inboxQuery = useQuery({
    queryKey: ['approvals-inbox', page],
    queryFn: async () => {
      const res = await api.get('/approvals/inbox', { params: { page, per_page: 12 } })
      return res.data
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  // ── History ───────────────────────────────────────────────────────────────
  const historyQuery = useQuery({
    queryKey: ['approvals-history', histPage],
    enabled: tab === 'history',
    queryFn: async () => {
      const res = await api.get('/approvals/history', { params: { page: histPage, per_page: 15 } })
      return res.data
    },
    staleTime: 30_000,
  })

  // ── Payment Queue (approved, awaiting payment confirmation) ───────────────
  const paymentQuery = useQuery({
    queryKey: ['payment-queue', payPage],
    enabled: tab === 'payment',
    queryFn: async () => {
      const res = await api.get('/accounting/payment-queue', { params: { page: payPage, per_page: 15 } })
      return res.data
    },
    staleTime: 20_000,
  })

  // ── Pending count badge ───────────────────────────────────────────────────
  const countQuery = useQuery({
    queryKey: ['approval-count'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending-count')
      return res.data?.data?.count ?? 0
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const inbox   = inboxQuery.data?.data ?? []
  const history = historyQuery.data?.data ?? []
  const payments = paymentQuery.data?.data ?? []

  // ── Decision modal ────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  function openDecide(request, decision) {
    reset({ comment: '' })
    setDecideTarget({ request, decision })
  }

  const decideMutation = useMutation({
    mutationFn: ({ requestId, decision, comment }) =>
      api.post(`/approvals/${requestId}/decide`, { decision, comment }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-inbox'] })
      queryClient.invalidateQueries({ queryKey: ['approvals-history'] })
      queryClient.invalidateQueries({ queryKey: ['approval-count'] })
      toast.success(vars.decision === 'approved' ? 'Request approved ✓' : 'Request rejected')
      setDecideTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Action failed'),
  })

  // ── Payment confirmation modal ─────────────────────────────────────────────
  const payForm = useForm({ defaultValues: { payment_reference: '', bank_account_code: 'CASH-MAIN', notes: '' } })

  const payMutation = useMutation({
    mutationFn: ({ requestId, data }) =>
      api.post(`/accounting/payment-queue/${requestId}/confirm`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-queue'] })
      toast.success('Payment confirmed — ledger updated ✓')
      setPayTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Payment confirmation failed'),
  })

  // ── History table columns ─────────────────────────────────────────────────
  const histCols = useMemo(() => [
    { key:'type',     header:'Type',    cell:(r) => <OpBadge type={r.operation_type} /> },
    { key:'detail',   header:'Details', cell:(r) => {
      const ctx = r.context_json ?? {}
      const amount = ctx.amount ?? ctx.total ?? ctx.total_amount
      return (
        <div>
          <div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{ctx.name ?? ctx.description ?? `#${r.operation_id}`}</div>
          {amount !== null && amount !== undefined && (
            <div style={{ fontSize:11,color:'#8A9AB5' }}>{money(amount)}</div>
          )}
        </div>
      )
    }},
    { key:'requester',header:'Requested By', cell:(r) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{r.requester?.name ?? '—'}</span> },
    { key:'branch',   header:'Branch',       cell:(r) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{r.branch?.name ?? '—'}</span> },
    { key:'date',     header:'Date',         cell:(r) => <span style={{ fontSize:11,color:'#8A9AB5' }}>{format(new Date(r.created_at),'dd MMM yyyy')}</span> },
    { key:'status',   header:'Status',       cell:(r) => <StatusBadge status={r.status} /> },
    { key:'resolver', header:'Resolved By',  cell:(r) => {
      const last = r.decisions?.[0]
      return last
        ? <span style={{ fontSize:12,color:'#6B7A8D' }}>{last.decider?.name}</span>
        : '—'
    }},
  ], [])

  // ── Payment queue columns ─────────────────────────────────────────────────
  const payCols = useMemo(() => [
    { key:'type',    header:'Type',    cell:(r) => <OpBadge type={r.operation_type} /> },
    { key:'detail',  header:'Details', cell:(r) => {
      const ctx = r.context_json ?? {}
      return (
        <div>
          <div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{ctx.description ?? ctx.name ?? `Request #${r.id}`}</div>
          <div style={{ fontSize:11,color:'#E8A020',fontWeight:700 }}>{money(ctx.amount ?? ctx.total ?? 0)}</div>
        </div>
      )
    }},
    { key:'requester',header:'Requested By',  cell:(r) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{r.requester?.name}</span> },
    { key:'approved', header:'Approved',       cell:(r) => <span style={{ fontSize:11,color:'#8A9AB5' }}>{r.resolved_at ? formatDistanceToNow(new Date(r.resolved_at),{addSuffix:true}) : '—'}</span> },
    { key:'voucher',  header:'Voucher',        cell:(r) => r.journal_entries?.[0]
      ? <span style={{ fontFamily:'monospace',fontSize:11,color:'#1A3FA6' }}>{r.journal_entries[0].voucher_number}</span>
      : <span style={{ color:'#D5DFE9',fontSize:11 }}>Not posted</span>
    },
    { key:'actions',  header:'',               align:'right', cell:(r) => (
      <Btn size="sm" onClick={(e) => { e.stopPropagation(); payForm.reset({ payment_reference:'',bank_account_code:'CASH-MAIN',notes:'' }); setPayTarget(r) }}>
        Confirm Payment
      </Btn>
    )},
  ], [])

  const pendingCount = countQuery.data ?? 0

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Review, approve, and track all workflow requests across the organisation."
        actions={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {pendingCount > 0 && (
              <span style={{ padding:'4px 12px',borderRadius:20,background:'#FDECEA',color:'#C0392B',fontSize:12,fontWeight:700 }}>
                {pendingCount} pending
              </span>
            )}
            <Btn variant="secondary" icon={RefreshCw} onClick={() => {
              queryClient.invalidateQueries({ queryKey:['approvals-inbox'] })
              queryClient.invalidateQueries({ queryKey:['approval-count'] })
            }}>Refresh</Btn>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20 }}>
        {[
          { id:'inbox',   label:`Inbox${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon:Inbox },
          { id:'history', label:'History',       icon:History },
          { id:'payment', label:'Payment Queue', icon:CreditCard },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'9px 16px',fontSize:13,fontWeight:600,borderRadius:8,cursor:'pointer',
                border: tab === t.id ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
                background: tab === t.id ? 'rgba(232,160,32,0.08)' : '#fff',
                color: tab === t.id ? '#C98516' : '#8A9AB5',
              }}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── INBOX TAB ─────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <div>
          {inboxQuery.isLoading ? (
            <div style={{ textAlign:'center',padding:'48px 0',color:'#8A9AB5',fontSize:13 }}>Loading your inbox…</div>
          ) : inbox.length === 0 ? (
            <div style={{ textAlign:'center',padding:'60px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:12 }}>
              <div style={{ width:56,height:56,borderRadius:16,background:'#F0F4F8',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <CheckCircle size={26} color="#1A6E3A" />
              </div>
              <div style={{ fontSize:16,fontWeight:700,color:'#1C2B3A' }}>All clear — no pending requests</div>
              <div style={{ fontSize:13,color:'#8A9AB5' }}>Requests that match your role will appear here.</div>
            </div>
          ) : (
            <>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14,marginBottom:20 }}>
                {inbox.map(req => (
                  <ApprovalCard key={req.id} request={req} onDecide={openDecide} />
                ))}
              </div>
              {/* Pagination */}
              {inboxQuery.data?.meta && (
                <div style={{ display:'flex',justifyContent:'center',gap:8,marginTop:8 }}>
                  <Btn variant="ghost" size="sm" disabled={(inboxQuery.data.meta.current_page??1)<=1} onClick={()=>setPage(p=>p-1)}>← Prev</Btn>
                  <span style={{ fontSize:12,color:'#8A9AB5',alignSelf:'center' }}>
                    Page {inboxQuery.data.meta.current_page} of {inboxQuery.data.meta.last_page}
                  </span>
                  <Btn variant="ghost" size="sm" disabled={(inboxQuery.data.meta.current_page??1)>=(inboxQuery.data.meta.last_page??1)} onClick={()=>setPage(p=>p+1)}>Next →</Btn>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <Card>
          <div style={{ marginBottom:14,fontSize:13,color:'#8A9AB5' }}>
            Immutable audit trail of all approval requests. Exportable for compliance.
          </div>
          <DataTable
            columns={histCols}
            rows={history}
            rowKey={(r)=>r.id}
            loading={historyQuery.isLoading}
            emptyMessage="No approval history found."
            pagination={historyQuery.data?.meta ? {
              current: historyQuery.data.meta.current_page,
              last:    historyQuery.data.meta.last_page,
              total:   historyQuery.data.meta.total,
              onPage:  setHistPage,
            } : undefined}
          />
        </Card>
      )}

      {/* ── PAYMENT QUEUE TAB ─────────────────────────────────────────────── */}
      {tab === 'payment' && (
        <div>
          <div style={{ padding:'10px 16px',background:'#EAF0FB',border:'1px solid #B5D4F4',borderRadius:10,marginBottom:16,fontSize:13,color:'#1A3FA6',display:'flex',gap:10,alignItems:'flex-start' }}>
            <CreditCard size={15} style={{ flexShrink:0,marginTop:1 }} />
            <span>These requests have been fully approved and are awaiting payment disbursement. Only payable accountants configured in the workflow can confirm payment here.</span>
          </div>
          <Card>
            <DataTable
              columns={payCols}
              rows={payments}
              rowKey={(r)=>r.id}
              loading={paymentQuery.isLoading}
              emptyMessage="No approved requests awaiting payment processing."
              pagination={paymentQuery.data?.meta ? {
                current: paymentQuery.data.meta.current_page,
                last:    paymentQuery.data.meta.last_page,
                total:   paymentQuery.data.meta.total,
                onPage:  setPayPage,
              } : undefined}
            />
          </Card>
        </div>
      )}

      {/* ── Decide Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(decideTarget)}
        onClose={() => setDecideTarget(null)}
        title={decideTarget?.decision === 'approved' ? 'Approve Request' : 'Reject Request'}
        width={440}
        footer={<>
          <Btn variant="ghost" onClick={() => setDecideTarget(null)} disabled={isSubmitting}>Cancel</Btn>
          <Btn
            variant={decideTarget?.decision === 'approved' ? 'primary' : 'danger'}
            onClick={handleSubmit((d) => decideMutation.mutate({
              requestId: decideTarget.request.id,
              decision:  decideTarget.decision,
              comment:   d.comment,
            }))}
            disabled={isSubmitting || decideMutation.isPending}
          >
            {decideMutation.isPending
              ? <><Spinner size={12} /> Processing…</>
              : decideTarget?.decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'
            }
          </Btn>
        </>}
      >
        {decideTarget && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {/* Request summary */}
            <div style={{ background:'#F6F8FB',borderRadius:10,padding:'12px 16px' }}>
              <OpBadge type={decideTarget.request.operation_type} />
              <div style={{ marginTop:8,fontSize:13,fontWeight:600,color:'#1C2B3A' }}>
                {decideTarget.request.context_json?.name ??
                 decideTarget.request.context_json?.description ??
                 `Request #${decideTarget.request.id}`}
              </div>
              {(decideTarget.request.context_json?.amount ?? decideTarget.request.context_json?.total) && (
                <div style={{ fontSize:14,fontWeight:700,color:'#E8A020',marginTop:4 }}>
                  {money(decideTarget.request.context_json?.amount ?? decideTarget.request.context_json?.total)}
                </div>
              )}
              <div style={{ fontSize:12,color:'#8A9AB5',marginTop:4 }}>
                by {decideTarget.request.requester?.name} · {formatDistanceToNow(new Date(decideTarget.request.created_at), {addSuffix:true})}
              </div>
            </div>

            {/* Warning for rejections */}
            {decideTarget.decision === 'rejected' && (
              <div style={{ display:'flex',gap:10,alignItems:'flex-start',padding:'10px 14px',background:'#FDECEA',borderRadius:8,fontSize:12,color:'#C0392B' }}>
                <XCircle size={15} style={{ flexShrink:0,marginTop:1 }} />
                This action is irreversible. The requester will be notified.
              </div>
            )}

            <FormField
              label={decideTarget.decision === 'approved' ? 'Comment (optional)' : 'Rejection Reason (required for rejections)'}
              required={decideTarget.decision === 'rejected'}
            >
              <textarea
                {...register('comment', { required: decideTarget.decision === 'rejected' ? 'Please provide a reason' : false })}
                rows={3}
                placeholder={decideTarget.decision === 'approved'
                  ? 'Optional note for the audit trail…'
                  : 'Explain why this is being rejected…'}
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
                onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'}
                onBlur={e=>e.target.style.borderColor='#D5DFE9'}
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── Payment Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Confirm Payment Disbursement"
        width={480}
        footer={<>
          <Btn variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Btn>
          <Btn onClick={payForm.handleSubmit((d) => payMutation.mutate({ requestId:payTarget?.id, data:d }))} disabled={payMutation.isPending}>
            {payMutation.isPending ? <><Spinner size={12}/> Posting…</> : 'Confirm Payment & Post to Ledger'}
          </Btn>
        </>}
      >
        {payTarget && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {/* Summary */}
            <div style={{ background:'#F6F8FB',borderRadius:10,padding:'12px 16px' }}>
              <div style={{ fontSize:13,fontWeight:600,color:'#1C2B3A' }}>
                {payTarget.context_json?.description ?? payTarget.context_json?.name ?? `Request #${payTarget.id}`}
              </div>
              <div style={{ fontSize:18,fontWeight:700,color:'#E8A020',marginTop:4 }}>
                {money(payTarget.context_json?.amount ?? payTarget.context_json?.total ?? 0)}
              </div>
              <div style={{ fontSize:12,color:'#8A9AB5',marginTop:4 }}>
                Requested by {payTarget.requester?.name} · Approved {payTarget.resolved_at ? formatDistanceToNow(new Date(payTarget.resolved_at),{addSuffix:true}) : ''}
              </div>
            </div>

            <div style={{ padding:'10px 14px',background:'#EAF5EE',borderRadius:8,fontSize:12,color:'#1A6E3A' }}>
              Confirming payment will post a settlement journal entry (DR Payable → CR Bank/Cash) and update the ledger balance.
            </div>

            <FormField label="Payment Reference" required>
              <FormInput {...payForm.register('payment_reference',{required:true})} placeholder="Cheque No. / Bank Transfer Ref" />
            </FormField>

            <FormField label="Bank / Cash Account" required>
              <select {...payForm.register('bank_account_code')}
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C',background:'#fff' }}>
                <option value="CASH-MAIN">Main Cash Register</option>
                <option value="1200">GTBank Account</option>
                <option value="1210">Access Bank Account</option>
              </select>
            </FormField>

            <FormField label="Accountant Notes (optional)">
              <textarea {...payForm.register('notes')} rows={2} placeholder="Any notes for the payment record…"
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
                onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'}
                onBlur={e=>e.target.style.borderColor='#D5DFE9'}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  )
}
