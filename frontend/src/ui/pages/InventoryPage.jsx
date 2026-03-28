/**
 * InventoryPage — Branch-scoped stock management
 * Design: matching Image 17 style.
 * Features:
 *  - Inventory list with stock bar, status badges, last stock-take date
 *  - Adjust stock drawer (add / remove / set)
 *  - Inter-branch transfer modal
 *  - Stock-take modal (batch count entry)
 *  - Low stock tab
 *  - Category filter + search
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import {
  Package, Plus, Minus, ArrowLeftRight, ClipboardCheck,
  AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Badge, Modal, FormField, FormInput, FormSelect,
  Spinner, StatCard,
} from '../components/shared'

// ── Stock level bar (same as ProductsPage) ────────────────────────────────────
function StockBar({ qty, reorderLevel = 5 }) {
  const max   = Math.max(reorderLevel * 4, qty, 1)
  const pct   = Math.min((qty / max) * 100, 100)
  const isLow = qty > 0 && qty <= reorderLevel
  const isOut = qty <= 0
  const color = isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, background: '#F0F4F8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{qty}</span>
    </div>
  )
}

// ── Status badge helper ───────────────────────────────────────────────────────
function StockBadge({ status }) {
  if (status === 'out') return <Badge color="danger">Out of Stock</Badge>
  if (status === 'low') return <Badge color="warning">Low Stock</Badge>
  return <Badge color="success">In Stock</Badge>
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const adjustSchema = z.object({
  type:     z.enum(['add', 'remove', 'set']),
  quantity: z.coerce.number().min(0, 'Must be 0 or more'),
  notes:    z.string().optional(),
})

const transferSchema = z.object({
  from_branch_id: z.coerce.number().min(1, 'Select source branch'),
  to_branch_id:   z.coerce.number().min(1, 'Select destination branch'),
  quantity:       z.coerce.number().min(1, 'Min 1'),
  notes:          z.string().optional(),
})

export function InventoryPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore((s) => s.user)
  const isAdminLike = useAuthStore((s) => s.isAdminLike())
  const isCashier   = !isAdminLike

  const [tab, setTab]               = useState('list') // list | low
  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]             = useState(1)

  const [adjustTarget, setAdjustTarget]   = useState(null) // inventory row
  const [transferTarget, setTransferTarget] = useState(null) // inventory row
  const [stockTakeOpen, setStockTakeOpen] = useState(false)

  // ── Data ───────────────────────────────────────────────────
  const inventoryQuery = useQuery({
    queryKey: ['inventory', { q: debouncedSearch, status: statusFilter, page, tab }],
    enabled: tab === 'list',
    queryFn: async () => {
      const res = await api.get('/inventory', {
        params: {
          search:   debouncedSearch || undefined,
          status:   statusFilter || undefined,
          page,
          per_page: 20,
        },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    enabled: tab === 'low',
    queryFn: async () => {
      const res = await api.get('/inventory/low-stock')
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'simple'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page: 300 } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
    enabled: stockTakeOpen,
  })

  const rows      = inventoryQuery.data?.data ?? []
  const meta      = inventoryQuery.data?.meta
  const lowRows   = lowStockQuery.data ?? []
  const branches  = branchesQuery.data ?? []
  const products  = productsQuery.data ?? []

  // ── Adjust form ────────────────────────────────────────────
  const adjustForm = useForm({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: 'add', quantity: 1, notes: '' },
  })

  const adjustMutation = useMutation({
    mutationFn: (data) => api.post('/inventory/adjust', {
      product_id: adjustTarget?.product_id,
      branch_id:  user?.branch_id,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Stock adjusted successfully')
      setAdjustTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Adjustment failed'),
  })

  function openAdjust(row) {
    adjustForm.reset({ type: 'add', quantity: 1, notes: '' })
    setAdjustTarget(row)
  }

  // ── Transfer form ──────────────────────────────────────────
  const transferForm = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: { from_branch_id: user?.branch_id ?? '', to_branch_id: '', quantity: 1, notes: '' },
  })

  const transferMutation = useMutation({
    mutationFn: (data) => api.post('/inventory/transfer', {
      product_id: transferTarget?.product_id,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Transfer request submitted for approval')
      setTransferTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Transfer failed'),
  })

  function openTransfer(row) {
    transferForm.reset({ from_branch_id: user?.branch_id ?? '', to_branch_id: '', quantity: 1, notes: '' })
    setTransferTarget(row)
  }

  // ── Stock-take ─────────────────────────────────────────────
  const stockTakeForm = useForm({
    defaultValues: { items: [] },
  })
  const { fields: stFields, replace: replaceStFields } = useFieldArray({ control: stockTakeForm.control, name: 'items' })

  function openStockTake() {
    // Pre-populate all current items
    replaceStFields(rows.map(r => ({
      product_id: r.product_id,
      name: r.product?.name ?? `Product #${r.product_id}`,
      current: r.quantity,
      quantity: r.quantity,
    })))
    setStockTakeOpen(true)
  }

  const stockTakeMutation = useMutation({
    mutationFn: (data) => api.post('/inventory/stock-take', {
      items: data.items.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      const results = res.data?.data ?? []
      const variances = results.filter(r => r.variance !== 0).length
      toast.success(`Stock-take recorded. ${variances} variance${variances !== 1 ? 's' : ''} found.`)
      setStockTakeOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Stock-take failed'),
  })

  // ── Table columns ──────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'product',
      header: 'Product',
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>{r.product?.category?.name ?? '—'} · SKU: {r.product?.sku ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock Level (All Branches)',
      cell: (r) => <StockBar qty={r.quantity} reorderLevel={r.product?.reorder_level ?? 5} />,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      cell: (r) => <span style={{ fontSize: 12, color: '#8A9AB5' }}>{r.reserved_quantity ?? 0}</span>,
    },
    {
      key: 'available',
      header: 'Available',
      cell: (r) => <span style={{ fontWeight: 600, fontSize: 13, color: '#1C2B3A' }}>{r.available_quantity ?? r.quantity}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StockBadge status={r.status} />,
    },
    {
      key: 'last_count',
      header: 'Last Count',
      cell: (r) => r.last_stock_take_at
        ? <span style={{ fontSize: 11, color: '#8A9AB5' }}>{formatDistanceToNow(new Date(r.last_stock_take_at), { addSuffix: true })}</span>
        : <span style={{ fontSize: 11, color: '#D5DFE9' }}>Never counted</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {isAdminLike && (
            <>
              <button title="Adjust stock" onClick={(e) => { e.stopPropagation(); openAdjust(r) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600 }}
                onMouseEnter={e=>e.currentTarget.style.color='#1A6E3A'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              >
                <RefreshCw size={13}/> Adjust
              </button>
              <button title="Transfer to another branch" onClick={(e) => { e.stopPropagation(); openTransfer(r) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600 }}
                onMouseEnter={e=>e.currentTarget.style.color='#1A3FA6'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              >
                <ArrowLeftRight size={13}/> Transfer
              </button>
            </>
          )}
        </div>
      ),
    },
  ], [isAdminLike])

  const lowColumns = useMemo(() => [
    {
      key: 'product',
      header: 'Product',
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>{r.product?.sku} · Reorder at: {r.product?.reorder_level ?? 5}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      cell: (r) => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{r.branch?.name ?? '—'}</span>,
    },
    {
      key: 'stock',
      header: 'Current Stock',
      cell: (r) => <StockBar qty={r.quantity} reorderLevel={r.product?.reorder_level ?? 5} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StockBadge status={r.status} />,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (r) => isAdminLike
        ? <Btn variant="secondary" size="sm" onClick={() => openAdjust(r)}>Restock</Btn>
        : null,
    },
  ], [isAdminLike])

  // ── Summary counts ─────────────────────────────────────────
  const outCount = rows.filter(r => r.status === 'out').length
  const lowCount = rows.filter(r => r.status === 'low').length
  const okCount  = rows.filter(r => r.status === 'ok').length

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Branch-scoped stock management. Cashiers are view-only."
        actions={
          isAdminLike && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" icon={ClipboardCheck} onClick={openStockTake}>Stock-Take</Btn>
            </div>
          )
        }
      />

      {/* KPI summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="In Stock" value={okCount} icon={CheckCircle} accent="#1A6E3A" />
        <StatCard label="Low Stock" value={lowCount} icon={AlertTriangle} accent="#C45A00" />
        <StatCard label="Out of Stock" value={outCount} icon={Package} accent="#C0392B" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
        {[
          { id: 'list', label: 'All Inventory' },
          { id: 'low',  label: `Low Stock ${lowRows.length ? `(${lowRows.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
              border: tab === t.id ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
              background: tab === t.id ? 'rgba(232,160,32,0.08)' : '#fff',
              color: tab === t.id ? '#C98516' : '#8A9AB5',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Inventory list ─────────────────────────────────── */}
      {tab === 'list' && (
        <Card>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Search product name or SKU…"
              style={{ flex: 1, minWidth: 220 }}
            />
            {['', 'low', 'out'].map(v => (
              <button key={v} onClick={() => { setStatusFilter(v); setPage(1) }}
                style={{ fontSize: 11, padding: '6px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer',
                  border: statusFilter === v ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
                  background: statusFilter === v ? 'rgba(232,160,32,0.08)' : '#fff',
                  color: statusFilter === v ? '#C98516' : '#8A9AB5',
                }}>
                {v === '' ? 'All' : v === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={inventoryQuery.isLoading}
            emptyMessage="No inventory records found for this branch."
            pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
          />
        </Card>
      )}

      {/* ── Low stock list ──────────────────────────────────── */}
      {tab === 'low' && (
        <Card>
          {lowRows.length === 0 && !lowStockQuery.isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: '#1A6E3A', fontSize: 14, fontWeight: 600 }}>
              <CheckCircle size={20} /> All stock levels are healthy — nothing below reorder level.
            </div>
          ) : (
            <DataTable
              columns={lowColumns}
              rows={lowRows}
              rowKey={(r) => r.id}
              loading={lowStockQuery.isLoading}
              emptyMessage="No low stock items."
            />
          )}
        </Card>
      )}

      {/* ── Adjust Stock Modal ──────────────────────────────── */}
      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.product?.name ?? ''}`}
        width={420}
        footer={<>
          <Btn variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Btn>
          <Btn onClick={adjustForm.handleSubmit((d) => adjustMutation.mutate(d))} disabled={adjustMutation.isPending}>
            {adjustMutation.isPending ? <><Spinner size={12}/> Applying…</> : 'Apply Adjustment'}
          </Btn>
        </>}
      >
        {adjustTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Current stock info */}
            <div style={{ background: '#F6F8FB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Current Stock</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1C2B3A' }}>{adjustTarget.quantity}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Reorder Level</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#C45A00' }}>{adjustTarget.product?.reorder_level ?? 5}</div>
              </div>
            </div>

            <FormField label="Adjustment Type" required>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { value: 'add',    label: '+ Add',   color: '#1A6E3A', bg: '#EAF5EE' },
                  { value: 'remove', label: '− Remove', color: '#C0392B', bg: '#FDECEA' },
                  { value: 'set',    label: '= Set',    color: '#1A3FA6', bg: '#EAF0FB' },
                ].map(opt => {
                  const selected = adjustForm.watch('type') === opt.value
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => adjustForm.setValue('type', opt.value)}
                      style={{
                        padding: '10px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${selected ? opt.color : '#E5EBF2'}`,
                        background: selected ? opt.bg : '#fff',
                        color: selected ? opt.color : '#8A9AB5',
                        transition: 'all 0.15s',
                      }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </FormField>

            <FormField label="Quantity" required error={adjustForm.formState.errors.quantity?.message}>
              <FormInput register={adjustForm.register('quantity')} type="number" min={0} placeholder="0" />
            </FormField>

            <FormField label="Notes / Reason">
              <textarea {...adjustForm.register('notes')} rows={2} placeholder="Reason for adjustment…"
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
                onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── Transfer Stock Modal ────────────────────────────── */}
      <Modal
        open={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        title={`Inter-Branch Transfer — ${transferTarget?.product?.name ?? ''}`}
        width={460}
        footer={<>
          <Btn variant="ghost" onClick={() => setTransferTarget(null)}>Cancel</Btn>
          <Btn onClick={transferForm.handleSubmit((d) => transferMutation.mutate(d))} disabled={transferMutation.isPending}>
            {transferMutation.isPending ? <><Spinner size={12}/> Submitting…</> : 'Submit Transfer Request'}
          </Btn>
        </>}
      >
        {transferTarget && (
          <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', background: '#EAF0FB', borderRadius: 8, fontSize: 12, color: '#1A3FA6', display: 'flex', gap: 8 }}>
              <ArrowLeftRight size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Transfer requests must be approved by an admin before stock is moved.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="From Branch" required error={transferForm.formState.errors.from_branch_id?.message}>
                <FormSelect register={transferForm.register('from_branch_id')}>
                  <option value="">Select…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="To Branch" required error={transferForm.formState.errors.to_branch_id?.message}>
                <FormSelect register={transferForm.register('to_branch_id')}>
                  <option value="">Select…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormSelect>
              </FormField>
            </div>

            <FormField label="Quantity to Transfer" required error={transferForm.formState.errors.quantity?.message}
              hint={`Available in source branch: ${transferTarget.available_quantity ?? transferTarget.quantity}`}>
              <FormInput register={transferForm.register('quantity')} type="number" min={1} placeholder="1" />
            </FormField>

            <FormField label="Notes">
              <textarea {...transferForm.register('notes')} rows={2} placeholder="Reason for transfer…"
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
                onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
              />
            </FormField>
          </form>
        )}
      </Modal>

      {/* ── Stock-Take Modal ────────────────────────────────── */}
      <Modal
        open={stockTakeOpen}
        onClose={() => setStockTakeOpen(false)}
        title="Stock-Take — Record Physical Count"
        width={600}
        footer={<>
          <Btn variant="ghost" onClick={() => setStockTakeOpen(false)}>Cancel</Btn>
          <Btn onClick={stockTakeForm.handleSubmit((d) => stockTakeMutation.mutate(d))} disabled={stockTakeMutation.isPending}>
            {stockTakeMutation.isPending ? <><Spinner size={12}/> Saving…</> : 'Save Stock-Take'}
          </Btn>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '10px 12px', background: '#FEF0E6', borderRadius: 8, fontSize: 12, color: '#C45A00', marginBottom: 10, display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Enter the physical count for each item. Variances will be calculated automatically.
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '8px 12px', background: '#F6F8FB', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <span>Product</span><span style={{ textAlign: 'right' }}>System</span><span style={{ textAlign: 'right' }}>Physical</span><span style={{ textAlign: 'right' }}>Variance</span>
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {stFields.map((field, idx) => {
              const physQty    = Number(stockTakeForm.watch(`items.${idx}.quantity`)) || 0
              const variance   = physQty - (field.current ?? 0)
              const varColor   = variance > 0 ? '#1A6E3A' : variance < 0 ? '#C0392B' : '#8A9AB5'
              return (
                <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '8px 12px', borderBottom: '1px solid #F0F4F8', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#3A4A5C', fontWeight: 500 }}>{field.name}</span>
                  <span style={{ textAlign: 'right', fontSize: 13, color: '#8A9AB5', fontWeight: 600 }}>{field.current}</span>
                  <input
                    type="number" min={0}
                    {...stockTakeForm.register(`items.${idx}.quantity`)}
                    defaultValue={field.current}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 13, fontWeight: 700, textAlign: 'right', border: '1px solid #D5DFE9', borderRadius: 6, outline: 'none', color: '#1C2B3A' }}
                    onFocus={e => e.target.style.borderColor = 'var(--edlp-primary)'}
                    onBlur={e => e.target.style.borderColor = '#D5DFE9'}
                  />
                  <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: varColor }}>
                    {variance > 0 ? `+${variance}` : variance}
                  </span>
                </div>
              )
            })}
          </div>

          {stFields.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#8A9AB5', fontSize: 13 }}>
              No inventory records to count for this branch.
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
