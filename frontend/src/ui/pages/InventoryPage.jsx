/**
 * InventoryPage v3 — Stock Management + Expiry Batches (FEFO)
 * Tabs: All Stock | Stock In | Stock Out | Transfers | Stock-Take | Low Stock | Expiry & Batches
 *
 * New in v3:
 *  - "Expiry & Batches" tab added — connects to GET /api/batches & /api/batches/near-expiry
 *  - Near-expiry urgency badges (Critical <7d, Warning 7-30d, Watch 30-60d)
 *  - Disposal request button routes through approval engine
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import { format, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardCheck, AlertTriangle, CheckCircle, RefreshCw,
  Clock, Trash2, Plus,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

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

const TAB_META = {
  list:      { title: 'All Stock',              subtitle: 'Complete inventory view for your branch. Adjust stock inline.' },
  in:        { title: 'Stock In',               subtitle: 'Record incoming deliveries, restocks and supplier receipts.' },
  out:       { title: 'Stock Out',              subtitle: 'Record stock removed without a sale — damage, sampling, internal use.' },
  transfer:  { title: 'Inter-Branch Transfer',  subtitle: 'Move stock between branches. Admin approval required.' },
  stocktake: { title: 'Stock-Take',             subtitle: 'Physical count reconciliation. Variances auto-calculated.' },
  low:       { title: 'Low Stock Alerts',       subtitle: 'Items below their reorder level. Restock immediately.' },
  expiry:    { title: 'Expiry & Batches (FEFO)', subtitle: 'Track product batches by expiry date. FEFO: earliest-expiry batches sold first.' },
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const inOutSchema = z.object({
  product_id: z.coerce.number().min(1, 'Select a product'),
  quantity:   z.coerce.number().min(1, 'Min 1'),
  notes:      z.string().optional(),
})

const transferSchema = z.object({
  product_id:     z.coerce.number().min(1, 'Select a product'),
  from_branch_id: z.coerce.number().min(1, 'Select source'),
  to_branch_id:   z.coerce.number().min(1, 'Select destination'),
  quantity:       z.coerce.number().min(1, 'Min 1'),
  notes:          z.string().optional(),
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

// ── Helper ────────────────────────────────────────────────────────────────────
function ViewOnly({ icon: Icon, message = 'Only administrators can record stock movements.' }) {
  return (
    <Card style={{ padding: 48, textAlign: 'center', color: '#8A9AB5' }}>
      <Icon size={40} color="#E5EBF2" style={{ marginBottom: 14 }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>View Only</div>
      <div style={{ fontSize: 13 }}>{message}</div>
    </Card>
  )
}

function expiryUrgency(expiryDate) {
  const days = differenceInDays(parseISO(expiryDate), new Date())
  if (days < 0)  return { label: 'Expired',  color: '#C0392B', bg: '#FDECEA', days }
  if (days < 7)  return { label: 'Critical', color: '#C0392B', bg: '#FDECEA', days }
  if (days < 30) return { label: 'Warning',  color: '#C45A00', bg: '#FEF0E6', days }
  if (days < 60) return { label: 'Watch',    color: '#5B3FA6', bg: '#F0ECFB', days }
  return           { label: 'OK',      color: '#1A6E3A', bg: '#EAF5EE', days }
}

// ── Stock In Tab ──────────────────────────────────────────────────────────────
function StockInTab({ products, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id: '', quantity: 1, notes: '' } })

  const mut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, type: 'add' }),
    onSuccess: () => {
      toast.success('Stock added')
      form.reset({ product_id: '', quantity: 1, notes: '' })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to add stock'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowDownToLine} message="Only administrators can add stock." />

  return (
    <Card style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Add Stock</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>
        Record incoming deliveries and restocks. For purchase orders with expiry dates, use the Purchase Orders module.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Product *">
          <FormSelect register={form.register('product_id')} error={form.formState.errors.product_id?.message}>
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
        <div style={{ paddingTop: 4, background: '#FDF3DC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#855000' }}>
          💡 For large supplier deliveries, use <strong>Purchase Orders</strong> — it creates FEFO batches with expiry dates automatically.
        </div>
        <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Adding…</> : <><ArrowDownToLine size={14} /> Add Stock</>}
        </Btn>
      </div>
    </Card>
  )
}

// ── Stock Out Tab ─────────────────────────────────────────────────────────────
function StockOutTab({ products, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id: '', quantity: 1, notes: '' } })

  const mut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, type: 'remove' }),
    onSuccess: () => {
      toast.success('Stock removed')
      form.reset({ product_id: '', quantity: 1, notes: '' })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to remove stock'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowUpFromLine} message="Only administrators can remove stock." />

  return (
    <Card style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Remove Stock</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>
        Record stock removed without a sale — damaged goods, internal use, sampling. For sampling workflows requiring approval, use Stock Movements.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Product *">
          <FormSelect register={form.register('product_id')} error={form.formState.errors.product_id?.message}>
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

// ── Transfer Tab ──────────────────────────────────────────────────────────────
function TransferTab({ products, branches, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(transferSchema), defaultValues: { product_id: '', from_branch_id: '', to_branch_id: '', quantity: 1, notes: '' } })

  const mut = useMutation({
    mutationFn: d => api.post('/inventory/transfer', d),
    onSuccess: () => {
      toast.success('Transfer requested — pending approval')
      form.reset({ product_id: '', from_branch_id: '', to_branch_id: '', quantity: 1, notes: '' })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Transfer failed'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowLeftRight} message="Only administrators can initiate stock transfers." />

  return (
    <Card style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>Inter-Branch Transfer</div>
      <div style={{ fontSize: 13, color: '#8A9AB5', marginBottom: 20 }}>Move stock between branches. Requires approval.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Product *">
          <FormSelect register={form.register('product_id')}>
            <option value="">Select product…</option>
            {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FormSelect>
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="From Branch">
            <FormSelect register={form.register('from_branch_id')}>
              <option value="">Select…</option>
              {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="To Branch">
            <FormSelect register={form.register('to_branch_id')}>
              <option value="">Select…</option>
              {(branches ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </FormSelect>
          </FormField>
        </div>
        <FormField label="Quantity *" error={form.formState.errors.quantity?.message}>
          <FormInput register={form.register('quantity')} type="number" min={1} placeholder="0" />
        </FormField>
        <FormField label="Notes">
          <textarea {...form.register('notes')} rows={2} placeholder="Transfer reason…"
            style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
        </FormField>
        <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
          {mut.isPending ? <><Spinner size={12} /> Submitting…</> : <><ArrowLeftRight size={14} /> Request Transfer</>}
        </Btn>
      </div>
    </Card>
  )
}

// ── Expiry & Batches Tab (NEW) ────────────────────────────────────────────────
function ExpiryTab({ user, isAdminLike }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all') // all | near_expiry | expired | active
  const [disposalModal, setDisposalModal] = useState(null) // batch object
  const [page, setPage] = useState(1)

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
      return res.data?.data ?? []
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

  const batches = batchesQ.data?.data ?? []
  const meta    = batchesQ.data?.meta
  const nearExpiry = nearExpiryQ.data ?? []

  const columns = [
    { key: 'product',    header: 'Product',       render: r => <span style={{ fontWeight: 600, color: '#1C2B3A' }}>{r.product?.name ?? `#${r.product_id}`}</span> },
    { key: 'batch_number', header: 'Batch No.',   render: r => <code style={{ fontSize: 11, background: '#F0F4F8', padding: '2px 6px', borderRadius: 4 }}>{r.batch_number}</code> },
    { key: 'expiry_date', header: 'Expiry Date',  render: r => {
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
    { key: 'qty_remaining', header: 'Qty Left',   render: r => <span style={{ fontWeight: 700 }}>{r.quantity_remaining}</span> },
    { key: 'cost',          header: 'Cost/Unit',  render: r => money(r.cost_per_unit) },
    { key: 'status',        header: 'Status',     render: r => {
      const colors = { active: ['#EAF5EE', '#1A6E3A'], near_expiry: ['#FEF0E6', '#C45A00'], expired: ['#FDECEA', '#C0392B'], disposed: ['#F0F4F8', '#8A9AB5'] }
      const [bg, color] = colors[r.status] ?? ['#F0F4F8', '#8A9AB5']
      return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color }}>{r.status?.replace('_', ' ')}</span>
    }},
    { key: 'actions',     header: '',           render: r => (
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
      {nearExpiry.length > 0 && (
        <div style={{ background: '#FEF0E6', border: '1px solid #FDDCB4', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#C45A00" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#7B3500' }}>
            <strong>{nearExpiry.length} batch{nearExpiry.length !== 1 ? 'es' : ''}</strong> are nearing expiry.
            {' '}Critical batches (&lt;7 days) should be disposed or promoted immediately.
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <StatCard label="Total Batches"    value={meta?.total ?? '—'} color="#1A3FA6" />
        <StatCard label="Near Expiry"      value={nearExpiry.filter(b => differenceInDays(parseISO(b.expiry_date), new Date()) < 30 && differenceInDays(parseISO(b.expiry_date), new Date()) >= 0).length} color="#C45A00" />
        <StatCard label="Critical (<7d)"   value={nearExpiry.filter(b => differenceInDays(parseISO(b.expiry_date), new Date()) < 7 && differenceInDays(parseISO(b.expiry_date), new Date()) >= 0).length} color="#C0392B" />
        <StatCard label="Expired"          value={nearExpiry.filter(b => differenceInDays(parseISO(b.expiry_date), new Date()) < 0).length} color="#8A9AB5" />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8 }}>
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
      <Card>
        <DataTable
          columns={columns}
          rows={batches}
          rowKey={r => r.id}
          loading={batchesQ.isLoading}
          emptyMessage="No batches found for this filter."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* FEFO info box */}
      <div style={{ background: '#EAF0FB', border: '1px solid #B8CFF5', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#1A3FA6' }}>
        <strong>FEFO — First Expired, First Out:</strong> At POS checkout, the system automatically selects the batch with the earliest expiry date that still has stock. This ensures perishables are always sold before they expire.
      </div>

      {/* Disposal modal */}
      <Modal
        open={Boolean(disposalModal)}
        onClose={() => { setDisposalModal(null); disposalForm.reset() }}
        title={`Request Disposal — ${disposalModal?.product?.name ?? ''}`}
        width={480}
        footer={
          <>
            <Btn variant="ghost" onClick={() => { setDisposalModal(null); disposalForm.reset() }}>Cancel</Btn>
            <Btn variant="danger" onClick={disposalForm.handleSubmit(d => disposalMut.mutate(d))} disabled={disposalMut.isPending}>
              {disposalMut.isPending ? <><Spinner size={12} /> Submitting…</> : 'Submit Disposal Request'}
            </Btn>
          </>
        }
      >
        {disposalModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#F6F8FB', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8A9AB5' }}>Batch No.</span>
                <code style={{ fontWeight: 700 }}>{disposalModal.batch_number}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ color: '#8A9AB5' }}>Qty Remaining</span>
                <span style={{ fontWeight: 700, color: '#1C2B3A' }}>{disposalModal.quantity_remaining}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ color: '#8A9AB5' }}>Expiry Date</span>
                <span style={{ fontWeight: 700, color: '#C0392B' }}>{format(parseISO(disposalModal.expiry_date), 'd MMM yyyy')}</span>
              </div>
            </div>
            <FormField label="Quantity to Dispose *" error={disposalForm.formState.errors.quantity?.message}>
              <FormInput register={disposalForm.register('quantity')} type="number" min={1} max={disposalModal.quantity_remaining} />
            </FormField>
            <FormField label="Reason *" error={disposalForm.formState.errors.reason?.message}>
              <FormSelect register={disposalForm.register('reason')}>
                <option value="">Select reason…</option>
                <option value="expired">Expired</option>
                <option value="damaged">Damaged</option>
                <option value="recalled">Supplier Recall</option>
              </FormSelect>
            </FormField>
            <FormField label="Disposal Method *" error={disposalForm.formState.errors.disposal_method?.message}>
              <FormSelect register={disposalForm.register('disposal_method')}>
                <option value="">Select method…</option>
                <option value="bin">Bin / Destroy</option>
                <option value="return_supplier">Return to Supplier</option>
                <option value="donate">Donate</option>
              </FormSelect>
            </FormField>
            <FormField label="Notes">
              <textarea {...disposalForm.register('notes')} rows={2} placeholder="Additional notes…"
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
            </FormField>
            <div style={{ background: '#FEF0E6', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#7B3500' }}>
              ⚠️ This request will be routed through the Approval Workflow. Stock will only be deducted after final approval.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [tab, setTab]                     = useState('list')
  const [search, setSearch]               = useState('')
  const [debouncedSearch]                 = useDebounce(search, 300)
  const [statusFilter, setStatusFilter]   = useState('')
  const [page, setPage]                   = useState(1)
  const [adjustTarget, setAdjustTarget]   = useState(null)
  const [stockTakeOpen, setStockTakeOpen] = useState(false)

  const adjustForm = useForm({ resolver: zodResolver(adjustSchema), defaultValues: { type: 'add', quantity: 0, notes: '' } })

  const { title, subtitle } = TAB_META[tab] ?? TAB_META.list

  // ── Queries ──────────────────────────────────────────────────
  const inventoryQuery = useQuery({
    queryKey: ['inventory', { q: debouncedSearch, status: statusFilter, page }],
    enabled: tab === 'list',
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { search: debouncedSearch || undefined, status: statusFilter || undefined, page, per_page: 20 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => { const res = await api.get('/inventory/low-stock'); return res.data?.data ?? [] },
    staleTime: 30_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products-all'],
    enabled: ['in', 'out', 'transfer', 'stocktake'].includes(tab),
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 120_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    enabled: tab === 'transfer' && isAdminLike,
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  // ── Stock-take state ──────────────────────────────────────────
  const stSchema = z.object({ items: z.array(z.object({ product_id: z.number(), quantity: z.coerce.number().min(0) })) })
  const stForm   = useForm({ resolver: zodResolver(stSchema), defaultValues: { items: [] } })
  const { fields: stFields } = useFieldArray({ control: stForm.control, name: 'items' })

  const stMut = useMutation({
    mutationFn: d => api.post('/inventory/stock-take', d),
    onSuccess: () => { toast.success('Stock-take saved'); setStockTakeOpen(false); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Stock-take failed'),
  })

  // ── Adjust mutation ───────────────────────────────────────────
  const adjustMut = useMutation({
    mutationFn: d => api.post('/inventory/adjust', { ...d, product_id: adjustTarget?.product_id }),
    onSuccess: () => {
      toast.success('Adjustment applied')
      setAdjustTarget(null)
      adjustForm.reset({ type: 'add', quantity: 0, notes: '' })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Adjustment failed'),
  })

  // ── Table data ────────────────────────────────────────────────
  const rows = inventoryQuery.data?.data ?? []
  const meta = inventoryQuery.data?.meta
  const products = productsQuery.data ?? []
  const branches = branchesQuery.data ?? []

  const columns = useMemo(() => [
    { key: 'product', header: 'Product', render: r => (
      <div>
        <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
        <div style={{ fontSize: 11, color: '#8A9AB5' }}>{r.product?.sku ?? ''} · {r.product?.category?.name ?? '—'}</div>
      </div>
    )},
    { key: 'branch',    header: 'Branch',      render: r => r.branch?.name ?? '—' },
    { key: 'quantity',  header: 'Stock',        render: r => {
      const qty = r.quantity ?? 0
      const low = r.product?.reorder_level ?? 5
      const isOut = qty <= 0
      const isLow = qty > 0 && qty <= low
      return (
        <span style={{ fontSize: 13, fontWeight: 800, color: isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A',
          background: isOut ? '#FDECEA' : isLow ? '#FEF0E6' : '#EAF5EE', padding: '2px 10px', borderRadius: 20 }}>
          {isOut ? 'Out' : qty}
        </span>
      )
    }},
    { key: 'reorder',   header: 'Reorder At',  render: r => r.product?.reorder_level ?? 5 },
    { key: 'supplier',  header: 'Supplier',     render: r => r.product?.supplier?.name ?? '—' },
    { key: 'actions',   header: '',             render: r => isAdminLike ? (
      <Btn size="sm" variant="ghost" onClick={() => { setAdjustTarget(r); adjustForm.reset({ type: 'add', quantity: 0, notes: '' }) }}>
        Adjust
      </Btn>
    ) : null },
  ], [isAdminLike, adjustForm])

  const lowColumns = [
    { key: 'product',  header: 'Product',      render: r => <span style={{ fontWeight: 600 }}>{r.product?.name}</span> },
    { key: 'branch',   header: 'Branch',       render: r => r.branch?.name ?? '—' },
    { key: 'stock',    header: 'Current Stock',render: r => <span style={{ fontWeight: 800, color: '#C0392B' }}>{r.quantity}</span> },
    { key: 'reorder',  header: 'Reorder At',   render: r => r.product?.reorder_level ?? 5 },
    { key: 'deficit',  header: 'Deficit',      render: r => <span style={{ color: '#C45A00', fontWeight: 700 }}>{Math.max(0, (r.product?.reorder_level ?? 5) - (r.quantity ?? 0))}</span> },
  ]

  const lowRows = useMemo(() => (lowStockQuery.data ?? []), [lowStockQuery.data])

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

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setPage(1) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
              borderColor: tab === id ? 'var(--edlp-primary)' : '#E5EBF2',
              background: tab === id ? 'rgba(232,160,32,0.08)' : '#fff',
              color: tab === id ? '#C98516' : '#8A9AB5',
            }}>
            <Icon size={13} /> {label}
            {id === 'expiry' && (lowStockQuery.data?.length > 0) ? null : null}
          </button>
        ))}
      </div>

      {/* KPI cards on list tab */}
      {tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <StatCard label="Total SKUs"    value={meta?.total ?? '—'}       color="#1A3FA6" />
          <StatCard label="Out of Stock"  value={rows.filter(r => r.quantity <= 0).length} color="#C0392B" />
          <StatCard label="Low Stock"     value={lowRows.length}            color="#C45A00" />
          <StatCard label="Healthy"       value={rows.filter(r => r.quantity > (r.product?.reorder_level ?? 5)).length} color="#1A6E3A" />
        </div>
      )}

      {/* ── ALL STOCK ──────────────────────────────────────────── */}
      {tab === 'list' && (
        <Card>
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid #F0F4F8', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchInput value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search product, SKU…" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, color: '#3A4A5C', outline: 'none', background: '#fff' }}>
              <option value="">All Status</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <button onClick={() => inventoryQuery.refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          <DataTable
            columns={columns} rows={rows} rowKey={r => r.id}
            loading={inventoryQuery.isLoading}
            emptyMessage="No inventory records found."
            pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
          />
        </Card>
      )}

      {tab === 'in'       && <StockInTab  products={products} user={user} isAdminLike={isAdminLike} />}
      {tab === 'out'      && <StockOutTab products={products} user={user} isAdminLike={isAdminLike} />}
      {tab === 'transfer' && <TransferTab products={products} branches={branches} user={user} isAdminLike={isAdminLike} />}
      {tab === 'expiry'   && <ExpiryTab user={user} isAdminLike={isAdminLike} />}

      {/* ── STOCK-TAKE ────────────────────────────────────────── */}
      {tab === 'stocktake' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: '#FEF0E6', borderRadius: 10, fontSize: 13, color: '#C45A00', display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            Go to <strong>All Stock</strong> tab first to load inventory, then click <strong>Stock-Take</strong> to enter physical counts.
          </div>
          <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <ClipboardCheck size={48} color="#E5EBF2" />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1C2B3A' }}>Start a Stock-Take</div>
            <div style={{ fontSize: 13, color: '#8A9AB5', textAlign: 'center', maxWidth: 400 }}>
              Load the <strong>All Stock</strong> tab, then click the <strong>Stock-Take</strong> button top-right to enter physical counts.
            </div>
            <Btn onClick={() => setTab('list')}><Package size={14} /> Go to All Stock →</Btn>
          </Card>
        </div>
      )}

      {/* ── LOW STOCK ────────────────────────────────────────── */}
      {tab === 'low' && (
        <Card>
          {lowRows.length === 0 && !lowStockQuery.isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: '60px 0' }}>
              <CheckCircle size={40} color="#EAF5EE" />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1C2B3A' }}>All stock levels are healthy!</div>
              <div style={{ fontSize: 13, color: '#8A9AB5' }}>Nothing below reorder level.</div>
            </div>
          ) : (
            <DataTable columns={lowColumns} rows={lowRows} rowKey={r => r.id} loading={lowStockQuery.isLoading} emptyMessage="No low stock items." />
          )}
        </Card>
      )}

      {/* ── Inline Adjust Modal ───────────────────────────────── */}
      <Modal open={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.product?.name ?? ''}`} width={420}
        footer={<>
          <Btn variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Btn>
          <Btn onClick={adjustForm.handleSubmit(d => adjustMut.mutate(d))} disabled={adjustMut.isPending}>
            {adjustMut.isPending ? <><Spinner size={12} /> Applying…</> : 'Apply Adjustment'}
          </Btn>
        </>}
      >
        {adjustTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#F6F8FB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Current Stock</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1C2B3A' }}>{adjustTarget.quantity}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Reorder Level</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#C45A00' }}>{adjustTarget.product?.reorder_level ?? 5}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', marginBottom: 8 }}>Adjustment Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { value: 'add',    label: '+ Add',    color: '#1A6E3A', bg: '#EAF5EE' },
                  { value: 'remove', label: '− Remove', color: '#C0392B', bg: '#FDECEA' },
                  { value: 'set',    label: '= Set',    color: '#1A3FA6', bg: '#EAF0FB' },
                ].map(opt => {
                  const sel = adjustForm.watch('type') === opt.value
                  return (
                    <button key={opt.value} type="button" onClick={() => adjustForm.setValue('type', opt.value)}
                      style={{ padding: '10px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${sel ? opt.color : '#E5EBF2'}`,
                        background: sel ? opt.bg : '#fff', color: sel ? opt.color : '#8A9AB5', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <FormField label="Quantity">
              <FormInput register={adjustForm.register('quantity')} type="number" min={0} placeholder="0" />
            </FormField>
            <FormField label="Notes / Reason">
              <textarea {...adjustForm.register('notes')} rows={2} placeholder="Reason for adjustment…"
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }} />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── Stock-Take Modal ──────────────────────────────────── */}
      <Modal open={stockTakeOpen} onClose={() => setStockTakeOpen(false)}
        title="Stock-Take — Physical Count" width={620}
        footer={<>
          <Btn variant="ghost" onClick={() => setStockTakeOpen(false)}>Cancel</Btn>
          <Btn onClick={stForm.handleSubmit(d => stMut.mutate(d))} disabled={stMut.isPending}>
            {stMut.isPending ? <><Spinner size={12} /> Saving…</> : 'Save Stock-Take'}
          </Btn>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '10px 14px', background: '#FEF0E6', borderRadius: 8, fontSize: 12, color: '#C45A00', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            Enter physical count for each item. Variances auto-calculated.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '8px 12px', background: '#F6F8FB', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Product</span>
            <span style={{ textAlign: 'right' }}>System</span>
            <span style={{ textAlign: 'right' }}>Physical</span>
            <span style={{ textAlign: 'right' }}>Variance</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {stFields.map((field, idx) => {
              const phys     = Number(stForm.watch(`items.${idx}.quantity`)) || 0
              const variance = phys - (field.current ?? 0)
              const varColor = variance > 0 ? '#1A6E3A' : variance < 0 ? '#C0392B' : '#8A9AB5'
              return (
                <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '8px 12px', borderBottom: '1px solid #F0F4F8', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#3A4A5C', fontWeight: 500 }}>{field.name}</span>
                  <span style={{ textAlign: 'right', fontSize: 13, color: '#8A9AB5', fontWeight: 600 }}>{field.current}</span>
                  <input type="number" min={0} {...stForm.register(`items.${idx}.quantity`)} defaultValue={field.current}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 13, fontWeight: 700, textAlign: 'right', border: '1px solid #D5DFE9', borderRadius: 6, outline: 'none', color: '#1C2B3A' }} />
                  <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: varColor }}>
                    {variance > 0 ? `+${variance}` : variance}
                  </span>
                </div>
              )
            })}
            {stFields.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#8A9AB5', fontSize: 13 }}>
                Go to All Stock tab first to load inventory items.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
