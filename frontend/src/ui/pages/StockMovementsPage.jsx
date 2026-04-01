/**
 * StockMovementsPage — Non-Sales Stock Removals & Shrinkage Analysis
 *
 * GET  /api/stock-movements                        — paginated list
 * POST /api/stock-movements                        — submit new request
 * GET  /api/stock-movements/reports/shrinkage      — monthly breakdown
 *
 * All requests route through the Approval Workflow Engine.
 * Stock deducted only after final approval.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import { format, startOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, Package, TrendingDown, BarChart2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

const MOVEMENT_TYPES = [
  { v: 'sampling',               label: 'Sampling / Demo' },
  { v: 'internal_use',           label: 'Internal Use' },
  { v: 'staff_welfare',          label: 'Staff Welfare' },
  { v: 'damaged',                label: 'Damaged Goods' },
  { v: 'management_consumption', label: 'Management Consumption' },
  { v: 'recalled',               label: 'Recalled' },
]

const TYPE_COLOR = {
  sampling:               { bg: '#EAF0FB', color: '#1A3FA6' },
  internal_use:           { bg: '#E6F5F5', color: '#0F6E6E' },
  staff_welfare:          { bg: '#EAF5EE', color: '#1A6E3A' },
  damaged:                { bg: '#FDECEA', color: '#C0392B' },
  management_consumption: { bg: '#FEF0E6', color: '#C45A00' },
  recalled:               { bg: '#F0ECFB', color: '#5B3FA6' },
}

const STATUS_COLOR = { pending: 'warning', approved: 'success', rejected: 'danger', executed: 'info' }

const schema = z.object({
  product_id:    z.coerce.number().min(1, 'Select a product'),
  movement_type: z.string().min(1, 'Select a type'),
  quantity:      z.coerce.number().min(1, 'Min 1'),
  reason:        z.string().min(10, 'Describe the reason (min 10 chars)'),
})

function TypeChip({ type }) {
  const c     = TYPE_COLOR[type] ?? { bg: '#F0F4F8', color: '#8A9AB5' }
  const label = MOVEMENT_TYPES.find(t => t.v === type)?.label ?? type
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export function StockMovementsPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)

  const [tab, setTab]         = useState('movements')
  const [search, setSearch]   = useState('')
  const [dSearch]             = useDebounce(search, 300)
  const [page, setPage]       = useState(1)
  const [typeFilter, setType] = useState('')
  const [addModal, setAdd]    = useState(false)

  const now       = new Date()
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthTo   = format(now, 'yyyy-MM-dd')

  const movementsQ = useQuery({
    queryKey: ['stock-movements', { q: dSearch, page, type: typeFilter }],
    queryFn: async () => {
      const res = await api.get('/stock-movements', {
        params: { search: dSearch || undefined, page, per_page: 20, movement_type: typeFilter || undefined },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const shrinkageQ = useQuery({
    queryKey: ['shrinkage-report', monthFrom, monthTo, user?.branch_id],
    enabled: tab === 'shrinkage',
    queryFn: async () => {
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
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { product_id: '', movement_type: '', quantity: 1, reason: '' },
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/stock-movements', d),
    onSuccess: () => {
      toast.success('Movement request submitted — pending approval')
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['approval-count'] })
      reset(); setAdd(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to submit'),
  })

  const movements         = movementsQ.data?.data ?? []
  const meta              = movementsQ.data?.meta
  const shrinkage         = shrinkageQ.data ?? []
  const shrinkageTotal    = shrinkage.reduce((s, r) => s + (r.total_value ?? 0), 0)
  const shrinkageTotalQty = shrinkage.reduce((s, r) => s + (r.total_qty ?? 0), 0)

  const columns = [
    { key: 'type',    header: 'Type',         render: r => <TypeChip type={r.movement_type} /> },
    { key: 'product', header: 'Product',       render: r => <span style={{ fontWeight: 600 }}>{r.product?.name ?? `#${r.product_id}`}</span> },
    { key: 'qty',     header: 'Qty',           render: r => <strong style={{ color: '#C0392B' }}>{r.quantity}</strong> },
    { key: 'reason',  header: 'Reason',        render: r => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{(r.reason ?? '').slice(0, 55)}{r.reason?.length > 55 ? '…' : ''}</span> },
    { key: 'by',      header: 'Requested By',  render: r => r.requestedBy?.name ?? r.requested_by?.name ?? '—' },
    { key: 'status',  header: 'Status',        render: r => <Badge color={STATUS_COLOR[r.status] ?? 'default'}>{r.status}</Badge> },
    { key: 'date',    header: 'Date',          render: r => r.created_at ? format(new Date(r.created_at), 'd MMM yyyy') : '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Stock Movements"
        subtitle="Track all non-sales stock removals — sampling, damaged goods, internal use. Every movement requires approval and creates an immutable audit trail."
        action={<Btn onClick={() => setAdd(true)}><Plus size={14} /> New Request</Btn>}
      />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <StatCard label="Total Requests"   value={meta?.total ?? '—'}                             accent="#1A3FA6" />
        <StatCard label="Pending Approval" value={movements.filter(m => m.status === 'pending').length}  accent="#C45A00" />
        <StatCard label="Executed"         value={movements.filter(m => m.status === 'executed').length} accent="#1A6E3A" />
        <StatCard label="Rejected"         value={movements.filter(m => m.status === 'rejected').length} accent="#C0392B" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1.5px solid #E5EBF2' }}>
        {[
          { id: 'movements', label: 'Movement Requests', Icon: Package },
          { id: 'shrinkage', label: 'Shrinkage Analysis', Icon: TrendingDown },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t.id ? '2px solid #E8A020' : '2px solid transparent', color: tab === t.id ? '#1C2B3A' : '#8A9AB5', marginBottom: -1.5 }}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Movements Tab */}
      {tab === 'movements' && (
        <Card>
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F0F4F8', flexWrap: 'wrap' }}>
            <SearchInput
              value={search}
              onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }}
              placeholder="Search product or reason…"
            />
            <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(1) }}
              style={{ fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, padding: '7px 12px', background: '#fff', color: '#3A4A5C', outline: 'none' }}>
              <option value="">All Types</option>
              {MOVEMENT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <DataTable
            columns={columns} rows={movements} rowKey="id"
            loading={movementsQ.isLoading}
            emptyMessage="No stock movements found. Click 'New Request' to record one."
            pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
          />
        </Card>
      )}

      {/* Shrinkage Tab */}
      {tab === 'shrinkage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <StatCard label="Total Write-Off (Month)" value={money(shrinkageTotal)}    accent="#C0392B" />
            <StatCard label="Total Units Removed"     value={shrinkageTotalQty}         accent="#5B3FA6" />
            <StatCard label="Movement Categories"     value={shrinkage.length}          accent="#1A3FA6" />
          </div>
          <div style={{ fontSize: 12, color: '#8A9AB5' }}>
            Executed movements · <strong>{format(startOfMonth(now), 'MMMM yyyy')}</strong> · Your branch
          </div>
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <BarChart2 size={16} color="#1A3FA6" />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A' }}>Shrinkage by Movement Type</div>
            </div>
            {shrinkageQ.isLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={20} /></div>
            ) : shrinkage.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>No executed movements this month.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Movement Type', 'Total Units', 'Est. Cost Value', '% of Total'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A9AB5' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shrinkage.map(row => {
                    const pct = shrinkageTotal > 0 ? ((row.total_value / shrinkageTotal) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={row.type} style={{ borderBottom: '0.5px solid #F0F4F8' }}>
                        <td style={{ padding: '12px 14px' }}><TypeChip type={row.type} /></td>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>{row.total_qty}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#C0392B' }}>{money(row.total_value)}</td>
                        <td style={{ padding: '12px 14px' }}>
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
                    <td style={{ padding: '12px 14px', color: '#1C2B3A' }}>TOTAL</td>
                    <td style={{ padding: '12px 14px' }}>{shrinkageTotalQty}</td>
                    <td style={{ padding: '12px 14px', color: '#C0392B' }}>{money(shrinkageTotal)}</td>
                    <td style={{ padding: '12px 14px', color: '#8A9AB5' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* New Movement Modal */}
      <Modal open={addModal} onClose={() => { setAdd(false); reset() }} title="New Stock Movement Request" width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setAdd(false); reset() }}>Cancel</Btn>
            <Btn onClick={handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Submitting…</> : 'Submit for Approval'}
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#FEF0E6', border: '1px solid #F5D0A9', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#C45A00', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Routed through the <strong>Approval Workflow Engine</strong>. Stock is only deducted after final approval.</span>
          </div>
          <FormField label="Product *" error={errors.product_id?.message}>
            <FormSelect register={register('product_id')}>
              <option value="">Select product…</option>
              {(productsQ.data ?? []).map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </FormSelect>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="Movement Type *" error={errors.movement_type?.message}>
              <FormSelect register={register('movement_type')}>
                <option value="">Select type…</option>
                {MOVEMENT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Quantity *" error={errors.quantity?.message}>
              <FormInput register={register('quantity')} type="number" min={1} placeholder="e.g. 5" />
            </FormField>
          </div>
          <FormField label="Reason / Justification *" error={errors.reason?.message}>
            <textarea rows={3} placeholder="Describe why this stock is being removed (min 10 chars)…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, fontSize: 13, color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              {...register('reason')} />
          </FormField>
          {createMut.isError && (
            <div style={{ background: '#FDECEA', color: '#C0392B', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
              {createMut.error?.response?.data?.message ?? 'Failed to submit request'}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
