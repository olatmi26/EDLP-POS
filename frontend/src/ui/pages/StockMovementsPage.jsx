/**
 * StockMovementsPage — Enterprise Non-Sales Stock Removal & Shrinkage Hub
 *
 * GET  /api/stock-movements                   — paginated list
 * POST /api/stock-movements                   — submit new request (approval required)
 * GET  /api/stock-movements/reports/shrinkage — monthly shrinkage breakdown
 *
 * All stock removals route through the Approval Workflow Engine.
 * Stock is deducted ONLY after final approval — full audit trail.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import { format, startOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Plus, AlertTriangle, Package, TrendingDown, BarChart2,
  Clock, CheckCircle, XCircle, RefreshCw, Search,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner,
} from '../components/shared'

// ─────────────────────────────────────────────────────────────────────────────
const MOVEMENT_TYPES = [
  { v: 'sampling',               label: 'Sampling / Demo',          desc: 'Product given as sample to customers or at events' },
  { v: 'internal_use',           label: 'Internal Use',             desc: 'Used by staff for business operations' },
  { v: 'staff_welfare',          label: 'Staff Welfare',            desc: 'Given to staff as part of welfare package' },
  { v: 'damaged',                label: 'Damaged Goods',            desc: 'Product damaged in store or during handling' },
  { v: 'management_consumption', label: 'Management Consumption',   desc: 'Consumed or used by management' },
  { v: 'recalled',               label: 'Recalled by Manufacturer', desc: 'Returned to supplier or destroyed per recall notice' },
]

const TYPE_CONFIG = {
  sampling:               { bg: '#EAF0FB', color: '#1A3FA6', icon: '🎁' },
  internal_use:           { bg: '#E6F5F5', color: '#0F6E6E', icon: '🏢' },
  staff_welfare:          { bg: '#EAF5EE', color: '#1A6E3A', icon: '👥' },
  damaged:                { bg: '#FDECEA', color: '#C0392B', icon: '💔' },
  management_consumption: { bg: '#FEF0E6', color: '#C45A00', icon: '🔑' },
  recalled:               { bg: '#F0ECFB', color: '#5B3FA6', icon: '⚠️' },
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Approval', color: '#C45A00', bg: '#FEF0E6', icon: Clock },
  approved: { label: 'Approved',         color: '#1A6E3A', bg: '#EAF5EE', icon: CheckCircle },
  rejected: { label: 'Rejected',         color: '#C0392B', bg: '#FDECEA', icon: XCircle },
  executed: { label: 'Executed',         color: '#1A3FA6', bg: '#EAF0FB', icon: CheckCircle },
}

const schema = z.object({
  product_id:    z.coerce.number().min(1, 'Select a product'),
  movement_type: z.string().min(1, 'Select a movement type'),
  quantity:      z.coerce.number().min(1, 'Minimum 1 unit'),
  reason:        z.string().min(10, 'Provide a detailed reason (min 10 characters)'),
})

function TypeChip({ type }) {
  const c = TYPE_CONFIG[type] ?? { bg: '#F0F4F8', color: '#8A9AB5', icon: '📦' }
  const t = MOVEMENT_TYPES.find(m => m.v === type)?.label ?? type
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.icon} {t}
    </span>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#8A9AB5', bg: '#F0F4F8', icon: Clock }
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

// Numbered pagination
function NumberedPagination({ current, last, total, onPage }) {
  if (!last || last <= 1) return null
  const pages = Array.from({ length: last }, (_, i) => i + 1)
    .filter(p => p === 1 || p === last || Math.abs(p - current) <= 2)
    .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i-1] > 1) acc.push('…'); acc.push(p); return acc }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px', borderTop: '1px solid #F0F4F8' }}>
      <button onClick={() => onPage(current - 1)} disabled={current <= 1}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5EBF2', background: '#fff', cursor: current <= 1 ? 'not-allowed' : 'pointer', color: current <= 1 ? '#D5DFE9' : '#3A4A5C', fontSize: 12, fontWeight: 600 }}>←</button>
      {pages.map((p, i) => p === '…'
        ? <span key={'e'+i} style={{ color: '#8A9AB5', fontSize: 12, padding: '0 2px' }}>…</span>
        : <button key={p} onClick={() => onPage(p)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              borderColor: p === current ? '#E8A020' : '#E5EBF2',
              background: p === current ? 'rgba(232,160,32,0.1)' : '#fff',
              color: p === current ? '#C98516' : '#3A4A5C' }}>{p}</button>
      )}
      <button onClick={() => onPage(current + 1)} disabled={current >= last}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5EBF2', background: '#fff', cursor: current >= last ? 'not-allowed' : 'pointer', color: current >= last ? '#D5DFE9' : '#3A4A5C', fontSize: 12, fontWeight: 600 }}>→</button>
      <span style={{ fontSize: 11, color: '#8A9AB5', marginLeft: 6 }}>{total} records</span>
    </div>
  )
}

export function StockMovementsPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [tab, setTab]           = useState('movements')
  const [search, setSearch]     = useState('')
  const [dSearch]               = useDebounce(search, 300)
  const [page, setPage]         = useState(1)
  const [typeFilter, setType]   = useState('')
  const [statusFilter, setStatus] = useState('')
  const [addModal, setAdd]      = useState(false)
  const [viewTarget, setView]   = useState(null)

  const now       = new Date()
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthTo   = format(now, 'yyyy-MM-dd')

  // ── Queries ────────────────────────────────────────────────────────────────
  const movementsQ = useQuery({
    queryKey: ['stock-movements', { q: dSearch, page, type: typeFilter, status: statusFilter }],
    queryFn: async () => {
      const res = await api.get('/stock-movements', {
        params: {
          search:        dSearch || undefined,
          page,
          per_page:      20,
          movement_type: typeFilter || undefined,
          status:        statusFilter || undefined,
        },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const shrinkageQ = useQuery({
    queryKey: ['shrinkage', monthFrom, monthTo],
    enabled:  tab === 'shrinkage',
    queryFn:  async () => {
      const res = await api.get('/stock-movements/reports/shrinkage', {
        params: { date_from: monthFrom, date_to: monthTo, branch_id: user?.branch_id || undefined },
      })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const productsQ = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 120_000,
    enabled: addModal,
  })

  // ── Form & mutations ───────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', movement_type: '', quantity: 1, reason: '' },
  })

  const selectedType = watch('movement_type')

  const createMut = useMutation({
    mutationFn: d => api.post('/stock-movements', d),
    onSuccess: () => {
      toast.success('Movement request submitted — pending approval')
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      reset()
      setAdd(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to submit'),
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const movements = movementsQ.data?.data ?? []
  const meta      = movementsQ.data?.meta
  const shrinkage = shrinkageQ.data ?? []

  const shrinkageTotal    = shrinkage.reduce((s, r) => s + (r.total_value ?? 0), 0)
  const shrinkageTotalQty = shrinkage.reduce((s, r) => s + (r.total_qty   ?? 0), 0)

  // Status counts from current page
  const pendingCount  = movements.filter(m => m.status === 'pending').length
  const executedCount = movements.filter(m => m.status === 'executed').length
  const rejectedCount = movements.filter(m => m.status === 'rejected').length

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'type',
      header: 'Movement Type',
      cell: r => <TypeChip type={r.movement_type} />,
    },
    {
      key: 'product',
      header: 'Product',
      cell: r => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.product?.name ?? `Product #${r.product_id}`}</div>
          {r.product?.sku && <div style={{ fontSize: 11, color: '#8A9AB5' }}>{r.product.sku}</div>}
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      cell: r => <strong style={{ color: '#C0392B', fontSize: 14 }}>{r.quantity}</strong>,
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: r => (
        <span style={{ fontSize: 12, color: '#6B7A8D' }}>
          {(r.reason ?? '').slice(0, 60)}{(r.reason?.length ?? 0) > 60 ? '…' : ''}
        </span>
      ),
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      cell: r => (
        <div style={{ fontSize: 12 }}>
          <div>{r.requestedBy?.name ?? r.requested_by?.name ?? '—'}</div>
          <div style={{ color: '#8A9AB5' }}>{r.created_at ? format(new Date(r.created_at), 'd MMM yyyy') : ''}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: r => (
        <button onClick={e => { e.stopPropagation(); setView(r) }}
          style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: 'none', border: '1px solid #E5EBF2', borderRadius: 6, cursor: 'pointer', color: '#3A4A5C' }}>
          View
        </button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <PageHeader
        title="Stock Movements"
        subtitle="Track all non-sales stock removals — sampling, damaged goods, internal use, staff welfare. Every movement is approval-gated and creates an immutable audit trail."
        actions={
          <Btn onClick={() => { reset(); setAdd(true) }}>
            <Plus size={14} /> New Movement Request
          </Btn>
        }
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Requests',  value: meta?.total ?? '—',  color: '#1A3FA6', bg: '#EAF0FB' },
          { label: 'Pending Approval',value: pendingCount,         color: '#C45A00', bg: '#FEF0E6' },
          { label: 'Executed',        value: executedCount,        color: '#1A6E3A', bg: '#EAF5EE' },
          { label: 'Rejected',        value: rejectedCount,        color: '#C0392B', bg: '#FDECEA' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}20`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1.5px solid #E5EBF2' }}>
        {[
          { id: 'movements', label: '📦 Movement Requests' },
          { id: 'shrinkage', label: '📉 Shrinkage Analysis' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t.id ? '2px solid #E8A020' : '2px solid transparent', color: tab === t.id ? '#1C2B3A' : '#8A9AB5', marginBottom: -1.5 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MOVEMENTS TAB ──────────────────────────────────────────────────── */}
      {tab === 'movements' && (
        <Card style={{ padding: 0 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F0F4F8', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5', pointerEvents: 'none' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search product or reason…"
                style={{ width: '100%', padding: '8px 10px 8px 28px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#E8A020'} onBlur={e => e.target.style.borderColor = '#E5EBF2'} />
            </div>
            <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(1) }}
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, background: '#fff', color: '#3A4A5C', outline: 'none' }}>
              <option value="">All Types</option>
              {MOVEMENT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }}
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, background: '#fff', color: '#3A4A5C', outline: 'none' }}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="executed">Executed</option>
            </select>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['stock-movements'] })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#8A9AB5', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            rows={movements}
            rowKey={r => r.id}
            loading={movementsQ.isLoading}
            emptyMessage="No stock movements found. Click 'New Movement Request' to record one."
            onRowClick={r => setView(r)}
          />
          <NumberedPagination current={meta?.current_page ?? 1} last={meta?.last_page ?? 1} total={meta?.total ?? 0} onPage={setPage} />
        </Card>
      )}

      {/* ── SHRINKAGE TAB ──────────────────────────────────────────────────── */}
      {tab === 'shrinkage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'Total Write-Off (Month)', value: money(shrinkageTotal),    color: '#C0392B' },
              { label: 'Total Units Removed',     value: shrinkageTotalQty,         color: '#5B3FA6' },
              { label: 'Categories Affected',     value: shrinkage.length,          color: '#1A3FA6' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #E5EBF2', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#8A9AB5' }}>
            Showing executed movements for <strong>{format(startOfMonth(now), 'MMMM yyyy')}</strong>
          </div>

          <Card style={{ padding: 0 }}>
            {shrinkageQ.isLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={22} /></div>
            ) : shrinkage.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>No executed movements this month.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Movement Type', 'Total Units', 'Est. Cost Value', '% of Total'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A9AB5', borderBottom: '1px solid #F0F4F8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shrinkage.map(row => {
                    const pct = shrinkageTotal > 0 ? ((row.total_value / shrinkageTotal) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={row.type} style={{ borderBottom: '0.5px solid #F8FAFC' }}>
                        <td style={{ padding: '12px 16px' }}><TypeChip type={row.type} /></td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{row.total_qty}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#C0392B' }}>{money(row.total_value)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#F0F4F8', borderRadius: 3 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#E8A020', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#8A9AB5', minWidth: 34 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                    <td style={{ padding: '12px 16px', color: '#1C2B3A' }}>TOTAL</td>
                    <td style={{ padding: '12px 16px' }}>{shrinkageTotalQty}</td>
                    <td style={{ padding: '12px 16px', color: '#C0392B' }}>{money(shrinkageTotal)}</td>
                    <td style={{ padding: '12px 16px', color: '#8A9AB5' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── NEW MOVEMENT MODAL ─────────────────────────────────────────────── */}
      <Modal open={addModal} onClose={() => { setAdd(false); reset() }}
        title="New Stock Movement Request" width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setAdd(false); reset() }}>Cancel</Btn>
            <Btn onClick={handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Submitting…</> : 'Submit for Approval'}
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Warning notice */}
          <div style={{ background: '#FEF0E6', border: '1px solid #F5D0A9', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="#C45A00" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#7B3500', lineHeight: 1.6 }}>
              <strong>Approval Required.</strong> This request will be sent through the Approval Workflow Engine.
              Stock is deducted <strong>only after final approval</strong>, creating an immutable audit record.
            </div>
          </div>

          {/* Movement type selector - visual cards */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 8 }}>Movement Type *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {MOVEMENT_TYPES.map(t => {
                const cfg = TYPE_CONFIG[t.v]
                const isSelected = selectedType === t.v
                return (
                  <label key={t.v}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1.5px solid ${isSelected ? cfg.color : '#E5EBF2'}`, borderRadius: 9, cursor: 'pointer', background: isSelected ? cfg.bg : '#fff', transition: 'all 0.12s' }}>
                    <input type="radio" value={t.v} {...register('movement_type')} style={{ display: 'none' }} />
                    <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? cfg.color : '#1C2B3A' }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: '#8A9AB5', marginTop: 1 }}>{t.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            {errors.movement_type && <div style={{ color: '#C0392B', fontSize: 11, marginTop: 4 }}>{errors.movement_type.message}</div>}
          </div>

          <FormField label="Product *" error={errors.product_id?.message}>
            <FormSelect register={register('product_id')}>
              <option value="">Select product…</option>
              {(productsQ.data ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="Quantity *" error={errors.quantity?.message}>
            <FormInput register={register('quantity')} type="number" min={1} placeholder="e.g. 5" />
          </FormField>

          <FormField label="Reason / Justification *" error={errors.reason?.message}>
            <textarea
              {...register('reason')}
              rows={3}
              placeholder="Describe in detail why this stock is being removed (minimum 10 characters)…"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = '#E8A020'}
              onBlur={e => e.target.style.borderColor = '#D5DFE9'}
            />
          </FormField>
        </div>
      </Modal>

      {/* ── VIEW DETAIL MODAL ─────────────────────────────────────────────── */}
      {viewTarget && (
        <Modal open={Boolean(viewTarget)} onClose={() => setView(null)}
          title="Movement Request Detail" width={520}
          footer={<Btn variant="ghost" onClick={() => setView(null)}>Close</Btn>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TypeChip type={viewTarget.movement_type} />
              <StatusBadge status={viewTarget.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Product',      value: viewTarget.product?.name ?? `#${viewTarget.product_id}` },
                { label: 'Quantity',     value: viewTarget.quantity },
                { label: 'Requested By', value: viewTarget.requestedBy?.name ?? viewTarget.requested_by?.name ?? '—' },
                { label: 'Date',         value: viewTarget.created_at ? format(new Date(viewTarget.created_at), 'd MMM yyyy, HH:mm') : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F6F8FB', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B3A' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#F6F8FB', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 4 }}>Reason / Justification</div>
              <div style={{ fontSize: 13, color: '#3A4A5C', lineHeight: 1.6 }}>{viewTarget.reason}</div>
            </div>

            {viewTarget.approvalRequest && (
              <div style={{ background: '#FDF3DC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#855000' }}>
                <strong>Approval Request:</strong> #{viewTarget.approvalRequest.id} · Status: {viewTarget.approvalRequest.status}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
