import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import { format, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardCheck, AlertTriangle, RefreshCw, Clock, Trash2, Plus, X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

// ── Schemas ──────────────────────────────────────────────────────────────────
const inOutSchema = z.object({
  product_id: z.coerce.number().min(1, 'Select a product'),
  quantity:   z.coerce.number().min(1, 'Min 1'),
  notes:      z.string().optional(),
})

const adjustSchema = z.object({
  type:     z.enum(['add', 'remove', 'set']),
  quantity: z.coerce.number().min(0),
  notes:    z.string().optional(),
})

const disposalSchema = z.object({
  batch_id:        z.coerce.number().min(1),
  quantity:        z.coerce.number().min(1, 'Min 1'),
  reason:          z.string().min(1, 'Select reason'),
  disposal_method: z.string().min(1, 'Select method'),
  notes:           z.string().optional(),
})

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'list',      label: 'All Stock',        icon: Package },
  { id: 'in',        label: 'Stock In',          icon: ArrowDownToLine },
  { id: 'out',       label: 'Stock Out',         icon: ArrowUpFromLine },
  { id: 'transfer',  label: 'Transfers',         icon: ArrowLeftRight },
  { id: 'stocktake', label: 'Stock-Take',        icon: ClipboardCheck },
  { id: 'low',       label: 'Low Stock',         icon: AlertTriangle },
  { id: 'expiry',    label: 'Expiry & Batches',  icon: Clock },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function ViewOnly({ icon: Icon, message }) {
  return (
    <div className="bg-white border border-[#E5EBF2] rounded-2xl p-12 text-center text-[#8A9AB5]">
      <Icon size={40} color="#E5EBF2" className="mx-auto mb-4" />
      <div className="text-sm font-bold text-[#1C2B3A] mb-1.5">View Only</div>
      <div className="text-sm">{message ?? 'Only administrators can perform this action.'}</div>
    </div>
  )
}

function expiryUrgency(expiryDate) {
  try {
    const days = differenceInDays(parseISO(expiryDate), new Date())
    if (days < 0)  return { label: 'Expired',  color: '#C0392B', bg: '#FDECEA', days }
    if (days < 7)  return { label: 'Critical', color: '#C0392B', bg: '#FDECEA', days }
    if (days < 30) return { label: 'Warning',  color: '#C45A00', bg: '#FEF0E6', days }
    if (days < 60) return { label: 'Watch',    color: '#5B3FA6', bg: '#F0ECFB', days }
    return            { label: 'OK',      color: '#1A6E3A', bg: '#EAF5EE', days }
  } catch { return { label: 'Unknown', color: '#8A9AB5', bg: '#F0F4F8', days: 0 } }
}

function NumberedPagination({ current, last, total, onPage }) {
  if (!last || last <= 1) return null
  const pages = []
  const range = 2
  for (let i = 1; i <= last; i++) {
    if (i === 1 || i === last || (i >= current - range && i <= current + range)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }
  return (
    <div className="flex items-center justify-center gap-1 p-3.5 border-t border-[#F0F4F8]">
      <button
        onClick={() => onPage(current - 1)} disabled={current <= 1}
        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${current <= 1 ? 'border-[#E5EBF2] text-[#D5DFE9] cursor-not-allowed' : 'border-[#E5EBF2] text-[#3A4A5C] cursor-pointer hover:bg-[#F8FAFC]'}`}
      >←</button>
      {pages.map((p, i) => (
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-[#8A9AB5] text-xs">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${p === current ? 'border-[#E8A020] bg-[rgba(232,160,32,0.1)] text-[#C98516]' : 'border-[#E5EBF2] text-[#3A4A5C] hover:bg-[#F8FAFC]'}`}
          >{p}</button>
        )
      ))}
      <button
        onClick={() => onPage(current + 1)} disabled={current >= last}
        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${current >= last ? 'border-[#E5EBF2] text-[#D5DFE9] cursor-not-allowed' : 'border-[#E5EBF2] text-[#3A4A5C] cursor-pointer hover:bg-[#F8FAFC]'}`}
      >→</button>
      <span className="text-[11px] text-[#8A9AB5] ml-2">{total} records</span>
    </div>
  )
}

// ── Stock In Tab ──────────────────────────────────────────────────────────────
function StockInTab({ products, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id: '', quantity: 1, notes: '' } })
  const mut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, type: 'add' }),
    onSuccess: () => { toast.success('Stock added'); form.reset({ product_id: '', quantity: 1, notes: '' }); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to add stock'),
  })
  if (!isAdminLike) return <ViewOnly icon={ArrowDownToLine} message="Only administrators can add stock." />
  return (
    <div className="bg-white border border-[#E5EBF2] rounded-2xl p-6 max-w-lg">
      <div className="text-sm font-bold text-[#1C2B3A] mb-1">Add Stock</div>
      <div className="text-sm text-[#8A9AB5] mb-5">Record incoming deliveries and restocks.</div>
      <div className="flex flex-col gap-4">
        <FormField label="Product *" error={form.formState.errors.product_id?.message}>
          <FormSelect register={form.register('product_id')}>
            <option value="">Select product…</option>
            {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormSelect>
        </FormField>
        <FormField label="Quantity *" error={form.formState.errors.quantity?.message}>
          <FormInput register={form.register('quantity')} type="number" min={1} placeholder="0" />
        </FormField>
        <FormField label="Notes / Reference">
          <textarea {...form.register('notes')} rows={2} placeholder="Delivery reference, supplier name…"
            className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical text-[#3A4A5C] focus:border-[#E8A020] transition-colors box-border" />
        </FormField>
        <div className="px-3.5 py-2.5 bg-[#FDF3DC] rounded-xl text-xs text-[#855000]">
          💡 For large supplier deliveries, use <strong>Purchase Orders</strong> — it creates FEFO batches with expiry dates automatically.
        </div>
        <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Adding…</> : <><ArrowDownToLine size={14} /> Add Stock</>}
        </Btn>
      </div>
    </div>
  )
}

// ── Stock Out Tab ─────────────────────────────────────────────────────────────
function StockOutTab({ products, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id: '', quantity: 1, notes: '' } })
  const mut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, type: 'remove' }),
    onSuccess: () => { toast.success('Stock removed'); form.reset({ product_id: '', quantity: 1, notes: '' }); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  if (!isAdminLike) return <ViewOnly icon={ArrowUpFromLine} message="Only administrators can remove stock." />
  return (
    <div className="bg-white border border-[#E5EBF2] rounded-2xl p-6 max-w-lg">
      <div className="text-sm font-bold text-[#1C2B3A] mb-1">Remove Stock</div>
      <div className="text-sm text-[#8A9AB5] mb-5">Record stock removed without a sale.</div>
      <div className="flex flex-col gap-4">
        <FormField label="Product *" error={form.formState.errors.product_id?.message}>
          <FormSelect register={form.register('product_id')}>
            <option value="">Select product…</option>
            {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormSelect>
        </FormField>
        <FormField label="Quantity *" error={form.formState.errors.quantity?.message}>
          <FormInput register={form.register('quantity')} type="number" min={1} placeholder="0" />
        </FormField>
        <FormField label="Reason / Notes">
          <textarea {...form.register('notes')} rows={2} placeholder="Reason for removal…"
            className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical text-[#3A4A5C] focus:border-[#E8A020] transition-colors box-border" />
        </FormField>
        <Btn variant="danger" onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Removing…</> : <><ArrowUpFromLine size={14} /> Remove Stock</>}
        </Btn>
      </div>
    </div>
  )
}

// ── Transfer Tab ──────────────────────────────────────────────────────────────
function TransferTab({ branches, isAdminLike }) {
  const queryClient = useQueryClient()
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch]     = useState('')
  const [notes, setNotes]           = useState('')
  const [lines, setLines]           = useState([{ product_id: '', quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)

  const fromInventoryQ = useQuery({
    queryKey: ['inventory-branch', fromBranch],
    enabled: Boolean(fromBranch),
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { branch_id: fromBranch, all: true, per_page: 500 } })
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const fromProducts = fromInventoryQ.data ?? []

  function addLine() { setLines(l => [...l, { product_id: '', quantity: 1 }]) }
  function removeLine(i) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i, field, val) { setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln)) }

  async function submit() {
    if (!fromBranch) { toast.error('Select source branch'); return }
    if (!toBranch)   { toast.error('Select destination branch'); return }
    if (fromBranch === toBranch) { toast.error('Source and destination must be different'); return }
    const validLines = lines.filter(l => l.product_id && Number(l.quantity) >= 1)
    if (validLines.length === 0) { toast.error('Add at least one product to transfer'); return }
    setSubmitting(true)
    try {
      const results = await Promise.allSettled(
        validLines.map(l => api.post('/inventory/transfer', {
          product_id: Number(l.product_id), from_branch_id: Number(fromBranch),
          to_branch_id: Number(toBranch), quantity: Number(l.quantity), notes,
        }))
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed    = results.filter(r => r.status === 'rejected').length
      if (succeeded > 0) {
        toast.success(`${succeeded} transfer${succeeded > 1 ? 's' : ''} requested — pending approval`)
        setLines([{ product_id: '', quantity: 1 }])
        setNotes('')
        queryClient.invalidateQueries({ queryKey: ['inventory'] })
      }
      if (failed > 0) toast.error(`${failed} transfer${failed > 1 ? 's' : ''} failed`)
    } finally { setSubmitting(false) }
  }

  if (!isAdminLike) return <ViewOnly icon={ArrowLeftRight} message="Only administrators can initiate stock transfers." />

  return (
    <div className="bg-white border border-[#E5EBF2] rounded-2xl p-6 max-w-2xl">
      <div className="text-sm font-bold text-[#1C2B3A] mb-1">Inter-Branch Transfer</div>
      <div className="text-sm text-[#8A9AB5] mb-5">Transfer multiple products between branches in one request. Each line requires approval.</div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold text-[#3A4A5C] block mb-1.5">From Branch *</label>
          <select value={fromBranch} onChange={e => { setFromBranch(e.target.value); setLines([{ product_id: '', quantity: 1 }]) }}
            className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none bg-white text-[#3A4A5C]">
            <option value="">Select source branch…</option>
            {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#3A4A5C] block mb-1.5">To Branch *</label>
          <select value={toBranch} onChange={e => setToBranch(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none bg-white text-[#3A4A5C]">
            <option value="">Select destination branch…</option>
            {(branches ?? []).filter(b => String(b.id) !== fromBranch).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-[#3A4A5C] mb-2.5">
          Products to Transfer {fromBranch ? `(${fromProducts.length} available at source)` : ''}
        </div>
        {fromBranch && fromInventoryQ.isLoading && (
          <div className="py-5 text-center text-[#8A9AB5] text-sm">
            Loading {branches.find(b => String(b.id) === fromBranch)?.name} inventory…
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: '1fr 120px 36px' }}>
            <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
              className="px-2.5 py-2 text-sm border border-[#D5DFE9] rounded-xl outline-none bg-white w-full">
              <option value="">Select product…</option>
              {fromProducts.map(inv => (
                <option key={inv.product_id} value={inv.product_id}>
                  {inv.product?.name ?? `#${inv.product_id}`} — Stock: {inv.quantity}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)}
              placeholder="Qty"
              className="px-2.5 py-2 text-sm border border-[#D5DFE9] rounded-xl outline-none w-full box-border" />
            <button onClick={() => removeLine(i)} disabled={lines.length === 1}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all ${lines.length === 1 ? 'border-[#E5EBF2] bg-[#F8FAFC] text-[#D5DFE9] cursor-not-allowed' : 'border-[#FDECEA] bg-[#FDECEA] text-[#C0392B] cursor-pointer hover:brightness-95'}`}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button onClick={addLine}
          className="flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-[#D5DFE9] rounded-xl bg-transparent cursor-pointer text-xs text-[#1A3FA6] font-semibold hover:border-[#1A3FA6] transition-colors">
          <Plus size={13} /> Add another product
        </button>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold text-[#3A4A5C] block mb-1.5">Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Transfer reason, reference number…"
          className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical text-[#3A4A5C] box-border focus:border-[#E8A020] transition-colors" />
      </div>

      <div className="flex items-center gap-3">
        <Btn onClick={submit} disabled={submitting || !fromBranch || !toBranch}>
          {submitting ? <><Spinner size={12} /> Submitting…</> : <><ArrowLeftRight size={14} /> Request Transfer ({lines.filter(l => l.product_id).length} items)</>}
        </Btn>
        <span className="text-xs text-[#8A9AB5]">Requires branch manager approval</span>
      </div>
    </div>
  )
}

// ── Expiry & Batches Tab ──────────────────────────────────────────────────────
function ExpiryTab({ isAdminLike }) {
  const queryClient = useQueryClient()
  const [filter, setFilter]               = useState('all')
  const [disposalModal, setDisposalModal] = useState(null)
  const [page, setPage]                   = useState(1)

  const disposalForm = useForm({
    resolver: zodResolver(disposalSchema),
    defaultValues: { batch_id: '', quantity: 1, reason: '', disposal_method: '', notes: '' },
  })

  const batchesQ = useQuery({
    queryKey: ['batches', { filter, page }],
    queryFn: async () => {
      const params = { page, per_page: 20 }
      if (filter !== 'all') params.status = filter
      const res = await api.get('/batches', { params })
      return res.data
    },
    staleTime: 30_000,
  })

  const nearExpiryQ = useQuery({
    queryKey: ['batches-near-expiry'],
    queryFn: async () => {
      const res = await api.get('/batches/near-expiry')
      return res.data?.data ?? { critical: [], warning: [], watch: [], total: 0 }
    },
    staleTime: 60_000,
  })

  const disposalMut = useMutation({
    mutationFn: d => api.post('/batches/disposals', d),
    onSuccess: () => {
      toast.success('Disposal request submitted — pending approval')
      disposalForm.reset()
      setDisposalModal(null)
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Disposal request failed'),
  })

  const batches       = batchesQ.data?.data ?? []
  const meta          = batchesQ.data?.meta
  const nearExpiryData   = nearExpiryQ.data ?? {}
  const criticalBatches  = Array.isArray(nearExpiryData.critical) ? nearExpiryData.critical : []
  const warningBatches   = Array.isArray(nearExpiryData.warning)  ? nearExpiryData.warning  : []
  const watchBatches     = Array.isArray(nearExpiryData.watch)    ? nearExpiryData.watch    : []
  const totalNearExpiry  = criticalBatches.length + warningBatches.length + watchBatches.length

  const columns = [
    { key: 'product',      header: 'Product',     cell: r => <span className="font-semibold text-[#1C2B3A]">{r.product?.name ?? `#${r.product_id}`}</span> },
    { key: 'batch_number', header: 'Batch No.',   cell: r => <code className="text-[11px] bg-[#F0F4F8] px-1.5 py-0.5 rounded">{r.batch_number}</code> },
    { key: 'expiry_date',  header: 'Expiry Date', cell: r => {
      const u = expiryUrgency(r.expiry_date)
      return (
        <div className="flex items-center gap-2">
          <span>{format(parseISO(r.expiry_date), 'd MMM yyyy')}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: u.bg, color: u.color }}>
            {u.days < 0 ? `${Math.abs(u.days)}d ago` : `${u.days}d`} · {u.label}
          </span>
        </div>
      )
    }},
    { key: 'qty',    header: 'Qty Left',  cell: r => <span className="font-bold">{r.quantity_remaining}</span> },
    { key: 'cost',   header: 'Cost/Unit', cell: r => money(r.cost_per_unit) },
    { key: 'branch', header: 'Branch',    cell: r => r.branch?.name ?? '—' },
    { key: 'status', header: 'Status',    cell: r => {
      const colors = { active: ['#EAF5EE', '#1A6E3A'], near_expiry: ['#FEF0E6', '#C45A00'], expired: ['#FDECEA', '#C0392B'], disposed: ['#F0F4F8', '#8A9AB5'] }
      const [bg, color] = colors[r.status] ?? ['#F0F4F8', '#8A9AB5']
      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{r.status?.replace('_', ' ')}</span>
    }},
    { key: 'actions', header: '', cell: r => (
      isAdminLike && ['active', 'near_expiry', 'expired'].includes(r.status) ? (
        <Btn size="sm" variant="danger" onClick={() => {
          setDisposalModal(r)
          disposalForm.setValue('batch_id', r.id)
          disposalForm.setValue('quantity', r.quantity_remaining)
        }}>
          <Trash2 size={12} /> Dispose
        </Btn>
      ) : null
    )},
  ]

  const FILTERS = [
    { id: 'all', label: 'All Batches' }, { id: 'active', label: 'Active' },
    { id: 'near_expiry', label: 'Near Expiry' }, { id: 'expired', label: 'Expired' },
    { id: 'disposed', label: 'Disposed' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {totalNearExpiry > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#FEF0E6] border border-[#FDDCB4] rounded-xl">
          <AlertTriangle size={18} color="#C45A00" className="flex-shrink-0" />
          <div className="text-sm text-[#7B3500]">
            <strong>{totalNearExpiry} batch{totalNearExpiry !== 1 ? 'es' : ''}</strong> nearing expiry.
            {criticalBatches.length > 0 && <span className="text-[#C0392B] font-bold"> {criticalBatches.length} CRITICAL (&lt;7 days) — act immediately.</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatCard label="Total Batches"   value={meta?.total ?? '—'}     color="#1A3FA6" />
        <StatCard label="Critical (<7d)"  value={criticalBatches.length} color="#C0392B" />
        <StatCard label="Warning (7-30d)" value={warningBatches.length}  color="#C45A00" />
        <StatCard label="Watch (30-60d)"  value={watchBatches.length}    color="#5B3FA6" />
      </div>

      {criticalBatches.length > 0 && (
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#C0392B] mb-2.5">🚨 Critical Batches — Expires within 7 days</div>
          <div className="flex flex-col gap-1.5">
            {criticalBatches.map(b => (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2 bg-[#FDECEA] rounded-xl">
                <div className="flex-1">
                  <span className="font-semibold text-[#1C2B3A] text-sm">{b.product?.name}</span>
                  <span className="text-[11px] text-[#8A9AB5] ml-2">Batch: {b.batch_number}</span>
                </div>
                <span className="text-xs text-[#C0392B] font-bold">{b.quantity_remaining} units</span>
                <span className="text-[11px] text-[#C0392B]">{format(parseISO(b.expiry_date), 'd MMM yyyy')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              filter === f.id
                ? 'border-[#E8A020] bg-[rgba(232,160,32,0.08)] text-[#C98516]'
                : 'border-[#E5EBF2] bg-white text-[#8A9AB5] hover:bg-[#F8FAFC]'
            }`}
          >{f.label}</button>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={batches} rowKey={r => r.id} loading={batchesQ.isLoading} emptyMessage="No batches found for this filter." />
        <NumberedPagination current={meta?.current_page ?? 1} last={meta?.last_page ?? 1} total={meta?.total ?? 0} onPage={setPage} />
      </Card>

      <div className="px-4 py-3 bg-[#EAF0FB] border border-[#B8CFF5] rounded-xl text-sm text-[#1A3FA6]">
        <strong>FEFO — First Expired, First Out:</strong> At POS checkout, the system automatically selects the batch with the earliest expiry date. This ensures perishables are sold before they expire.
      </div>

      <Modal open={Boolean(disposalModal)} onClose={() => { setDisposalModal(null); disposalForm.reset() }}
        title={`Request Disposal — ${disposalModal?.product?.name ?? ''}`} width={480}
        footer={<>
          <Btn variant="ghost" onClick={() => { setDisposalModal(null); disposalForm.reset() }}>Cancel</Btn>
          <Btn variant="danger" onClick={disposalForm.handleSubmit(d => disposalMut.mutate(d))} disabled={disposalMut.isPending}>
            {disposalMut.isPending ? <><Spinner size={12} /> Submitting…</> : 'Submit Disposal Request'}
          </Btn>
        </>}
      >
        {disposalModal && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#F6F8FB] rounded-xl p-4 text-sm">
              {[
                ['Batch No.', <code className="font-bold">{disposalModal.batch_number}</code>],
                ['Qty Remaining', <span className="font-bold text-[#1C2B3A]">{disposalModal.quantity_remaining}</span>],
                ['Expiry Date', <span className="font-bold text-[#C0392B]">{format(parseISO(disposalModal.expiry_date), 'd MMM yyyy')}</span>],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between mb-1.5">
                  <span className="text-[#8A9AB5]">{label}</span>{val}
                </div>
              ))}
            </div>
            <FormField label="Quantity to Dispose *" error={disposalForm.formState.errors.quantity?.message}>
              <FormInput register={disposalForm.register('quantity')} type="number" min={1} max={disposalModal.quantity_remaining} />
            </FormField>
            <FormField label="Reason *" error={disposalForm.formState.errors.reason?.message}>
              <FormSelect register={disposalForm.register('reason')}>
                <option value="">Select reason…</option>
                <option value="expired">Expired</option>
                <option value="near_expiry">Near Expiry (Markdown sale)</option>
                <option value="damaged">Damaged</option>
                <option value="recalled">Recalled by manufacturer</option>
              </FormSelect>
            </FormField>
            <FormField label="Disposal Method *" error={disposalForm.formState.errors.disposal_method?.message}>
              <FormSelect register={disposalForm.register('disposal_method')}>
                <option value="">Select method…</option>
                <option value="destroy">Destroy / Discard</option>
                <option value="return_to_supplier">Return to Supplier</option>
                <option value="donate">Donate</option>
                <option value="markdown_sale">Markdown Sale</option>
              </FormSelect>
            </FormField>
            <FormField label="Notes">
              <textarea {...disposalForm.register('notes')} rows={2} placeholder="Additional notes…"
                className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical box-border focus:border-[#E8A020] transition-colors" />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Main InventoryPage ────────────────────────────────────────────────────────
export function InventoryPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [tab, setTab]                     = useState('list')
  const [search, setSearch]               = useState('')
  const [debouncedSearch]                 = useDebounce(search, 300)
  const [statusFilter, setStatusFilter]   = useState('')
  const [branchFilter, setBranchFilter]   = useState('')
  const [page, setPage]                   = useState(1)
  const [adjustTarget, setAdjustTarget]   = useState(null)
  const [stockTakeOpen, setStockTakeOpen] = useState(false)

  const adjustForm = useForm({ resolver: zodResolver(adjustSchema), defaultValues: { type: 'add', quantity: 0, notes: '' } })

  const userBranchId = user?.branch_id
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }, [userBranchId, queryClient])

  const inventoryQ = useQuery({
    queryKey: ['inventory', { q: debouncedSearch, status: statusFilter, branch: branchFilter, page }],
    enabled: tab === 'list',
    queryFn: async () => {
      const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, page, per_page: 20 }
      if (branchFilter) params.branch_id = branchFilter
      const res = await api.get('/inventory', { params })
      return res.data
    },
    staleTime: 15_000,
  })

  const lowStockQ = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => {
      const res = await api.get('/inventory/low-stock')
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const productsQ = useQuery({
    queryKey: ['products-all'],
    enabled: ['in', 'out', 'stocktake'].includes(tab),
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 120_000,
  })

  const branchesQ = useQuery({
    queryKey: ['branches', 'all'],
    enabled: isAdminLike,
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const stSchema = z.object({ items: z.array(z.object({ product_id: z.number(), quantity: z.coerce.number().min(0) })) })
  const stForm   = useForm({ resolver: zodResolver(stSchema), defaultValues: { items: [] } })
  const { fields: stFields } = useFieldArray({ control: stForm.control, name: 'items' })

  const stMut = useMutation({
    mutationFn: d => api.post('/inventory/stock-take', d),
    onSuccess: () => { toast.success('Stock-take saved'); setStockTakeOpen(false); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Stock-take failed'),
  })

  const adjustMut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, product_id: adjustTarget?.product_id }),
    onSuccess: () => { toast.success('Adjustment applied'); setAdjustTarget(null); adjustForm.reset({ type: 'add', quantity: 0, notes: '' }); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Adjustment failed'),
  })

  const rows     = inventoryQ.data?.data ?? []
  const meta     = inventoryQ.data?.meta
  const products = productsQ.data ?? []
  const branches = branchesQ.data ?? []
  const lowRows  = lowStockQ.data ?? []

  const columns = [
    { key: 'product', header: 'Product', cell: r => (
      <div>
        <div className="font-semibold text-[#1C2B3A] text-sm">{r.product?.name ?? `#${r.product_id}`}</div>
        <div className="text-[11px] text-[#8A9AB5]">{r.product?.sku ?? ''}{r.product?.category?.name ? ` · ${r.product.category.name}` : ''}</div>
      </div>
    )},
    { key: 'branch',   header: 'Branch',  cell: r => <span className="text-xs text-[#6B7A8D]">{r.branch?.name ?? '—'}</span> },
    { key: 'quantity', header: 'Stock',   cell: r => {
      const qty = r.quantity ?? 0; const low = r.product?.reorder_level ?? 5
      const isOut = qty <= 0; const isLow = qty > 0 && qty <= low
      return (
        <span className="text-sm font-black px-2.5 py-0.5 rounded-full" style={{
          color: isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A',
          background: isOut ? '#FDECEA' : isLow ? '#FEF0E6' : '#EAF5EE',
        }}>
          {isOut ? 'Out' : qty}
        </span>
      )
    }},
    { key: 'reorder',  header: 'Reorder', cell: r => r.product?.reorder_level ?? 5 },
    { key: 'supplier', header: 'Supplier', cell: r => <span className="text-xs text-[#6B7A8D]">{r.product?.supplier?.name ?? '—'}</span> },
    ...(isAdminLike ? [{ key: 'actions', header: '', cell: r => (
      <Btn size="sm" variant="ghost" onClick={() => { setAdjustTarget(r); adjustForm.reset({ type: 'add', quantity: 0, notes: '' }) }}>Adjust</Btn>
    )}] : []),
  ]

  const lowColumns = [
    { key: 'product',  header: 'Product',      cell: r => <span className="font-semibold">{r.product?.name}</span> },
    { key: 'branch',   header: 'Branch',        cell: r => r.branch?.name ?? '—' },
    { key: 'stock',    header: 'Current Stock', cell: r => <span className="font-black text-[#C0392B]">{r.quantity}</span> },
    { key: 'reorder',  header: 'Reorder At',    cell: r => r.product?.reorder_level ?? 5 },
    { key: 'deficit',  header: 'Deficit',       cell: r => <span className="font-bold text-[#C45A00]">{Math.max(0, (r.product?.reorder_level ?? 5) - (r.quantity ?? 0))}</span> },
  ]

  const tabMeta = {
    list:      { title: 'All Stock',              subtitle: isAdminLike ? 'Inventory across all branches. Filter by branch to scope view.' : 'Inventory for your branch.' },
    in:        { title: 'Stock In',               subtitle: 'Record incoming deliveries and restocks.' },
    out:       { title: 'Stock Out',              subtitle: 'Record stock removed without a sale.' },
    transfer:  { title: 'Inter-Branch Transfer',  subtitle: 'Move multiple products between branches. Requires approval.' },
    stocktake: { title: 'Stock-Take',             subtitle: 'Physical count reconciliation.' },
    low:       { title: 'Low Stock Alerts',       subtitle: 'Items below reorder level — restock immediately.' },
    expiry:    { title: 'Expiry & Batches (FEFO)', subtitle: 'Track batches by expiry date. Earliest-expiry sold first at POS.' },
  }

  const { title, subtitle } = tabMeta[tab] ?? tabMeta.list

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} subtitle={subtitle}
        action={tab === 'list' && isAdminLike ? (
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => { setStockTakeOpen(true); stForm.setValue('items', rows.map(r => ({ product_id: r.product_id, quantity: r.quantity }))) }}>
              <ClipboardCheck size={14} /> Stock-Take
            </Btn>
            <Btn onClick={() => setTab('in')}><ArrowDownToLine size={14} /> Stock In</Btn>
          </div>
        ) : undefined}
      />

      {/* Tab pills */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setPage(1) }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              tab === id
                ? 'border-[#E8A020] bg-[rgba(232,160,32,0.08)] text-[#C98516]'
                : 'border-[#E5EBF2] bg-white text-[#8A9AB5] hover:bg-[#F8FAFC]'
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {tab === 'list' && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <StatCard label="Total SKUs"   value={meta?.total ?? '—'}                                           color="#1A3FA6" />
          <StatCard label="Out of Stock" value={rows.filter(r => r.quantity <= 0).length}                     color="#C0392B" />
          <StatCard label="Low Stock"    value={lowRows.length}                                                color="#C45A00" />
          <StatCard label="Healthy"      value={rows.filter(r => r.quantity > (r.product?.reorder_level ?? 5)).length} color="#1A6E3A" />
        </div>
      )}

      {/* All Stock */}
      {tab === 'list' && (
        <Card style={{ padding: 0 }}>
          <div className="flex gap-2.5 p-3.5 border-b border-[#F0F4F8] flex-wrap items-center">
            <SearchInput value={search} onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }} placeholder="Search product, SKU…" />
            {isAdminLike && (
              <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
                className="px-3 py-2 text-sm border border-[#D5DFE9] rounded-xl text-[#3A4A5C] outline-none bg-white">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-[#D5DFE9] rounded-xl text-[#3A4A5C] outline-none bg-white">
              <option value="">All Status</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <button onClick={() => inventoryQ.refetch()} className="p-1.5 rounded-lg bg-transparent border-0 cursor-pointer text-[#8A9AB5] flex items-center hover:text-[#3A4A5C] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <DataTable columns={columns} rows={rows} rowKey={r => r.id} loading={inventoryQ.isLoading} emptyMessage="No inventory records found." />
          <NumberedPagination current={meta?.current_page ?? 1} last={meta?.last_page ?? 1} total={meta?.total ?? 0} onPage={setPage} />
        </Card>
      )}

      {/* Low Stock */}
      {tab === 'low' && (
        <Card style={{ padding: 0 }}>
          <div className="px-4 py-3 border-b border-[#F0F4F8] text-sm text-[#C45A00] font-semibold">
            ⚠️ {lowRows.length} item{lowRows.length !== 1 ? 's' : ''} below reorder level
          </div>
          <DataTable columns={lowColumns} rows={lowRows} rowKey={r => r.id} loading={lowStockQ.isLoading} emptyMessage="No low stock items. All stocked up! 🎉" />
        </Card>
      )}

      {tab === 'in'       && <StockInTab   products={products} isAdminLike={isAdminLike} />}
      {tab === 'out'      && <StockOutTab  products={products} isAdminLike={isAdminLike} />}
      {tab === 'transfer' && <TransferTab  branches={branches} isAdminLike={isAdminLike} />}
      {tab === 'expiry'   && <ExpiryTab    isAdminLike={isAdminLike} />}

      {tab === 'stocktake' && (
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-6">
          <div className="text-sm text-[#8A9AB5] mb-3">
            First go to <strong>All Stock</strong> tab to load inventory, then click <strong>Stock-Take</strong>.
          </div>
          {stFields.length > 0 ? (
            <>
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {stFields.map((field, i) => (
                  <div key={field.id} className="grid gap-3 items-center" style={{ gridTemplateColumns: '1fr 120px' }}>
                    <span className="text-sm text-[#1C2B3A]">{rows[i]?.product?.name ?? `#${field.product_id}`}</span>
                    <FormInput register={stForm.register(`items.${i}.quantity`)} type="number" min={0} />
                  </div>
                ))}
              </div>
              <Btn className="mt-4" onClick={stForm.handleSubmit(d => stMut.mutate(d))} disabled={stMut.isPending}>
                {stMut.isPending ? <><Spinner size={12} /> Saving…</> : <><ClipboardCheck size={14} /> Save Stock-Take</>}
              </Btn>
            </>
          ) : (
            <Btn onClick={() => { setTab('list'); setTimeout(() => setStockTakeOpen(true), 100) }}>
              Go to All Stock → Stock-Take
            </Btn>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      <Modal open={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.product?.name ?? ''}`} width={400}
        footer={<>
          <Btn variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Btn>
          <Btn onClick={adjustForm.handleSubmit(d => adjustMut.mutate(d))} disabled={adjustMut.isPending}>
            {adjustMut.isPending ? <><Spinner size={12} /> Applying…</> : 'Apply Adjustment'}
          </Btn>
        </>}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-[#F6F8FB] rounded-xl px-4 py-3 text-sm">
            Current stock: <strong>{adjustTarget?.quantity ?? 0}</strong> units at {adjustTarget?.branch?.name}
          </div>
          <FormField label="Type">
            <FormSelect register={adjustForm.register('type')}>
              <option value="add">Add to stock</option>
              <option value="remove">Remove from stock</option>
              <option value="set">Set exact quantity</option>
            </FormSelect>
          </FormField>
          <FormField label="Quantity" error={adjustForm.formState.errors.quantity?.message}>
            <FormInput register={adjustForm.register('quantity')} type="number" min={0} />
          </FormField>
          <FormField label="Notes">
            <textarea {...adjustForm.register('notes')} rows={2} placeholder="Reason for adjustment…"
              className="w-full px-3 py-2.5 text-sm border border-[#D5DFE9] rounded-xl outline-none resize-vertical box-border focus:border-[#E8A020] transition-colors" />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
