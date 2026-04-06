import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'
import {
  CheckCircle, XCircle, Clock, AlertTriangle, ShoppingCart,
  Package, DollarSign, Truck, BarChart2, Layers, RefreshCw,
  CreditCard, History, Inbox,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner,
} from '../components/shared'

// ── Operation type metadata ──────────────────────────────────────────────────
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
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: m.bg, color: m.color }}>
      <Icon size={11} /> {m.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const MAP = {
    pending:   { label: 'Pending',   color: '#C45A00', bg: '#FEF0E6' },
    approved:  { label: 'Approved',  color: '#1A6E3A', bg: '#EAF5EE' },
    rejected:  { label: 'Rejected',  color: '#C0392B', bg: '#FDECEA' },
    cancelled: { label: 'Cancelled', color: '#8A9AB5', bg: '#F0F4F8' },
    timed_out: { label: 'Timed Out', color: '#C0392B', bg: '#FDECEA' },
  }
  const m = MAP[status] ?? { label: status, color: '#8A9AB5', bg: '#F0F4F8' }
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

// ── Pending approval card ─────────────────────────────────────────────────────
function ApprovalCard({ request, onDecide }) {
  const m    = OP_META[request.operation_type] ?? { label: request.operation_type, icon: Clock, color: '#8A9AB5', bg: '#F0F4F8' }
  const Icon = m.icon
  const ctx  = request.context_json ?? {}
  const amount = ctx.amount ?? ctx.total ?? ctx.total_amount ?? ctx.write_off_value ?? null

  return (
    <div className="bg-[#19273A] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: m.bg }}>
            <Icon size={16} color={m.color} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{m.label}</div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {ctx.name ?? ctx.description ?? ctx.product_name ?? `#${request.operation_id}`}
            </div>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Details */}
      <div className="text-xs text-white/60 leading-relaxed space-y-0.5">
        <div><span className="text-white/30">Requested by</span> {request.requester?.name ?? '—'}</div>
        {amount !== null && (
          <div>
            <span className="text-white/30">Amount</span>{' '}
            <span className="text-[#E8A020] font-bold">{money(amount)}</span>
          </div>
        )}
        {ctx.quantity && (
          <div><span className="text-white/30">Quantity</span> {ctx.quantity} units</div>
        )}
        <div>
          <span className="text-white/30">Stage</span> {request.current_stage} · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
        </div>
      </div>

      {/* Action buttons */}
      {request.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onDecide(request, 'approved')}
            className="flex-1 py-2.5 rounded-xl border-0 cursor-pointer bg-[#E8A020] text-[#0A1628] text-sm font-bold transition-all hover:brightness-90"
          >
            Approve
          </button>
          <button
            onClick={() => onDecide(request, 'rejected')}
            className="flex-1 py-2.5 rounded-xl cursor-pointer bg-white/[0.06] border border-white/[0.12] text-white/75 text-sm font-bold transition-all hover:bg-red-900/20"
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
  const [tab, setTab]           = useState('inbox')
  const [page, setPage]         = useState(1)
  const [histPage, setHistPage] = useState(1)
  const [payPage, setPayPage]   = useState(1)
  const [decideTarget, setDecideTarget] = useState(null)
  const [payTarget, setPayTarget]       = useState(null)

  const inboxQuery = useQuery({
    queryKey: ['approvals-inbox', page],
    queryFn: async () => {
      const res = await api.get('/approvals/inbox', { params: { page, per_page: 12 } })
      return res.data
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const historyQuery = useQuery({
    queryKey: ['approvals-history', histPage],
    enabled: tab === 'history',
    queryFn: async () => {
      const res = await api.get('/approvals/history', { params: { page: histPage, per_page: 15 } })
      return res.data
    },
    staleTime: 30_000,
  })

  const paymentQuery = useQuery({
    queryKey: ['payment-queue', payPage],
    enabled: tab === 'payment',
    queryFn: async () => {
      const res = await api.get('/accounting/payment-queue', { params: { page: payPage, per_page: 15 } })
      return res.data
    },
    staleTime: 20_000,
  })

  const countQuery = useQuery({
    queryKey: ['approval-count'],
    queryFn: async () => {
      const res = await api.get('/approvals/pending-count')
      return res.data?.data?.count ?? 0
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const inbox    = inboxQuery.data?.data ?? []
  const history  = historyQuery.data?.data ?? []
  const payments = paymentQuery.data?.data ?? []

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

  const histCols = useMemo(() => [
    { key: 'type',     header: 'Type',    cell: (r) => <OpBadge type={r.operation_type} /> },
    { key: 'detail',   header: 'Details', cell: (r) => {
      const ctx = r.context_json ?? {}
      const amount = ctx.amount ?? ctx.total ?? ctx.total_amount
      return (
        <div>
          <div className="font-semibold text-[#1C2B3A] text-sm">{ctx.name ?? ctx.description ?? `#${r.operation_id}`}</div>
          {amount != null && <div className="text-[11px] text-[#8A9AB5]">{money(amount)}</div>}
        </div>
      )
    }},
    { key: 'requester', header: 'Requested By', cell: (r) => <span className="text-xs text-[#6B7A8D]">{r.requester?.name ?? '—'}</span> },
    { key: 'branch',    header: 'Branch',        cell: (r) => <span className="text-xs text-[#6B7A8D]">{r.branch?.name ?? '—'}</span> },
    { key: 'date',      header: 'Date',          cell: (r) => <span className="text-[11px] text-[#8A9AB5]">{format(new Date(r.created_at), 'dd MMM yyyy')}</span> },
    { key: 'status',    header: 'Status',        cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'resolver',  header: 'Resolved By',   cell: (r) => {
      const last = r.decisions?.[0]
      return last ? <span className="text-xs text-[#6B7A8D]">{last.decider?.name}</span> : '—'
    }},
  ], [])

  const payCols = useMemo(() => [
    { key: 'type',     header: 'Type',   cell: (r) => <OpBadge type={r.operation_type} /> },
    { key: 'detail',   header: 'Details', cell: (r) => {
      const ctx = r.context_json ?? {}
      return (
        <div>
          <div className="font-semibold text-[#1C2B3A] text-sm">{ctx.description ?? ctx.name ?? `Request #${r.id}`}</div>
          <div className="text-[11px] text-[#E8A020] font-bold">{money(ctx.amount ?? ctx.total ?? 0)}</div>
        </div>
      )
    }},
    { key: 'requester', header: 'Requested By',  cell: (r) => <span className="text-xs text-[#6B7A8D]">{r.requester?.name}</span> },
    { key: 'approved',  header: 'Approved',       cell: (r) => <span className="text-[11px] text-[#8A9AB5]">{r.resolved_at ? formatDistanceToNow(new Date(r.resolved_at), { addSuffix: true }) : '—'}</span> },
    { key: 'voucher',   header: 'Voucher',        cell: (r) => r.journal_entries?.[0]
      ? <code className="font-mono text-[11px] text-[#1A3FA6]">{r.journal_entries[0].voucher_number}</code>
      : <span className="text-[#D5DFE9] text-[11px]">Not posted</span>
    },
    { key: 'actions',   header: '', align: 'right', cell: (r) => (
      <Btn size="sm" onClick={(e) => { e.stopPropagation(); payForm.reset({ payment_reference: '', bank_account_code: 'CASH-MAIN', notes: '' }); setPayTarget(r) }}>
        Confirm Payment
      </Btn>
    )},
  ], [])

  const pendingCount = countQuery.data ?? 0

  const TABS = [
    { id: 'inbox',   label: `Inbox${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: Inbox },
    { id: 'history', label: 'History',       icon: History },
    { id: 'payment', label: 'Payment Queue', icon: CreditCard },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Approvals"
        subtitle="Review, approve, and track all workflow requests across the organisation."
        actions={
          <div className="flex gap-2 items-center">
            {pendingCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-[#FDECEA] text-[#C0392B] text-xs font-bold">
                {pendingCount} pending
              </span>
            )}
            <Btn variant="secondary" icon={RefreshCw} onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['approvals-inbox'] })
              queryClient.invalidateQueries({ queryKey: ['approval-count'] })
            }}>Refresh</Btn>
          </div>
        }
      />

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border cursor-pointer transition-all ${
              tab === id
                ? 'bg-[rgba(232,160,32,0.08)] border-[#E8A020] text-[#C98516]'
                : 'bg-white border-[#E5EBF2] text-[#8A9AB5] hover:bg-[#F8FAFC]'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── INBOX ─────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <div>
          {inboxQuery.isLoading ? (
            <div className="text-center py-12 text-[#8A9AB5] text-sm">Loading your inbox…</div>
          ) : inbox.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#F0F4F8] flex items-center justify-center">
                <CheckCircle size={26} color="#1A6E3A" />
              </div>
              <div className="text-base font-bold text-[#1C2B3A]">All clear — no pending requests</div>
              <div className="text-sm text-[#8A9AB5]">Requests that match your role will appear here.</div>
            </div>
          ) : (
            <>
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {inbox.map(req => (
                  <ApprovalCard key={req.id} request={req} onDecide={openDecide} />
                ))}
              </div>
              {inboxQuery.data?.meta && (
                <div className="flex justify-center gap-2 mt-4 items-center">
                  <Btn variant="ghost" size="sm" disabled={(inboxQuery.data.meta.current_page ?? 1) <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
                  <span className="text-xs text-[#8A9AB5]">
                    Page {inboxQuery.data.meta.current_page} of {inboxQuery.data.meta.last_page}
                  </span>
                  <Btn variant="ghost" size="sm" disabled={(inboxQuery.data.meta.current_page ?? 1) >= (inboxQuery.data.meta.last_page ?? 1)} onClick={() => setPage(p => p + 1)}>Next →</Btn>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HISTORY ───────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <Card>
          <p className="text-sm text-[#8A9AB5] mb-4">
            Immutable audit trail of all approval requests. Exportable for compliance.
          </p>
          <DataTable
            columns={histCols}
            rows={history}
            rowKey={(r) => r.id}
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

      {/* ── PAYMENT QUEUE ─────────────────────────────────────────────── */}
      {tab === 'payment' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2.5 items-start px-4 py-3 bg-[#EAF0FB] border border-[#B5D4F4] rounded-xl text-sm text-[#1A3FA6]">
            <CreditCard size={15} className="flex-shrink-0 mt-0.5" />
            <span>These requests have been fully approved and are awaiting payment disbursement. Only payable accountants configured in the workflow can confirm payment here.</span>
          </div>
          <Card>
            <DataTable
              columns={payCols}
              rows={payments}
              rowKey={(r) => r.id}
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

      {/* ── Decide Modal ──────────────────────────────────────────────── */}
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
          <div className="flex flex-col gap-4">
            <div className="bg-[#F6F8FB] rounded-xl p-4">
              <OpBadge type={decideTarget.request.operation_type} />
              <div className="mt-2 text-sm font-semibold text-[#1C2B3A]">
                {decideTarget.request.context_json?.name ??
                 decideTarget.request.context_json?.description ??
                 `Request #${decideTarget.request.id}`}
              </div>
              {(decideTarget.request.context_json?.amount ?? decideTarget.request.context_json?.total) && (
                <div className="text-sm font-bold text-[#E8A020] mt-1">
                  {money(decideTarget.request.context_json?.amount ?? decideTarget.request.context_json?.total)}
                </div>
              )}
              <div className="text-xs text-[#8A9AB5] mt-1">
                by {decideTarget.request.requester?.name} · {formatDistanceToNow(new Date(decideTarget.request.created_at), { addSuffix: true })}
              </div>
            </div>

            {decideTarget.decision === 'rejected' && (
              <div className="flex gap-2.5 items-start px-3.5 py-2.5 bg-[#FDECEA] rounded-xl text-xs text-[#C0392B]">
                <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                This action is irreversible. The requester will be notified.
              </div>
            )}

            <FormField
              label={decideTarget.decision === 'approved' ? 'Comment (optional)' : 'Rejection Reason *'}
              required={decideTarget.decision === 'rejected'}
            >
              <textarea
                {...register('comment', { required: decideTarget.decision === 'rejected' ? 'Please provide a reason' : false })}
                rows={3}
                placeholder={decideTarget.decision === 'approved' ? 'Optional note for the audit trail…' : 'Explain why this is being rejected…'}
                className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical text-[#3A4A5C] focus:border-[#E8A020] transition-colors box-border"
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── Payment Confirmation Modal ─────────────────────────────────── */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Confirm Payment Disbursement"
        width={480}
        footer={<>
          <Btn variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Btn>
          <Btn onClick={payForm.handleSubmit((d) => payMutation.mutate({ requestId: payTarget?.id, data: d }))} disabled={payMutation.isPending}>
            {payMutation.isPending ? <><Spinner size={12} /> Posting…</> : 'Confirm Payment & Post to Ledger'}
          </Btn>
        </>}
      >
        {payTarget && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#F6F8FB] rounded-xl p-4">
              <div className="text-sm font-semibold text-[#1C2B3A]">
                {payTarget.context_json?.description ?? payTarget.context_json?.name ?? `Request #${payTarget.id}`}
              </div>
              <div className="text-lg font-bold text-[#E8A020] mt-1">
                {money(payTarget.context_json?.amount ?? payTarget.context_json?.total ?? 0)}
              </div>
              <div className="text-xs text-[#8A9AB5] mt-1">
                Requested by {payTarget.requester?.name} · Approved {payTarget.resolved_at ? formatDistanceToNow(new Date(payTarget.resolved_at), { addSuffix: true }) : ''}
              </div>
            </div>

            <div className="px-3.5 py-2.5 bg-[#EAF5EE] rounded-xl text-xs text-[#1A6E3A]">
              Confirming payment will post a settlement journal entry (DR Payable → CR Bank/Cash) and update the ledger balance.
            </div>

            <FormField label="Payment Reference" required>
              <FormInput {...payForm.register('payment_reference', { required: true })} placeholder="Cheque No. / Bank Transfer Ref" />
            </FormField>

            <FormField label="Bank / Cash Account" required>
              <select
                {...payForm.register('bank_account_code')}
                className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none bg-white text-[#3A4A5C]"
              >
                <option value="CASH-MAIN">Main Cash Register</option>
                <option value="1200">GTBank Account</option>
                <option value="1210">Access Bank Account</option>
              </select>
            </FormField>

            <FormField label="Accountant Notes (optional)">
              <textarea
                {...payForm.register('notes')}
                rows={2}
                placeholder="Any notes for the payment record…"
                className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical text-[#3A4A5C] focus:border-[#E8A020] transition-colors box-border"
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  )
}
