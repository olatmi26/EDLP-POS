import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Truck, Plus, Eye, ArrowRight, Users, CreditCard, X } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

const TIER_COLOR = { gold:'warning', silver:'default', bronze:'info' }
const STATUS_COLOR = {
  draft:'default', confirmed:'info', picking:'warning',
  dispatched:'warning', delivered:'success', invoiced:'success', cancelled:'danger',
}
const PAYMENT_COLOR = { unpaid:'warning', partial:'info', paid:'success', overdue:'danger' }

const NEXT_STATUS = {
  confirmed:'picking', picking:'dispatched', dispatched:'delivered', delivered:'invoiced',
}

export function WholesalePage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('customers') // customers | orders
  const [search, setSearch]     = useState('')
  const [debouncedSearch]       = useDebounce(search, 300)
  const [page, setPage]         = useState(1)
  const [customerModal, setCustomerModal] = useState(false)
  const [editCustomer, setEditCustomer]   = useState(null)
  const [orderModal, setOrderModal]       = useState(false)
  const [viewOrder, setViewOrder]         = useState(null)

  // ── Data ────────────────────────────────────────────────────────────────
  const customersQuery = useQuery({
    queryKey: ['wholesale-customers', { q: debouncedSearch, page }],
    enabled: tab === 'customers',
    queryFn: async () => {
      const res = await api.get('/wholesale/customers', { params: { search: debouncedSearch||undefined, page, per_page:15 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const ordersQuery = useQuery({
    queryKey: ['wholesale-orders', page],
    enabled: tab === 'orders',
    queryFn: async () => {
      const res = await api.get('/wholesale/orders', { params: { page, per_page:15 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'simple'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page:300 } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
    enabled: orderModal,
  })

  const customers = customersQuery.data?.data ?? []
  const orders    = ordersQuery.data?.data ?? []
  const products  = productsQuery.data ?? []

  // ── Customer form ────────────────────────────────────────────────────────
  const custForm = useForm({ defaultValues: { business_name:'',contact_person:'',email:'',phone:'',address:'',tier:'bronze',credit_limit:0,payment_terms:'cod' } })

  function openCreateCustomer() { setEditCustomer(null); custForm.reset({ business_name:'',contact_person:'',email:'',phone:'',address:'',tier:'bronze',credit_limit:0,payment_terms:'cod' }); setCustomerModal(true) }
  function openEditCustomer(c)  { setEditCustomer(c); custForm.reset({ business_name:c.business_name,contact_person:c.contact_person??'',email:c.email??'',phone:c.phone??'',address:c.address??'',tier:c.tier,credit_limit:c.credit_limit,payment_terms:c.payment_terms }); setCustomerModal(true) }

  const saveCustomerMutation = useMutation({
    mutationFn: (d) => editCustomer ? api.put(`/wholesale/customers/${editCustomer.id}`,d) : api.post('/wholesale/customers',d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['wholesale-customers'] }); toast.success('Customer saved'); setCustomerModal(false) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Order form ────────────────────────────────────────────────────────────
  const orderForm = useForm({ defaultValues: { b2b_customer_id:'', notes:'', delivery_address:'', items:[{ product_id:'', quantity:1 }] } })
  const { fields:orderItems, append:appendItem, remove:removeItem } = useFieldArray({ control:orderForm.control, name:'items' })

  const createOrderMutation = useMutation({
    mutationFn: (d) => api.post('/wholesale/orders', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['wholesale-orders'] }); toast.success('Order created — pending approval'); setOrderModal(false); orderForm.reset() },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/wholesale/orders/${id}/advance`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['wholesale-orders'] }); toast.success('Order status updated'); setViewOrder(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Customer columns ──────────────────────────────────────────────────────
  const custCols = useMemo(() => [
    { key:'name', header:'Business', cell:(c) => (
      <div>
        <div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{c.business_name}</div>
        <div style={{ fontSize:11,color:'#8A9AB5' }}>{c.contact_person ?? c.email ?? '—'}</div>
      </div>
    )},
    { key:'tier',    header:'Tier',    cell:(c) => <Badge color={TIER_COLOR[c.tier]}>{c.tier}</Badge> },
    { key:'credit',  header:'Credit',  cell:(c) => (
      <div>
        <div style={{ fontSize:12,fontWeight:600,color:'#1C2B3A' }}>{money(c.credit_limit)}</div>
        <div style={{ fontSize:11,color: c.on_credit_hold?'#C0392B':'#8A9AB5' }}>
          {c.on_credit_hold ? '⚠ On hold' : `₦${Number(c.outstanding_balance).toLocaleString()} outstanding`}
        </div>
      </div>
    )},
    { key:'terms',   header:'Terms',   cell:(c) => <Badge color="info">{c.payment_terms}</Badge> },
    { key:'actions', header:'', align:'right', cell:(c) => (
      <div style={{ display:'flex',gap:4 }}>
        <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditCustomer(c) }}>Edit</Btn>
        <Btn size="sm" icon={Plus} onClick={(e) => { e.stopPropagation(); orderForm.setValue('b2b_customer_id', c.id); setOrderModal(true) }}>Order</Btn>
      </div>
    )},
  ], [])

  const orderCols = useMemo(() => [
    { key:'num', header:'Order', cell:(o) => <span style={{ fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#1A3FA6' }}>{o.order_number}</span> },
    { key:'customer', header:'Customer', cell:(o) => <span style={{ fontSize:13,color:'#3A4A5C' }}>{o.customer?.business_name ?? '—'}</span> },
    { key:'total', header:'Total', cell:(o) => <span style={{ fontWeight:700 }}>{money(o.total)}</span> },
    { key:'status', header:'Status', cell:(o) => <Badge color={STATUS_COLOR[o.status]}>{o.status}</Badge> },
    { key:'payment', header:'Payment', cell:(o) => <Badge color={PAYMENT_COLOR[o.payment_status]}>{o.payment_status}</Badge> },
    { key:'date', header:'Date', cell:(o) => <span style={{ fontSize:11,color:'#8A9AB5' }}>{format(new Date(o.created_at),'dd MMM yyyy')}</span> },
    { key:'actions', header:'', align:'right', cell:(o) => (
      <div style={{ display:'flex',gap:4 }}>
        <button onClick={(e) => { e.stopPropagation(); setViewOrder(o) }}
          style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
          onMouseEnter={ev=>ev.currentTarget.style.color='#1A3FA6'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
        ><Eye size={14}/></button>
        {NEXT_STATUS[o.status] && (
          <Btn size="sm" icon={ArrowRight} onClick={(e) => { e.stopPropagation(); advanceMutation.mutate({ id:o.id, status:NEXT_STATUS[o.status] }) }}>
            → {NEXT_STATUS[o.status]}
          </Btn>
        )}
      </div>
    )},
  ], [])

  return (
    <div>
      <PageHeader title="Wholesale / B2B" subtitle="Manage B2B customers, wholesale orders, and tiered pricing."
        actions={
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant="secondary" icon={Users} onClick={openCreateCustomer}>Add Customer</Btn>
            <Btn icon={Plus} onClick={() => { orderForm.reset(); setOrderModal(true) }}>New Order</Btn>
          </div>
        }
      />

      <div style={{ display:'flex',gap:2,marginBottom:20 }}>
        {[{ id:'customers',label:`Customers (${customers.length})`}, { id:'orders',label:'Orders' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1) }}
            style={{ padding:'9px 16px',fontSize:13,fontWeight:600,borderRadius:8,cursor:'pointer',
              border: tab===t.id?'1px solid var(--edlp-primary)':'1px solid #E5EBF2',
              background: tab===t.id?'rgba(232,160,32,0.08)':'#fff',
              color: tab===t.id?'#C98516':'#8A9AB5' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'customers' && (
        <Card>
          <div style={{ marginBottom:14 }}>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search B2B customers…" style={{ maxWidth:360 }} />
          </div>
          <DataTable columns={custCols} rows={customers} rowKey={(c)=>c.id} loading={customersQuery.isLoading}
            emptyMessage="No B2B customers yet." onRowClick={openEditCustomer}
            pagination={customersQuery.data?.meta ? { current:customersQuery.data.meta.current_page,last:customersQuery.data.meta.last_page,total:customersQuery.data.meta.total,onPage:setPage } : undefined}
          />
        </Card>
      )}

      {tab === 'orders' && (
        <Card>
          <DataTable columns={orderCols} rows={orders} rowKey={(o)=>o.id} loading={ordersQuery.isLoading}
            emptyMessage="No wholesale orders yet." onRowClick={setViewOrder}
            pagination={ordersQuery.data?.meta ? { current:ordersQuery.data.meta.current_page,last:ordersQuery.data.meta.last_page,total:ordersQuery.data.meta.total,onPage:setPage } : undefined}
          />
        </Card>
      )}

      {/* Customer modal */}
      <Modal open={customerModal} onClose={() => setCustomerModal(false)} title={editCustomer ? 'Edit B2B Customer' : 'Add B2B Customer'} width={520}
        footer={<>
          <Btn variant="ghost" onClick={() => setCustomerModal(false)}>Cancel</Btn>
          <Btn onClick={custForm.handleSubmit((d) => saveCustomerMutation.mutate(d))} disabled={saveCustomerMutation.isPending}>
            {saveCustomerMutation.isPending ? <><Spinner size={12}/> Saving…</> : 'Save Customer'}
          </Btn>
        </>}
      >
        <form style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <FormField label="Business Name" required><FormInput {...custForm.register('business_name')} placeholder="Green Foods Ltd" /></FormField>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Contact Person"><FormInput {...custForm.register('contact_person')} placeholder="Mr. Adeyemi" /></FormField>
            <FormField label="Phone"><FormInput {...custForm.register('phone')} type="tel" placeholder="08012345678" /></FormField>
          </div>
          <FormField label="Email"><FormInput {...custForm.register('email')} type="email" /></FormField>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
            <FormField label="Tier">
              <FormSelect {...custForm.register('tier')}><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option></FormSelect>
            </FormField>
            <FormField label="Credit Limit (₦)"><FormInput {...custForm.register('credit_limit')} type="number" min={0} /></FormField>
            <FormField label="Payment Terms">
              <FormSelect {...custForm.register('payment_terms')}><option value="cod">COD</option><option value="net30">Net 30</option><option value="net60">Net 60</option></FormSelect>
            </FormField>
          </div>
          <FormField label="Address"><FormInput {...custForm.register('address')} placeholder="Business address" /></FormField>
        </form>
      </Modal>

      {/* Create order modal */}
      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="Create Wholesale Order" width={620}
        footer={<>
          <Btn variant="ghost" onClick={() => setOrderModal(false)}>Cancel</Btn>
          <Btn onClick={orderForm.handleSubmit((d) => createOrderMutation.mutate(d))} disabled={createOrderMutation.isPending}>
            {createOrderMutation.isPending ? <><Spinner size={12}/> Creating…</> : 'Create Order'}
          </Btn>
        </>}
      >
        <form style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <FormField label="B2B Customer" required>
            <FormSelect {...orderForm.register('b2b_customer_id', { required:true })}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.business_name} ({c.tier})</option>)}
            </FormSelect>
          </FormField>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4 }}>
            <div style={{ fontSize:12,fontWeight:700,color:'#8A9AB5',letterSpacing:'0.06em',textTransform:'uppercase' }}>Order Items</div>
            <Btn variant="ghost" size="sm" icon={Plus} onClick={() => appendItem({ product_id:'', quantity:1 })}>Add Item</Btn>
          </div>
          {orderItems.map((field, idx) => (
            <div key={field.id} style={{ display:'grid',gridTemplateColumns:'1fr 80px 32px',gap:8,alignItems:'flex-end' }}>
              <FormField label={idx === 0 ? 'Product' : ''}>
                <FormSelect {...orderForm.register(`items.${idx}.product_id`, { required:true })}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </FormSelect>
              </FormField>
              <FormField label={idx === 0 ? 'Qty' : ''}>
                <FormInput {...orderForm.register(`items.${idx}.quantity`)} type="number" min={1} />
              </FormField>
              <button type="button" onClick={() => removeItem(idx)} style={{ background:'none',border:'none',cursor:'pointer',color:'#C0392B',padding:'8px 4px',display:'flex' }}>
                <X size={14}/>
              </button>
            </div>
          ))}
          <FormField label="Delivery Address">
            <FormInput {...orderForm.register('delivery_address')} placeholder="Delivery address…" />
          </FormField>
          <FormField label="Notes">
            <textarea {...orderForm.register('notes')} rows={2} style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }} />
          </FormField>
        </form>
      </Modal>

      {/* View order modal */}
      <Modal open={Boolean(viewOrder)} onClose={() => setViewOrder(null)} title={`Order: ${viewOrder?.order_number}`} width={560}>
        {viewOrder && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Customer</div><div style={{ fontWeight:600 }}>{viewOrder.customer?.business_name}</div></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Total</div><div style={{ fontWeight:700,fontSize:16,color:'#E8A020' }}>{money(viewOrder.total)}</div></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Status</div><Badge color={STATUS_COLOR[viewOrder.status]}>{viewOrder.status}</Badge></div>
              <div><div style={{ fontSize:11,color:'#8A9AB5' }}>Payment</div><Badge color={PAYMENT_COLOR[viewOrder.payment_status]}>{viewOrder.payment_status}</Badge></div>
            </div>
            {NEXT_STATUS[viewOrder.status] && (
              <Btn icon={ArrowRight} onClick={() => advanceMutation.mutate({ id:viewOrder.id, status:NEXT_STATUS[viewOrder.status] })} disabled={advanceMutation.isPending}>
                Advance to: {NEXT_STATUS[viewOrder.status]}
              </Btn>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
