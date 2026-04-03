import React, { useState, useMemo, useEffect } from 'react'
/**
 * PromotionsPage — Promotions & Coupon Pricing Engine
 *
 * GET    /api/promotions              — list with status filter
 * POST   /api/promotions              — create (routes through approval)
 * PUT    /api/promotions/:id          — edit draft/paused
 * DELETE /api/promotions/:id          — delete non-active
 * PATCH  /api/promotions/:id/pause    — pause active
 * PATCH  /api/promotions/:id/activate — activate approved
 * POST   /api/promotions/:id/coupons/generate — batch coupon generation
 * GET    /api/categories              — for scope selector
 * GET    /api/products                — for scope selector
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, PauseCircle, PlayCircle,
  Tag, Ticket, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect,
  Spinner, StatCard,
} from '../components/shared'

// ── Constants ─────────────────────────────────────────────────────────────────
const PROMOTION_TYPES = [
  { v: 'percentage_discount', label: '% Discount' },
  { v: 'fixed_discount',      label: 'Fixed Discount (₦)' },
  { v: 'buy_X_get_Y',         label: 'Buy X Get Y' },
  { v: 'bundle_price',        label: 'Bundle Price' },
  { v: 'flash_sale',          label: 'Flash Sale' },
]

const STATUS_COLOR = {
  draft:            'default',
  pending_approval: 'warning',
  approved:         'info',
  active:           'success',
  paused:           'warning',
  expired:          'default',
}

const STATUS_ICON = {
  draft:            Clock,
  pending_approval: AlertTriangle,
  approved:         CheckCircle,
  active:           PlayCircle,
  paused:           PauseCircle,
  expired:          Clock,
}

// ── Schema ────────────────────────────────────────────────────────────────────
const promotionSchema = z.object({
  name:         z.string().min(3, 'Name required (min 3 chars)'),
  type:         z.string().min(1, 'Select a promotion type'),
  value:        z.coerce.number().min(0, 'Value required'),
  scope:        z.string().min(1, 'Select scope'),
  start_date:   z.string().optional().or(z.literal('')),
  end_date:     z.string().optional().or(z.literal('')),
  usage_limit:  z.coerce.number().optional().nullable(),
  is_stackable: z.boolean().optional(),
  priority:     z.coerce.number().min(0).optional(),
})

const couponSchema = z.object({
  count:      z.coerce.number().min(1, 'Min 1').max(1000, 'Max 1000'),
  max_uses:   z.coerce.number().min(1).optional(),
  expires_at: z.string().optional().or(z.literal('')),
})

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const Icon  = STATUS_ICON[status] ?? Clock
  const color = STATUS_COLOR[status] ?? 'default'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Badge color={color}>
        <Icon size={10} style={{ marginRight: 3 }} />
        {status?.replace('_', ' ')}
      </Badge>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CouponsTab — shows active promotions and lets you generate coupons for each
// ─────────────────────────────────────────────────────────────────────────────
function CouponsTab({ promotions, loading, onGenerate }) {
  const activePromos = (promotions ?? []).filter(p => p.status === 'active')
  const allPromos    = promotions ?? []

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div style={{ color: '#8A9AB5' }}>Loading…</div></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Active Promotions', value: activePromos.length, color: '#1A6E3A' },
          { label: 'Total Promotions',  value: allPromos.length,    color: '#1A3FA6' },
          { label: 'Coupon-Eligible',   value: activePromos.length, color: '#5B3FA6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5EBF2', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {activePromos.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#8A9AB5', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #D5DFE9' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎟️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#3A4A5C', marginBottom: 6 }}>No active promotions</div>
          <div style={{ fontSize: 13 }}>Activate a promotion first, then generate coupon codes for it here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A' }}>Active Promotions — Generate Coupons</div>
          {activePromos.map(promo => {
            const isPercent = promo.type === 'percentage_discount' || promo.type === 'flash_sale'
            return (
              <div key={promo.id} style={{ background: '#fff', border: '1px solid #E5EBF2', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EAF5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎟️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1C2B3A', fontSize: 14 }}>{promo.name}</div>
                  <div style={{ fontSize: 12, color: '#8A9AB5', marginTop: 2 }}>
                    {isPercent ? `${promo.value}% off` : `₦${promo.value} off`} ·
                    Used {promo.used_count ?? 0}{promo.usage_limit ? ` / ${promo.usage_limit}` : ''} times
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#EAF5EE', color: '#1A6E3A', flexShrink: 0 }}>
                  Active
                </div>
                <button onClick={() => onGenerate(promo)}
                  style={{ padding: '8px 18px', background: '#0A1628', color: '#E8A020', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  🎟️ Generate Codes
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* All promotions reference */}
      <div style={{ fontSize: 12, color: '#8A9AB5', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F0F4F8' }}>
        <strong>Tip:</strong> Only <strong>Active</strong> promotions can have coupon codes generated.
        To activate a promotion, go to the <strong>All Promotions</strong> tab, click Activate on an Approved promotion.
      </div>
    </div>
  )
}

export function PromotionsPage({ view = 'list' }) {
  // Auto-open the correct modal based on route/view prop
  const [_autoOpened, setAutoOpened] = React.useState(false)
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [search, setSearch]       = useState('')
  const [dSearch]                 = useDebounce(search, 300)
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]           = useState(1)
  const [createModal, setCreate]  = useState(false)
  const [editTarget, setEdit]     = useState(null)
  const [deleteTarget, setDelete] = useState(null)
  const [couponTarget, setCoupon] = useState(null)
  const [viewTarget, setView]     = useState(null)

  // Auto-open modal based on route prop
  // Tab for coupons sub-view
  const [activeTab, setActiveTab] = useState(view === 'coupons' ? 'coupons' : 'promotions')

  useEffect(() => {
    if (view === 'create') { setCreate(true) }
    if (view === 'coupons') { setActiveTab('coupons') }
    if (view === 'list') { setActiveTab('promotions') }
  }, [view])

  // ── Queries ────────────────────────────────────────────────────────────────
  const promotionsQ = useQuery({
    queryKey: ['promotions', { q: dSearch, status: statusFilter, page }],
    queryFn: async () => {
      const res = await api.get('/promotions', {
        params: { search: dSearch || undefined, status: statusFilter || undefined, page, per_page: 15 },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const productsQ = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 120_000,
    enabled: createModal || Boolean(editTarget),
  })

  // ── Create form ────────────────────────────────────────────────────────────
  const createForm = useForm({
    resolver: zodResolver(promotionSchema),
    defaultValues: { name: '', type: '', value: '', scope: 'all', start_date: '', end_date: '', usage_limit: '', is_stackable: false, priority: 0 },
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/promotions', d),
    onSuccess: () => {
      toast.success('Promotion submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['approval-count'] })
      createForm.reset(); setCreate(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to create promotion'),
  })

  // ── Pause/Activate mutations ───────────────────────────────────────────────
  const pauseMut = useMutation({
    mutationFn: id => api.patch(`/promotions/${id}/pause`),
    onSuccess: () => { toast.success('Promotion paused'); queryClient.invalidateQueries({ queryKey: ['promotions'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to pause'),
  })

  const activateMut = useMutation({
    mutationFn: id => api.patch(`/promotions/${id}/activate`),
    onSuccess: () => { toast.success('Promotion activated'); queryClient.invalidateQueries({ queryKey: ['promotions'] }) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to activate'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/promotions/${id}`),
    onSuccess: () => { toast.success('Promotion deleted'); queryClient.invalidateQueries({ queryKey: ['promotions'] }); setDelete(null) },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
  })

  // ── Coupon generation ──────────────────────────────────────────────────────
  const couponForm = useForm({ resolver: zodResolver(couponSchema), defaultValues: { count: 10, max_uses: 1, expires_at: '' } })

  const couponMut = useMutation({
    mutationFn: ({ id, data }) => api.post(`/promotions/${id}/coupons/generate`, data),
    onSuccess: (res) => {
      toast.success(`Generated ${res.data?.data?.generated ?? '?'} coupon codes`)
      couponForm.reset(); setCoupon(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Coupon generation failed'),
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const promotions = promotionsQ.data?.data ?? []
  const meta       = promotionsQ.data?.meta

  const activeCount   = promotions.filter(p => p.status === 'active').length
  const pendingCount  = promotions.filter(p => p.status === 'pending_approval').length
  const expiredCount  = promotions.filter(p => p.status === 'expired').length

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      header: 'Promotion', cell: r => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 2 }}>
            {PROMOTION_TYPES.find(t => t.v === r.type)?.label ?? r.type}
            {r.scope !== 'all' ? ` · ${r.scope}` : ' · All products'}
          </div>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Discount', cell: r => (
        <span style={{ fontWeight: 700, color: '#1A6E3A', fontSize: 14 }}>
          {r.type === 'percentage_discount' || r.type === 'flash_sale' ? `${r.value}%` : money(r.value)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status', cell: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'dates',
      header: 'Date Range', cell: r => (
        <div style={{ fontSize: 12, color: '#6B7A8D' }}>
          {r.start_date ? format(new Date(r.start_date), 'd MMM') : 'Any'}
          {' → '}
          {r.end_date ? format(new Date(r.end_date), 'd MMM yyyy') : 'No end'}
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage', cell: r => (
        <div style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 700 }}>{r.used_count ?? 0}</span>
          {r.usage_limit ? <span style={{ color: '#8A9AB5' }}> / {r.usage_limit}</span> : <span style={{ color: '#8A9AB5' }}> (unlimited)</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '', cell: r => isAdminLike ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {r.status === 'active' && (
            <Btn size="sm" variant="ghost" onClick={() => pauseMut.mutate(r.id)} disabled={pauseMut.isPending}>
              <PauseCircle size={12} /> Pause
            </Btn>
          )}
          {r.status === 'approved' && (
            <Btn size="sm" onClick={() => activateMut.mutate(r.id)} disabled={activateMut.isPending}>
              <PlayCircle size={12} /> Activate
            </Btn>
          )}
          {r.status === 'active' && (
            <Btn size="sm" variant="ghost" onClick={() => setCoupon(r)}>
              <Ticket size={12} /> Coupons
            </Btn>
          )}
          {['draft', 'paused'].includes(r.status) && (
            <>
              <Btn size="sm" variant="ghost" onClick={() => setEdit(r)}>
                <Pencil size={12} />
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => setDelete(r)}>
                <Trash2 size={12} />
              </Btn>
            </>
          )}
        </div>
      ) : null,
    },
  ]

  // ── Reusable form fields ───────────────────────────────────────────────────
  function PromotionFormFields({ form, products, categories }) {
    const scope = form.watch('scope')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Promotion Name *" error={form.formState.errors.name?.message}>
          <FormInput register={form.register('name')} placeholder="e.g. Christmas Sale 20% Off" />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Type *" error={form.formState.errors.type?.message}>
            <FormSelect register={form.register('type')}>
              <option value="">Select type…</option>
              {PROMOTION_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Discount Value *" error={form.formState.errors.value?.message}>
            <FormInput register={form.register('value')} type="number" min={0} placeholder="e.g. 20" />
          </FormField>
        </div>

        <FormField label="Scope *">
          <FormSelect register={form.register('scope')}>
            <option value="all">All Products</option>
            <option value="category">By Category</option>
            <option value="product">Specific Products</option>
          </FormSelect>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Start Date">
            <FormInput register={form.register('start_date')} type="date" />
          </FormField>
          <FormField label="End Date">
            <FormInput register={form.register('end_date')} type="date" />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Usage Limit (blank = unlimited)">
            <FormInput register={form.register('usage_limit')} type="number" min={1} placeholder="Unlimited" />
          </FormField>
          <FormField label="Priority (higher = applied first)">
            <FormInput register={form.register('priority')} type="number" min={0} placeholder="0" />
          </FormField>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="stackable" {...form.register('is_stackable')} />
          <label htmlFor="stackable" style={{ fontSize: 13, color: '#3A4A5C', cursor: 'pointer' }}>
            Stackable — can combine with other active promotions
          </label>
        </div>

        <div style={{ background: '#EAF0FB', border: '1px solid #B8CFF5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1A3FA6' }}>
          📋 This promotion will be submitted for approval via the <strong>Approval Workflow Engine</strong> before going live.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Promotions & Coupons"
        subtitle="Create discount promotions and coupon campaigns. All promotions route through the approval engine before going live at POS."
        action={isAdminLike ? <Btn onClick={() => setCreate(true)}><Plus size={14} /> New Promotion</Btn> : undefined}
      />

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1.5px solid #E5EBF2' }}>
        {[
          { id: 'promotions', label: '📋 All Promotions' },
          { id: 'coupons',    label: '🎟️ Coupons' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === t.id ? '2px solid #E8A020' : '2px solid transparent',
              color: activeTab === t.id ? '#1C2B3A' : '#8A9AB5', marginBottom: -1.5 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <StatCard label="Total Promotions"   value={meta?.total ?? '—'}  accent="#1A3FA6" />
        <StatCard label="Active Now"          value={activeCount}          accent="#1A6E3A" />
        <StatCard label="Pending Approval"    value={pendingCount}         accent="#C45A00" />
        <StatCard label="Expired"             value={expiredCount}         accent="#8A9AB5" />
      </div>

      {/* ── PROMOTIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'promotions' && (<>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }}
          placeholder="Search promotions…"
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: '',                label: 'All' },
            { v: 'active',          label: 'Active' },
            { v: 'pending_approval',label: 'Pending' },
            { v: 'approved',        label: 'Approved' },
            { v: 'paused',          label: 'Paused' },
            { v: 'expired',         label: 'Expired' },
          ].map(f => (
            <button key={f.v} onClick={() => { setStatus(f.v); setPage(1) }}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                borderColor: statusFilter === f.v ? 'var(--edlp-primary)' : '#E5EBF2',
                background: statusFilter === f.v ? 'rgba(232,160,32,0.08)' : '#fff',
                color: statusFilter === f.v ? '#C98516' : '#8A9AB5',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <DataTable
          columns={columns}
          rows={promotions}
          rowKey="id"
          loading={promotionsQ.isLoading}
          emptyMessage="No promotions found. Create one to get started."
          onRowClick={r => setView(r)}
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      </>)} {/* end activeTab === 'promotions' */}

      {/* ── COUPONS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'coupons' && (
        <CouponsTab
          promotions={promotions}
          loading={promotionsQ.isLoading}
          onGenerate={(promo) => setCoupon(promo)}
        />
      )}

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => { setCreate(false); createForm.reset() }}
        title="New Promotion" width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setCreate(false); createForm.reset() }}>Cancel</Btn>
            <Btn onClick={createForm.handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Submitting…</> : 'Submit for Approval'}
            </Btn>
          </div>
        }
      >
        <PromotionFormFields form={createForm} products={productsQ.data ?? []} categories={categoriesQ.data ?? []} />
      </Modal>

      {/* Coupon Generation Modal */}
      <Modal open={Boolean(couponTarget)} onClose={() => { setCoupon(null); couponForm.reset() }}
        title={`Generate Coupons — ${couponTarget?.name ?? ''}`} width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setCoupon(null); couponForm.reset() }}>Cancel</Btn>
            <Btn onClick={couponForm.handleSubmit(d => couponMut.mutate({ id: couponTarget.id, data: d }))} disabled={couponMut.isPending}>
              {couponMut.isPending ? <><Spinner size={12} /> Generating…</> : <><Ticket size={13} /> Generate Codes</>}
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#EAF5EE', border: '1px solid #A8D5B8', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1A6E3A' }}>
            <strong>{couponTarget?.name}</strong> · {couponTarget?.type?.replace('_', ' ')} · {couponTarget?.type === 'percentage_discount' ? `${couponTarget?.value}%` : money(couponTarget?.value ?? 0)} off
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="Number to Generate *" error={couponForm.formState.errors.count?.message}>
              <FormInput register={couponForm.register('count')} type="number" min={1} max={1000} placeholder="e.g. 50" />
            </FormField>
            <FormField label="Max Uses Per Code">
              <FormInput register={couponForm.register('max_uses')} type="number" min={1} placeholder="1" />
            </FormField>
          </div>
          <FormField label="Expiry Date (optional)">
            <FormInput register={couponForm.register('expires_at')} type="date" />
          </FormField>
          <div style={{ fontSize: 12, color: '#8A9AB5' }}>
            Codes are auto-generated in format <code style={{ background: '#F0F4F8', padding: '1px 5px', borderRadius: 3 }}>XXX-XXXX-XXX</code>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Promotion"
        message={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDelete(null)}
      />

      {/* View Detail Modal */}
      {viewTarget && (
        <Modal open={Boolean(viewTarget)} onClose={() => setView(null)} title={viewTarget.name} width={500}
          footer={<Btn variant="ghost" onClick={() => setView(null)}>Close</Btn>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Type',    value: PROMOTION_TYPES.find(t => t.v === viewTarget.type)?.label ?? viewTarget.type },
                { label: 'Value',   value: viewTarget.type === 'percentage_discount' ? `${viewTarget.value}%` : money(viewTarget.value) },
                { label: 'Status',  value: viewTarget.status },
                { label: 'Scope',   value: viewTarget.scope },
                { label: 'Start',   value: viewTarget.start_date ? format(new Date(viewTarget.start_date), 'd MMM yyyy') : 'Any time' },
                { label: 'End',     value: viewTarget.end_date ? format(new Date(viewTarget.end_date), 'd MMM yyyy') : 'No end' },
                { label: 'Usage',   value: `${viewTarget.used_count ?? 0} / ${viewTarget.usage_limit ?? '∞'}` },
                { label: 'Priority', value: viewTarget.priority ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F6F8FB', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B3A' }}>{value}</div>
                </div>
              ))}
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
