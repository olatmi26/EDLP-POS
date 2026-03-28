import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { ClipboardList, Plus, Eye, CheckCircle, PackageCheck, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'

import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

const PO_STATUS_COLORS = {
  pending:  'warning',
  approved: 'info',
  received: 'success',
  cancelled:'danger',
}

const poSchema = z.object({
  supplier_id:            z.coerce.number().min(1, 'Select a supplier'),
  expected_delivery_date: z.string().optional().or(z.literal('')),
  notes:                  z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    product_id:      z.coerce.number().min(1, 'Select a product'),
    quantity_ordered: z.coerce.number().min(1, 'Min 1'),
    unit_cost:       z.coerce.number().min(0, 'Required'),
  })).min(1, 'Add at least one item'),
})

export function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]             = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewPO, setViewPO]         = useState(null)
  const [approvePO, setApprovePO]   = useState(null)
  const [receiveOpen, setReceiveOpen] = useState(false)

  // ── Data fetches ──────────────────────────────────────────
  const posQuery = useQuery({
    queryKey: ['purchase-orders', { q: debouncedSearch, status: statusFilter, page }],
    queryFn: async () => {
      const res = await api.get('/purchase-orders', {
        params: { search: debouncedSearch || undefined, status: statusFilter || undefined, page, per_page: 15 },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { all: true, per_page: 200 } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'simple'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page: 300 } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const pos      = posQuery.data?.data ?? []
  const meta     = posQuery.data?.meta
  const suppliers = suppliersQuery.data ?? []
  const products  = productsQuery.data ?? []

  // ── Form ──────────────────────────────────────────────────
  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(poSchema),
    defaultValues: { supplier_id: '', expected_delivery_date: '', notes: '', items: [{ product_id: '', quantity_ordered: 1, unit_cost: '' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty  = Number(item.quantity_ordered) || 0
    const cost = Number(item.unit_cost) || 0
    return sum + qty * cost
  }, 0)

  // ── Mutations ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/purchase-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created')
      setCreateOpen(false)
      reset()
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to create PO'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => api.patch(`/purchase-orders/${id}/approve`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order approved')
      setApprovePO(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to approve'),
  })

  // ── Table columns ─────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'po_number',
      header: 'PO Number',
      cell: (po) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1A3FA6', fontSize: 13, fontFamily: 'monospace' }}>{po.po_number}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>{po.created_at ? format(new Date(po.created_at), 'dd MMM yyyy') : '—'}</div>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (po) => <span style={{ fontSize: 13, color: '#3A4A5C' }}>{po.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'items_count',
      header: 'Items',
      cell: (po) => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{po.items_count ?? po.items?.length ?? '—'} items</span>,
    },
    {
      key: 'total_amount',
      header: 'Total',
      cell: (po) => <span style={{ fontWeight: 700, fontSize: 13, color: '#1C2B3A' }}>{money(po.total_amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (po) => <Badge color={PO_STATUS_COLORS[po.status] ?? 'default'}>{po.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (po) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="View" onClick={(e) => { e.stopPropagation(); setViewPO(po) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1A3FA6'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Eye size={14} /></button>
          {po.status === 'pending' && isAdminLike && (
            <button title="Approve" onClick={(e) => { e.stopPropagation(); setApprovePO(po) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => e.currentTarget.style.color = '#1A6E3A'}
              onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
            ><CheckCircle size={14} /></button>
          )}
          {po.status === 'approved' && isAdminLike && (
            <button title="Mark Received" onClick={(e) => { e.stopPropagation(); setViewPO(po); setReceiveOpen(true) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => e.currentTarget.style.color = '#C45A00'}
              onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
            ><PackageCheck size={14} /></button>
          )}
        </div>
      ),
    },
  ], [isAdminLike])

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Create and track supplier purchase orders."
        actions={<Btn icon={Plus} onClick={() => { reset(); setCreateOpen(true) }}>Create PO</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total POs" value={meta?.total ?? '—'} icon={ClipboardList} />
        <StatCard label="Pending" value={pos.filter(p => p.status === 'pending').length} icon={ClipboardList} accent="#C45A00" />
        <StatCard label="Approved" value={pos.filter(p => p.status === 'approved').length} icon={ClipboardList} accent="#1A3FA6" />
        <StatCard label="Received" value={pos.filter(p => p.status === 'received').length} icon={ClipboardList} accent="#1A6E3A" />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search PO number or supplier…" style={{ flex: 1, minWidth: 220 }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', color: '#3A4A5C', cursor: 'pointer' }}>
            <option value="">All Status</option>
            {['pending','approved','received','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={pos}
          rowKey={(p) => p.id}
          loading={posQuery.isLoading}
          emptyMessage="No purchase orders found."
          onRowClick={(po) => setViewPO(po)}
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* Create PO Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Purchase Order"
        width={680}
        footer={<>
          <Btn variant="ghost" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => createMutation.mutate(d))} disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? <><Spinner size={12} /> Creating…</> : 'Create Purchase Order'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Supplier" required error={errors.supplier_id?.message}>
              <FormSelect register={register('supplier_id')} error={errors.supplier_id}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Expected Delivery Date">
              <FormInput register={register('expected_delivery_date')} type="date" />
            </FormField>
          </div>

          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Order Items</div>
              <Btn variant="ghost" size="sm" icon={Plus} onClick={() => append({ product_id: '', quantity_ordered: 1, unit_cost: '' })}>Add Item</Btn>
            </div>

            {fields.map((field, idx) => (
              <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                <FormField label={idx === 0 ? 'Product' : ''} error={errors.items?.[idx]?.product_id?.message}>
                  <FormSelect register={register(`items.${idx}.product_id`)} error={errors.items?.[idx]?.product_id}>
                    <option value="">Select product…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </FormSelect>
                </FormField>
                <FormField label={idx === 0 ? 'Qty' : ''} error={errors.items?.[idx]?.quantity_ordered?.message}>
                  <FormInput register={register(`items.${idx}.quantity_ordered`)} type="number" min={1} />
                </FormField>
                <FormField label={idx === 0 ? 'Unit Cost (₦)' : ''} error={errors.items?.[idx]?.unit_cost?.message}>
                  <FormInput register={register(`items.${idx}.unit_cost`)} type="number" step="0.01" placeholder="0.00" />
                </FormField>
                <div style={{ paddingBottom: errors.items?.[idx] ? 20 : 0 }}>
                  <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', padding: '8px 4px', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}

            {errors.items?.root && <div style={{ fontSize: 11, color: '#C0392B' }}>{errors.items.root.message}</div>}
          </div>

          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0', borderTop: '1px solid #F0F4F8' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Subtotal</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C2B3A' }}>{money(subtotal)}</div>
            </div>
          </div>

          <FormField label="Notes">
            <textarea {...register('notes')} rows={2} placeholder="Any notes for this purchase order…"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = 'var(--edlp-primary)'}
              onBlur={e => e.target.style.borderColor = '#D5DFE9'}
            />
          </FormField>
        </form>
      </Modal>

      {/* View PO Modal */}
      <Modal open={Boolean(viewPO) && !receiveOpen} onClose={() => setViewPO(null)} title={`PO: ${viewPO?.po_number}`} width={600}>
        {viewPO && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={{ fontSize: 11, color: '#8A9AB5' }}>Supplier</div><div style={{ fontWeight: 600 }}>{viewPO.supplier?.name}</div></div>
              <div><div style={{ fontSize: 11, color: '#8A9AB5' }}>Status</div><Badge color={PO_STATUS_COLORS[viewPO.status]}>{viewPO.status}</Badge></div>
              <div><div style={{ fontSize: 11, color: '#8A9AB5' }}>Created</div><div>{viewPO.created_at ? format(new Date(viewPO.created_at), 'dd MMM yyyy') : '—'}</div></div>
              <div><div style={{ fontSize: 11, color: '#8A9AB5' }}>Total</div><div style={{ fontWeight: 700, fontSize: 16 }}>{money(viewPO.total_amount)}</div></div>
            </div>
            <div style={{ borderTop: '1px solid #F0F4F8', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Items</div>
              {(viewPO.items ?? []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F6F8FB', fontSize: 13, color: '#3A4A5C' }}>
                  <span>{item.product?.name ?? `Product #${item.product_id}`}</span>
                  <span style={{ color: '#8A9AB5' }}>×{item.quantity_ordered} @ {money(item.unit_cost)}</span>
                  <span style={{ fontWeight: 600 }}>{money(item.line_total)}</span>
                </div>
              ))}
            </div>
            {viewPO.notes && <div style={{ fontSize: 12, color: '#6B7A8D', background: '#F6F8FB', borderRadius: 8, padding: '10px 12px' }}>{viewPO.notes}</div>}
          </div>
        )}
      </Modal>

      {/* Approve confirm */}
      <ConfirmDialog
        open={Boolean(approvePO)}
        onClose={() => setApprovePO(null)}
        onConfirm={() => approveMutation.mutate({ id: approvePO?.id, notes: '' })}
        loading={approveMutation.isPending}
        title="Approve Purchase Order"
        message={`Approve PO ${approvePO?.po_number} for ${money(approvePO?.total_amount)}? This will allow the order to be received and inventory updated.`}
        confirmLabel="Approve Order"
      />
    </div>
  )
}
