/**
 * InventoryPage v4
 *
 * Fixes:
 *  ✅ ExpiryTab crash: nearExpiry API returns {critical,warning,watch,total} NOT array
 *     — destructure properly instead of treating as array
 *  ✅ Admin/Super-Admin see ALL branches inventory (not just Head Office)
 *  ✅ Numbered pagination (click page numbers, no full reload)
 *  ✅ Inter-Branch Transfer: multi-product lines, from-branch loads that branch's products
 *  ✅ Branch filter dropdown for admin+ in All Stock tab
 */
import { useState, useMemo, useEffect } from 'react'
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

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Tab config
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'list',      label: 'All Stock',         icon: Package },
  { id: 'in',        label: 'Stock In',           icon: ArrowDownToLine },
  { id: 'out',       label: 'Stock Out',          icon: ArrowUpFromLine },
  { id: 'transfer',  label: 'Transfers',          icon: ArrowLeftRight },
  { id: 'stocktake', label: 'Stock-Take',         icon: ClipboardCheck },
  { id: 'low',       label: 'Low Stock',          icon: AlertTriangle },
  { id: 'expiry',    label: 'Expiry & Batches',   icon: Clock },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function ViewOnly({ icon: Icon, message }) {
  return (
    <Card style={{ padding: 48, textAlign: 'center', color: '#8A9AB5' }}>
      <Icon size={40} color="#E5EBF2" style={{ marginBottom: 14 }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>View Only</div>
      <div style={{ fontSize: 13 }}>{message ?? 'Only administrators can perform this action.'}</div>
    </Card>
  )
}

function expiryUrgency(expiryDate) {
  try {
    const days = differenceInDays(parseISO(expiryDate), new Date())
    if (days < 0)  return { label: 'Expired',  color: '#C0392B', bg: '#FDECEA', days }
    if (days < 7)  return { label: 'Critical', color: '#C0392B', bg: '#FDECEA', days }
    if (days < 30) return { label: 'Warning',  color: '#C45A00', bg: '#FEF0E6', days }
    if (days < 60) return { label: 'Watch',    color: '#5B3FA6', bg: '#F0ECFB', days }
    return           { label: 'OK',      color: '#1A6E3A', bg: '#EAF5EE', days }
  } catch { return { label: 'Unknown', color: '#8A9AB5', bg: '#F0F4F8', days: 0 } }
}

// Numbered Pagination component
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px 16px', borderTop: '1px solid #F0F4F8' }}>
      <button onClick={() => onPage(current - 1)} disabled={current <= 1}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5EBF2', background: '#fff', cursor: current <= 1 ? 'not-allowed' : 'pointer', color: current <= 1 ? '#D5DFE9' : '#3A4A5C', fontSize: 12, fontWeight: 600 }}>
        ←
      </button>
      {pages.map((p, i) => (
        p === '…' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', color: '#8A9AB5', fontSize: 12 }}>…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
              borderColor: p === current ? '#E8A020' : '#E5EBF2',
              background:  p === current ? 'rgba(232,160,32,0.1)' : '#fff',
              color:        p === current ? '#C98516' : '#3A4A5C',
            }}>
            {p}
          </button>
        )
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current >= last}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5EBF2', background: '#fff', cursor: current >= last ? 'not-allowed' : 'pointer', color: current >= last ? '#D5DFE9' : '#3A4A5C', fontSize: 12, fontWeight: 600 }}>
        →
      </button>
      <span style={{ fontSize: 11, color: '#8A9AB5', marginLeft: 8 }}>{total} records</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock In Tab
// ─────────────────────────────────────────────────────────────────────────────
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
    <Card style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Add Stock</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>Record incoming deliveries and restocks.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
        </FormField>
        <div style={{ background: '#FDF3DC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#855000' }}>
          💡 For large supplier deliveries, use <strong>Purchase Orders</strong> — it creates FEFO batches with expiry dates automatically.
        </div>
        <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Adding…</> : <><ArrowDownToLine size={14} /> Add Stock</>}
        </Btn>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock Out Tab
// ─────────────────────────────────────────────────────────────────────────────
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
    <Card style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Remove Stock</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>Record stock removed without a sale.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
        </FormField>
        <Btn variant="danger" onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Removing…</> : <><ArrowUpFromLine size={14} /> Remove Stock</>}
        </Btn>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Tab — multi-product lines, from-branch loads that branch's stock
// ─────────────────────────────────────────────────────────────────────────────
function TransferTab({ branches, isAdminLike }) {
  const queryClient = useQueryClient()
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch]     = useState('')
  const [notes, setNotes]           = useState('')
  const [lines, setLines]           = useState([{ product_id: '', quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)

  // Load products available in the selected from-branch
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
      // Send each line as a separate transfer request
      const results = await Promise.allSettled(
        validLines.map(l => api.post('/inventory/transfer', {
          product_id:     Number(l.product_id),
          from_branch_id: Number(fromBranch),
          to_branch_id:   Number(toBranch),
          quantity:        Number(l.quantity),
          notes,
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
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdminLike) return <ViewOnly icon={ArrowLeftRight} message="Only administrators can initiate stock transfers." />

  return (
    <Card style={{ padding: 24, maxWidth: 680 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Inter-Branch Transfer</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>
        Transfer multiple products between branches in one request. Each line requires approval.
      </div>

      {/* Branch selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>From Branch *</label>
          <select value={fromBranch} onChange={e => { setFromBranch(e.target.value); setLines([{ product_id: '', quantity: 1 }]) }}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
            <option value="">Select source branch…</option>
            {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>To Branch *</label>
          <select value={toBranch} onChange={e => setToBranch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
            <option value="">Select destination branch…</option>
            {(branches ?? []).filter(b => String(b.id) !== fromBranch).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product lines */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', marginBottom: 10 }}>
          Products to Transfer {fromBranch ? `(${fromProducts.length} available at source)` : ''}
        </div>

        {fromBranch && fromInventoryQ.isLoading && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>
            Loading {branches.find(b => String(b.id) === fromBranch)?.name} inventory…
          </div>
        )}

        {lines.map((line, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff', width: '100%' }}>
              <option value="">Select product…</option>
              {fromProducts.map(inv => (
                <option key={inv.product_id} value={inv.product_id}>
                  {inv.product?.name ?? `#${inv.product_id}`} — Stock: {inv.quantity}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={line.quantity}
              onChange={e => updateLine(i, 'quantity', e.target.value)}
              placeholder="Qty"
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <button onClick={() => removeLine(i)} disabled={lines.length === 1}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #FDECEA', background: lines.length === 1 ? '#F8FAFC' : '#FDECEA', cursor: lines.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: lines.length === 1 ? '#D5DFE9' : '#C0392B', flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>
        ))}

        <button onClick={addLine}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px dashed #D5DFE9', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#1A3FA6', fontWeight: 600 }}>
          <Plus size={13} /> Add another product
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Transfer reason, reference number…"
          style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={submit} disabled={submitting || !fromBranch || !toBranch}>
          {submitting ? <><Spinner size={12} /> Submitting…</> : <><ArrowLeftRight size={14} /> Request Transfer ({lines.filter(l => l.product_id).length} items)</>}
        </Btn>
        <span style={{ fontSize: 12, color: '#8A9AB5' }}>Requires branch manager approval</span>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry & Batches Tab — FIXED: API returns {critical,warning,watch,total}
// ─────────────────────────────────────────────────────────────────────────────
function ExpiryTab({ isAdminLike }) {
  const queryClient = useQueryClient()
  const [filter, setFilter]         = useState('all')
  const [disposalModal, setDisposalModal] = useState(null)
  const [page, setPage]             = useState(1)

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

  // FIX: API returns { critical:[], warning:[], watch:[], total:N }
  // NOT a flat array — destructure correctly
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

  const batches  = batchesQ.data?.data ?? []
  const meta     = batchesQ.data?.meta

  // Safely extract near-expiry groups from the object response
  const nearExpiryData     = nearExpiryQ.data ?? {}
  const criticalBatches    = Array.isArray(nearExpiryData.critical) ? nearExpiryData.critical : []
  const warningBatches     = Array.isArray(nearExpiryData.warning)  ? nearExpiryData.warning  : []
  const watchBatches       = Array.isArray(nearExpiryData.watch)    ? nearExpiryData.watch    : []
  const totalNearExpiry    = criticalBatches.length + warningBatches.length + watchBatches.length

  const columns = [
    { key: 'product',      header: 'Product',     cell: r => <span style={{ fontWeight: 600, color: '#1C2B3A' }}>{r.product?.name ?? `#${r.product_id}`}</span> },
    { key: 'batch_number', header: 'Batch No.',   cell: r => <code style={{ fontSize: 11, background: '#F0F4F8', padding: '2px 6px', borderRadius: 4 }}>{r.batch_number}</code> },
    { key: 'expiry_date',  header: 'Expiry Date', cell: r => {
      const u = expiryUrgency(r.expiry_date)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{format(parseISO(r.expiry_date), 'd MMM yyyy')}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: u.bg, color: u.color }}>
            {u.days < 0 ? `${Math.abs(u.days)}d ago` : `${u.days}d`} · {u.label}
          </span>
        </div>
      )
    }},
    { key: 'qty',    header: 'Qty Left',  cell: r => <span style={{ fontWeight: 700 }}>{r.quantity_remaining}</span> },
    { key: 'cost',   header: 'Cost/Unit', cell: r => money(r.cost_per_unit) },
    { key: 'branch', header: 'Branch',    cell: r => r.branch?.name ?? '—' },
    { key: 'status', header: 'Status',    cell: r => {
      const colors = { active: ['#EAF5EE', '#1A6E3A'], near_expiry: ['#FEF0E6', '#C45A00'], expired: ['#FDECEA', '#C0392B'], disposed: ['#F0F4F8', '#8A9AB5'] }
      const [bg, color] = colors[r.status] ?? ['#F0F4F8', '#8A9AB5']
      return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color }}>{r.status?.replace('_', ' ')}</span>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Near-expiry alert banner */}
      {totalNearExpiry > 0 && (
        <div style={{ background: '#FEF0E6', border: '1px solid #FDDCB4', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#C45A00" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#7B3500' }}>
            <strong>{totalNearExpiry} batch{totalNearExpiry !== 1 ? 'es' : ''}</strong> nearing expiry.
            {criticalBatches.length > 0 && <span style={{ color: '#C0392B', fontWeight: 700 }}> {criticalBatches.length} CRITICAL (&lt;7 days) — act immediately.</span>}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <StatCard label="Total Batches"  value={meta?.total ?? '—'}        color="#1A3FA6" />
        <StatCard label="Critical (<7d)" value={criticalBatches.length}    color="#C0392B" />
        <StatCard label="Warning (7-30d)" value={warningBatches.length}    color="#C45A00" />
        <StatCard label="Watch (30-60d)" value={watchBatches.length}       color="#5B3FA6" />
      </div>

      {/* Urgency breakdown */}
      {criticalBatches.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B', marginBottom: 10 }}>🚨 Critical Batches — Expires within 7 days</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {criticalBatches.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#FDECEA', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{b.product?.name}</span>
                  <span style={{ fontSize: 11, color: '#8A9AB5', marginLeft: 8 }}>Batch: {b.batch_number}</span>
                </div>
                <span style={{ fontSize: 12, color: '#C0392B', fontWeight: 700 }}>{b.quantity_remaining} units</span>
                <span style={{ fontSize: 11, color: '#C0392B' }}>{format(parseISO(b.expiry_date), 'd MMM yyyy')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'all',         label: 'All Batches' },
          { id: 'active',      label: 'Active' },
          { id: 'near_expiry', label: 'Near Expiry' },
          { id: 'expired',     label: 'Expired' },
          { id: 'disposed',    label: 'Disposed' },
        ].map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id); setPage(1) }}
            style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
              borderColor: filter === f.id ? 'var(--edlp-primary)' : '#E5EBF2',
              background: filter === f.id ? 'rgba(232,160,32,0.08)' : '#fff',
              color: filter === f.id ? '#C98516' : '#8A9AB5',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Batches table */}
      <Card style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          rows={batches}
          rowKey={r => r.id}
          loading={batchesQ.isLoading}
          emptyMessage="No batches found for this filter."
        />
        <NumberedPagination current={meta?.current_page ?? 1} last={meta?.last_page ?? 1} total={meta?.total ?? 0} onPage={setPage} />
      </Card>

      {/* FEFO info */}
      <div style={{ background: '#EAF0FB', border: '1px solid #B8CFF5', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#1A3FA6' }}>
        <strong>FEFO — First Expired, First Out:</strong> At POS checkout, the system automatically selects the batch with the earliest expiry date. This ensures perishables are sold before they expire.
      </div>

      {/* Disposal modal */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#F6F8FB', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
              {[
                ['Batch No.', <code style={{ fontWeight: 700 }}>{disposalModal.batch_number}</code>],
                ['Qty Remaining', <span style={{ fontWeight: 700, color: '#1C2B3A' }}>{disposalModal.quantity_remaining}</span>],
                ['Expiry Date', <span style={{ fontWeight: 700, color: '#C0392B' }}>{format(parseISO(disposalModal.expiry_date), 'd MMM yyyy')}</span>],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#8A9AB5' }}>{label}</span>{val}
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
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main InventoryPage
// ─────────────────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [tab, setTab]                     = useState('list')
  const [search, setSearch]               = useState('')
  const [debouncedSearch]                 = useDebounce(search, 300)
  const [statusFilter, setStatusFilter]   = useState('')
  const [branchFilter, setBranchFilter]   = useState('')  // admin: filter by branch
  const [page, setPage]                   = useState(1)
  const [adjustTarget, setAdjustTarget]   = useState(null)
  const [stockTakeOpen, setStockTakeOpen] = useState(false)

  const adjustForm = useForm({ resolver: zodResolver(adjustSchema), defaultValues: { type: 'add', quantity: 0, notes: '' } })

  // Re-fetch when branch changes
  const userBranchId = user?.branch_id
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }, [userBranchId, queryClient])

  // Inventory query — admin sees ALL branches, branch_filter optional
  const inventoryQ = useQuery({
    queryKey: ['inventory', { q: debouncedSearch, status: statusFilter, branch: branchFilter, page }],
    enabled: tab === 'list',
    queryFn: async () => {
      const params = {
        search:    debouncedSearch || undefined,
        status:    statusFilter || undefined,
        page,
        per_page:  20,
      }
      // Admin with no branch filter → no branch_id param → backend returns all branches
      // Non-admin → backend enforces their own branch via BranchScope middleware
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

  // Stock-take
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
        <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
        <div style={{ fontSize: 11, color: '#8A9AB5' }}>{r.product?.sku ?? ''}{r.product?.category?.name ? ` · ${r.product.category.name}` : ''}</div>
      </div>
    )},
    { key: 'branch',   header: 'Branch',  cell: r => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{r.branch?.name ?? '—'}</span> },
    { key: 'quantity', header: 'Stock',   cell: r => {
      const qty = r.quantity ?? 0; const low = r.product?.reorder_level ?? 5
      const isOut = qty <= 0; const isLow = qty > 0 && qty <= low
      return <span style={{ fontSize: 13, fontWeight: 800, color: isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A', background: isOut ? '#FDECEA' : isLow ? '#FEF0E6' : '#EAF5EE', padding: '2px 10px', borderRadius: 20 }}>{isOut ? 'Out' : qty}</span>
    }},
    { key: 'reorder',  header: 'Reorder', cell: r => r.product?.reorder_level ?? 5 },
    { key: 'supplier', header: 'Supplier',cell: r => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{r.product?.supplier?.name ?? '—'}</span> },
    ...(isAdminLike ? [{ key: 'actions', header: '', cell: r => (
      <Btn size="sm" variant="ghost" onClick={() => { setAdjustTarget(r); adjustForm.reset({ type: 'add', quantity: 0, notes: '' }) }}>Adjust</Btn>
    )}] : []),
  ]

  const lowColumns = [
    { key: 'product',  header: 'Product',      cell: r => <span style={{ fontWeight: 600 }}>{r.product?.name}</span> },
    { key: 'branch',   header: 'Branch',        cell: r => r.branch?.name ?? '—' },
    { key: 'stock',    header: 'Current Stock', cell: r => <span style={{ fontWeight: 800, color: '#C0392B' }}>{r.quantity}</span> },
    { key: 'reorder',  header: 'Reorder At',    cell: r => r.product?.reorder_level ?? 5 },
    { key: 'deficit',  header: 'Deficit',       cell: r => <span style={{ color: '#C45A00', fontWeight: 700 }}>{Math.max(0, (r.product?.reorder_level ?? 5) - (r.quantity ?? 0))}</span> },
  ]

  const tabMeta = {
    list:      { title: 'All Stock',              subtitle: isAdminLike ? 'Inventory across all branches. Filter by branch to scope view.' : `Inventory for your branch.` },
    in:        { title: 'Stock In',               subtitle: 'Record incoming deliveries and restocks.' },
    out:       { title: 'Stock Out',              subtitle: 'Record stock removed without a sale.' },
    transfer:  { title: 'Inter-Branch Transfer',  subtitle: 'Move multiple products between branches. Requires approval.' },
    stocktake: { title: 'Stock-Take',             subtitle: 'Physical count reconciliation.' },
    low:       { title: 'Low Stock Alerts',       subtitle: 'Items below reorder level — restock immediately.' },
    expiry:    { title: 'Expiry & Batches (FEFO)',subtitle: 'Track batches by expiry date. Earliest-expiry sold first at POS.' },
  }

  const { title, subtitle } = tabMeta[tab] ?? tabMeta.list

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader title={title} subtitle={subtitle}
        action={tab === 'list' && isAdminLike ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setStockTakeOpen(true); stForm.setValue('items', rows.map(r => ({ product_id: r.product_id, quantity: r.quantity }))) }}>
              <ClipboardCheck size={14} /> Stock-Take
            </Btn>
            <Btn onClick={() => setTab('in')}><ArrowDownToLine size={14} /> Stock In</Btn>
          </div>
        ) : undefined}
      />

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setPage(1) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
              borderColor: tab === id ? 'var(--edlp-primary)' : '#E5EBF2',
              background: tab === id ? 'rgba(232,160,32,0.08)' : '#fff',
              color: tab === id ? '#C98516' : '#8A9AB5',
            }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <StatCard label="Total SKUs"   value={meta?.total ?? '—'}                                        color="#1A3FA6" />
          <StatCard label="Out of Stock" value={rows.filter(r => r.quantity <= 0).length}                  color="#C0392B" />
          <StatCard label="Low Stock"    value={lowRows.length}                                             color="#C45A00" />
          <StatCard label="Healthy"      value={rows.filter(r => r.quantity > (r.product?.reorder_level ?? 5)).length} color="#1A6E3A" />
        </div>
      )}

      {/* All Stock */}
      {tab === 'list' && (
        <Card style={{ padding: 0 }}>
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F0F4F8', flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchInput value={search} onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }} placeholder="Search product, SKU…" />
            {isAdminLike && (
              <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
                style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, color: '#3A4A5C', outline: 'none', background: '#fff' }}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, color: '#3A4A5C', outline: 'none', background: '#fff' }}>
              <option value="">All Status</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <button onClick={() => inventoryQ.refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
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
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F4F8', fontSize: 13, color: '#C45A00', fontWeight: 600 }}>
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
        <Card style={{ padding: 24 }}>
          <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 12 }}>
            First go to <strong>All Stock</strong> tab to load inventory, then click <strong>Stock-Take</strong>.
          </div>
          {stFields.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {stFields.map((field, i) => (
                  <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#1C2B3A' }}>{rows[i]?.product?.name ?? `#${field.product_id}`}</span>
                    <FormInput register={stForm.register(`items.${i}.quantity`)} type="number" min={0} />
                  </div>
                ))}
              </div>
              <Btn style={{ marginTop: 16 }} onClick={stForm.handleSubmit(d => stMut.mutate(d))} disabled={stMut.isPending}>
                {stMut.isPending ? <><Spinner size={12} /> Saving…</> : <><ClipboardCheck size={14} /> Save Stock-Take</>}
              </Btn>
            </>
          ) : (
            <Btn onClick={() => { setTab('list'); setTimeout(() => setStockTakeOpen(true), 100) }}>
              Go to All Stock → Stock-Take
            </Btn>
          )}
        </Card>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#F6F8FB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
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
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
