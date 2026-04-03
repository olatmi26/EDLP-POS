import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ClipboardList, Plus, Eye, CheckCircle, PackageCheck, X, Building2, Truck, Hash } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect,
  Spinner, StatCard,
} from '../components/shared'

const STATUS_COLOR = { pending:'warning', approved:'info', received:'success', cancelled:'danger' }
const TOTAL_TAX_RATE = 0.075

const poSchema = z.object({
  supplier_id:            z.coerce.number().min(1, 'Select a supplier'),
  expected_delivery_date: z.string().optional().or(z.literal('')),
  notes:                  z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    product_id:       z.coerce.number().min(1, 'Select product'),
    quantity_ordered: z.coerce.number().min(1, 'Min 1'),
    unit_cost:        z.coerce.number().min(0, 'Required'),
  })).min(1, 'Add at least one line item'),
})

export function PurchaseOrdersPage({ autoCreate = false }) {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]             = useState('')
  const [debouncedSearch]               = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]                 = useState(1)
  const [createOpen, setCreateOpen]     = useState(false)
  const [viewPO, setViewPO]             = useState(null)
  const [approvePO, setApprovePO]       = useState(null)
  const [receivePO, setReceivePO]       = useState(null)

  // Auto-open create modal when navigated from flyout /purchase-orders/create
  useEffect(() => {
    if (autoCreate) {
      setTimeout(() => setCreateOpen(true), 100)
    }
  }, [autoCreate])

  const posQuery = useQuery({
    queryKey: ['purchase-orders', { q: debouncedSearch, status: statusFilter, page }],
    queryFn: async () => {
      const res = await api.get('/purchase-orders', {
        params: { search: debouncedSearch||undefined, status: statusFilter||undefined, page, per_page:15 },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers','all'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { per_page:200 } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products','simple'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page:500 } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
    enabled: createOpen,
  })

  const pos      = posQuery.data?.data ?? []
  const meta     = posQuery.data?.meta
  const suppliers = suppliersQuery.data ?? []
  const products  = productsQuery.data ?? []

  // ── Form ──────────────────────────────────────────────────────────────────
  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(poSchema),
    defaultValues: { supplier_id:'', expected_delivery_date:'', notes:'', items:[{ product_id:'', quantity_ordered:1, unit_cost:'' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name:'items' })
  const watchedItems = watch('items') ?? []

  // Auto-fill cost price when product selected
  function onProductSelect(idx, productId) {
    const product = products.find(p => p.id === Number(productId))
    if (product?.cost_price) setValue(`items.${idx}.unit_cost`, product.cost_price)
  }

  const subtotal   = watchedItems.reduce((s,i) => s + (Number(i.quantity_ordered)||0) * (Number(i.unit_cost)||0), 0)
  const taxAmount  = Math.round(subtotal * TOTAL_TAX_RATE * 100) / 100
  const grandTotal = subtotal + taxAmount

  const createMutation = useMutation({
    mutationFn: (d) => {
      // Coerce empty date string to null before sending
      const payload = { ...d }
      if (!payload.expected_delivery_date) payload.expected_delivery_date = null
      return api.post('/purchase-orders', payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['purchase-orders'] }); toast.success('Purchase order created'); setCreateOpen(false); reset() },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to create PO'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => api.patch(`/purchase-orders/${id}/approve`, { notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['purchase-orders'] }); toast.success('Purchase order approved'); setApprovePO(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const receiveMutation = useMutation({
    mutationFn: ({ id, notes }) => api.patch(`/purchase-orders/${id}/receive`, { notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['purchase-orders'] }); toast.success('Stock received and inventory updated'); setReceivePO(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const columns = useMemo(() => [
    { key:'po_number', header:'PO Number', cell:(po) => (
      <div>
        <div style={{ fontWeight:700,color:'#1A3FA6',fontSize:13,fontFamily:'monospace' }}>{po.po_number}</div>
        <div style={{ fontSize:11,color:'#8A9AB5' }}>{po.created_at ? format(new Date(po.created_at),'dd MMM yyyy') : '—'}</div>
      </div>
    )},
    { key:'supplier', header:'Supplier', cell:(po) => <span style={{ fontSize:13,color:'#3A4A5C' }}>{po.supplier?.name ?? '—'}</span> },
    { key:'branch',   header:'Branch',   cell:(po) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{po.branch?.name ?? '—'}</span> },
    { key:'items',    header:'Items',    cell:(po) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{po.items_count ?? po.items?.length ?? '—'} lines</span> },
    { key:'total',    header:'Total',    cell:(po) => <span style={{ fontWeight:700,fontSize:13,color:'#1C2B3A' }}>{money(po.total_amount)}</span> },
    { key:'status',   header:'Status',   cell:(po) => <Badge color={STATUS_COLOR[po.status] ?? 'default'}>{po.status}</Badge> },
    { key:'actions',  header:'', align:'right', cell:(po) => (
      <div style={{ display:'flex',gap:4,justifyContent:'flex-end' }}>
        <button title="View" onClick={(e) => { e.stopPropagation(); setViewPO(po) }}
          style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
          onMouseEnter={ev=>ev.currentTarget.style.color='#1A3FA6'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
        ><Eye size={14}/></button>
        {po.status === 'pending' && isAdminLike && (
          <button title="Approve" onClick={(e) => { e.stopPropagation(); setApprovePO(po) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
            onMouseEnter={ev=>ev.currentTarget.style.color='#1A6E3A'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
          ><CheckCircle size={14}/></button>
        )}
        {po.status === 'approved' && isAdminLike && (
          <button title="Mark Received" onClick={(e) => { e.stopPropagation(); setReceivePO(po) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
            onMouseEnter={ev=>ev.currentTarget.style.color='#C45A00'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
          ><PackageCheck size={14}/></button>
        )}
      </div>
    )},
  ], [isAdminLike])

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Create, approve and receive supplier purchase orders."
        actions={<Btn icon={Plus} onClick={() => { reset(); setCreateOpen(true) }}>Create PO</Btn>}
      />

      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20 }}>
        <StatCard label="Total POs"  value={meta?.total ?? '—'} icon={ClipboardList} />
        <StatCard label="Pending"    value={pos.filter(p=>p.status==='pending').length}  icon={ClipboardList} accent="#C45A00" />
        <StatCard label="Approved"   value={pos.filter(p=>p.status==='approved').length} icon={ClipboardList} accent="#1A3FA6" />
        <StatCard label="Received"   value={pos.filter(p=>p.status==='received').length} icon={ClipboardList} accent="#1A6E3A" />
      </div>

      <Card>
        <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search PO number or supplier…" style={{ flex:1,minWidth:200 }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ fontSize:12,padding:'8px 12px',border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C',cursor:'pointer',background:'#fff' }}>
            <option value="">All Status</option>
            {['pending','approved','received','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <DataTable columns={columns} rows={pos} rowKey={(p)=>p.id} loading={posQuery.isLoading}
          emptyMessage="No purchase orders found."
          onRowClick={setViewPO}
          pagination={meta ? { current:meta.current_page,last:meta.last_page,total:meta.total,onPage:setPage } : undefined}
        />
      </Card>

      {/* ── Create PO Modal — XL professional design ─────────────────────── */}
      {createOpen && (
        <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(10,22,40,0.65)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',overflowY:'auto' }}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:860,boxShadow:'0 24px 80px rgba(0,0,0,0.22)',marginTop:20,marginBottom:20 }}>

            {/* Header */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 28px',borderBottom:'1px solid #F0F4F8' }}>
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ width:40,height:40,borderRadius:10,background:'rgba(232,160,32,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <ClipboardList size={20} color="#C98516" />
                </div>
                <div>
                  <h2 style={{ margin:0,fontSize:18,fontWeight:700,color:'#1C2B3A' }}>Create Purchase Order</h2>
                  <p style={{ margin:0,fontSize:12,color:'#8A9AB5' }}>New supplier stock request</p>
                </div>
              </div>
              <button onClick={() => setCreateOpen(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:6,borderRadius:8,display:'flex' }}>
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>

                {/* Left column — supplier + delivery */}
                <div style={{ padding:'24px 28px',borderRight:'1px solid #F0F4F8' }}>
                  <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:14,display:'flex',alignItems:'center',gap:6 }}>
                    <Truck size={12}/> Supplier Details
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                    <FormField label="Supplier" required error={errors.supplier_id?.message}>
                      <FormSelect register={register('supplier_id')} error={errors.supplier_id}>
                        <option value="">Select supplier…</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </FormSelect>
                    </FormField>
                    <FormField label="Expected Delivery Date">
                      <FormInput register={register('expected_delivery_date')} type="date" />
                    </FormField>
                    <FormField label="Notes / Special Instructions">
                      <textarea {...register('notes')} rows={4} placeholder="Any notes for this order…"
                        style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'none' }}
                        onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'}
                        onBlur={e=>e.target.style.borderColor='#D5DFE9'}
                      />
                    </FormField>
                  </div>
                </div>

                {/* Right column — summary */}
                <div style={{ padding:'24px 28px' }}>
                  <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:14,display:'flex',alignItems:'center',gap:6 }}>
                    <Hash size={12}/> Order Summary
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                    {[
                      { label:'Subtotal',   value:money(subtotal)   },
                      { label:'VAT (7.5%)', value:money(taxAmount)  },
                    ].map(row => (
                      <div key={row.label} style={{ display:'flex',justifyContent:'space-between',fontSize:13,color:'#6B7A8D' }}>
                        <span>{row.label}</span><span style={{ fontWeight:600 }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ height:1,background:'#F0F4F8',margin:'4px 0' }} />
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700,color:'#1C2B3A' }}>
                      <span>Grand Total</span><span style={{ color:'#E8A020' }}>{money(grandTotal)}</span>
                    </div>
                    <div style={{ padding:'10px 12px',background:'#F6F8FB',borderRadius:8,fontSize:11,color:'#8A9AB5',marginTop:4 }}>
                      {fields.length} line item{fields.length !== 1 ? 's' : ''}
                      {fields.length > 0 && ` · ${watchedItems.reduce((s,i) => s + (Number(i.quantity_ordered)||0), 0)} units total`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Line items — full width */}
              <div style={{ padding:'0 28px 24px',borderTop:'1px solid #F0F4F8' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 0 14px' }}>
                  <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.07em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6 }}>
                    <ClipboardList size={12}/> Line Items
                  </div>
                  <Btn variant="secondary" size="sm" icon={Plus}
                    onClick={() => append({ product_id:'', quantity_ordered:1, unit_cost:'' })}>
                    Add Line
                  </Btn>
                </div>

                {/* Column headers */}
                <div style={{ display:'grid',gridTemplateColumns:'1fr 100px 120px 110px 28px',gap:8,padding:'6px 0',borderBottom:'1px solid #F0F4F8',marginBottom:8 }}>
                  {['Product','Quantity','Unit Cost (₦)','Line Total',''].map(h => (
                    <div key={h} style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.04em',textTransform:'uppercase' }}>{h}</div>
                  ))}
                </div>

                {/* Scrollable item list */}
                <div style={{ maxHeight:300,overflowY:'auto',paddingRight:4 }}>
                  {fields.map((field, idx) => {
                    const qty  = Number(watchedItems[idx]?.quantity_ordered) || 0
                    const cost = Number(watchedItems[idx]?.unit_cost) || 0
                    return (
                      <div key={field.id} style={{ display:'grid',gridTemplateColumns:'1fr 100px 120px 110px 28px',gap:8,alignItems:'center',marginBottom:8 }}>
                        <FormSelect
                          register={register(`items.${idx}.product_id`, { required:true })}
                          error={errors.items?.[idx]?.product_id}
                          onChange={(e) => { register(`items.${idx}.product_id`).onChange(e); onProductSelect(idx, e.target.value) }}
                        >
                          <option value="">Select product…</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </FormSelect>
                        <FormInput register={register(`items.${idx}.quantity_ordered`)} type="number" min={1} />
                        <FormInput register={register(`items.${idx}.unit_cost`)} type="number" step="0.01" placeholder="0.00" />
                        <div style={{ fontSize:13,fontWeight:700,color:'#1C2B3A',textAlign:'right',padding:'0 4px' }}>
                          {qty && cost ? money(qty * cost) : '—'}
                        </div>
                        <button type="button" onClick={() => remove(idx)}
                          style={{ background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center' }}>
                          <X size={13}/>
                        </button>
                      </div>
                    )
                  })}
                  {errors.items?.root && <div style={{ fontSize:11,color:'#C0392B',padding:'4px 0' }}>{errors.items.root.message}</div>}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'flex-end',gap:10,padding:'16px 28px',borderTop:'1px solid #F0F4F8',background:'#FAFCFF',borderRadius:'0 0 16px 16px' }}>
                <Btn variant="ghost" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Cancel</Btn>
                <Btn type="submit" disabled={isSubmitting || createMutation.isPending}>
                  {createMutation.isPending ? <><Spinner size={12}/> Creating…</> : `Create Purchase Order — ${money(grandTotal)}`}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View PO Modal */}
      <Modal open={Boolean(viewPO) && !approvePO && !receivePO} onClose={() => setViewPO(null)} title={`PO: ${viewPO?.po_number}`} width={620}>
        {viewPO && (
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'14px',background:'#F6F8FB',borderRadius:10 }}>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Supplier</div><div style={{ fontWeight:600,fontSize:13 }}>{viewPO.supplier?.name}</div></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Branch</div><div style={{ fontSize:13 }}>{viewPO.branch?.name}</div></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Status</div><Badge color={STATUS_COLOR[viewPO.status]}>{viewPO.status}</Badge></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Total</div><div style={{ fontWeight:700,fontSize:18,color:'#E8A020' }}>{money(viewPO.total_amount)}</div></div>
            </div>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10 }}>Items</div>
              {(viewPO.items ?? []).map((item,i) => (
                <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #F6F8FB',fontSize:13 }}>
                  <span style={{ color:'#3A4A5C' }}>{item.product?.name ?? `#${item.product_id}`}</span>
                  <span style={{ color:'#8A9AB5' }}>×{item.quantity_ordered} @ {money(item.unit_cost)}</span>
                  <span style={{ fontWeight:700 }}>{money(item.line_total)}</span>
                </div>
              ))}
            </div>
            {viewPO.notes && <div style={{ fontSize:12,color:'#6B7A8D',background:'#F6F8FB',borderRadius:8,padding:'10px 14px' }}>{viewPO.notes}</div>}
            {viewPO.status === 'pending' && isAdminLike && (
              <Btn icon={CheckCircle} onClick={() => { setViewPO(null); setApprovePO(viewPO) }}>Approve This Order</Btn>
            )}
            {viewPO.status === 'approved' && isAdminLike && (
              <Btn variant="secondary" icon={PackageCheck} onClick={() => { setViewPO(null); setReceivePO(viewPO) }}>Mark as Received</Btn>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(approvePO)} onClose={() => setApprovePO(null)}
        onConfirm={() => approveMutation.mutate({ id:approvePO?.id, notes:'' })} loading={approveMutation.isPending}
        title="Approve Purchase Order"
        message={`Approve PO ${approvePO?.po_number} for ${money(approvePO?.total_amount)}? Stock will be updated when goods are received.`}
        confirmLabel="Approve Order"
      />

      <ConfirmDialog open={Boolean(receivePO)} onClose={() => setReceivePO(null)}
        onConfirm={() => receiveMutation.mutate({ id:receivePO?.id, notes:'' })} loading={receiveMutation.isPending}
        title="Confirm Receipt"
        message={`Confirm goods received for PO ${receivePO?.po_number}? Branch inventory will be automatically updated.`}
        confirmLabel="Confirm Receipt"
      />
    </div>
  )
}
