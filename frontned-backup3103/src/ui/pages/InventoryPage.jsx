/**
 * InventoryPage v3 — Full Inventory Operations Centre
 * Tabs: All Stock | Stock In | Stock Out | Transfers | Stock-Take | Low Stock
 * Sprint 2 & 3 compliant - adjust, transfer, stock-take, low stock alerts
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ClipboardCheck, AlertTriangle, CheckCircle, RefreshCw,
  Search, Plus, TrendingDown,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  Btn, Card, DataTable, Modal,
  FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

// ── Helpers ───────────────────────────────────────────────────────────────────
function StockBar({ qty, reorderLevel = 5 }) {
  const max   = Math.max(reorderLevel * 4, qty, 1)
  const pct   = Math.min((qty / max) * 100, 100)
  const isLow = qty > 0 && qty <= reorderLevel
  const isOut = qty <= 0
  const color = isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A'
  const bg    = isOut ? '#FDECEA' : isLow ? '#FEF0E6' : '#EAF5EE'
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,minWidth:130 }}>
      <div style={{ flex:1,height:6,background:'#F0F4F8',borderRadius:4,overflow:'hidden' }}>
        <div style={{ width:`${pct}%`,height:'100%',background:color,borderRadius:4,transition:'width 0.3s' }} />
      </div>
      <span style={{ fontSize:12,fontWeight:700,color,background:bg,padding:'1px 7px',borderRadius:20,minWidth:36,textAlign:'center' }}>
        {qty}
      </span>
    </div>
  )
}

function StockBadge({ status }) {
  const cfg = {
    out:     { label:'Out of Stock', color:'#C0392B', bg:'#FDECEA' },
    low:     { label:'Low Stock',    color:'#C45A00', bg:'#FEF0E6' },
    ok:      { label:'In Stock',     color:'#1A6E3A', bg:'#EAF5EE' },
    unknown: { label:'Not Tracked',  color:'#6B7A8D', bg:'#F0F4F8' },
  }[status ?? 'unknown'] ?? { label:status, color:'#6B7A8D', bg:'#F0F4F8' }
  return (
    <span style={{ fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,background:cfg.bg,color:cfg.color }}>
      {cfg.label}
    </span>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id:'list',      label:'All Stock',     icon:Package },
  { id:'in',        label:'Stock In',      icon:ArrowDownToLine },
  { id:'out',       label:'Stock Out',     icon:ArrowUpFromLine },
  { id:'transfer',  label:'Transfers',     icon:ArrowLeftRight },
  { id:'stocktake', label:'Stock-Take',    icon:ClipboardCheck },
  { id:'low',       label:'Low Stock',     icon:AlertTriangle },
]

const TAB_META = {
  list:      { title:'All Stock',               subtitle:'Complete inventory view for your branch. Adjust stock inline.' },
  in:        { title:'Stock In',                subtitle:'Record incoming deliveries, restocks and supplier receipts.' },
  out:       { title:'Stock Out',               subtitle:'Record stock removed without a sale — damage, sampling, internal use.' },
  transfer:  { title:'Inter-Branch Transfer',   subtitle:'Move stock between branches. Admin approval required.' },
  stocktake: { title:'Stock-Take',              subtitle:'Physical count reconciliation. Variances auto-calculated.' },
  low:       { title:'Low Stock Alerts',        subtitle:'Items below their reorder level. Restock immediately.' },
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

// ── ViewOnly placeholder ──────────────────────────────────────────────────────
function ViewOnly({ icon: Icon, message = 'Only administrators can record stock movements.' }) {
  return (
    <Card style={{ padding:48,textAlign:'center',color:'#8A9AB5' }}>
      <Icon size={40} color="#E5EBF2" style={{ marginBottom:14 }} />
      <div style={{ fontSize:15,fontWeight:700,color:'#1C2B3A',marginBottom:6 }}>View Only</div>
      <div style={{ fontSize:13 }}>{message}</div>
    </Card>
  )
}

// ── Stock In Tab ──────────────────────────────────────────────────────────────
function StockInTab({ products, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id:'', quantity:1, notes:'' } })

  const mut = useMutation({
    mutationFn: (d) => api.post('/inventory/adjust', { product_id:d.product_id, branch_id:user?.branch_id, type:'add', quantity:d.quantity, notes:d.notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['inventory'] }); toast.success('Stock added ✓'); form.reset({ product_id:'', quantity:1, notes:'' }) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowDownToLine} />

  return (
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start' }}>
      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:20 }}>Record Stock Receipt</div>
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ padding:'10px 14px',background:'#EAF5EE',borderRadius:10,fontSize:12,color:'#1A6E3A',display:'flex',gap:8,alignItems:'center' }}>
            <ArrowDownToLine size={14} style={{ flexShrink:0 }} />
            Use this form to add received stock — deliveries, supplier orders, restocks.
          </div>
          <FormField label="Product" required error={form.formState.errors.product_id?.message}>
            <FormSelect register={form.register('product_id')}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Quantity Received" required error={form.formState.errors.quantity?.message}>
            <FormInput register={form.register('quantity')} type="number" min={1} placeholder="0" />
          </FormField>
          <FormField label="Notes / Reference" hint="e.g. PO number, supplier, delivery note">
            <textarea {...form.register('notes')} rows={3} placeholder="e.g. PO-2026-0045 — Unilever delivery"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical',fontFamily:'inherit' }}
              onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
            />
          </FormField>
          <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
            {mut.isPending ? <><Spinner size={12}/> Adding…</> : <><Plus size={14}/> Add Stock</>}
          </Btn>
        </div>
      </Card>

      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:16 }}>When to use Stock In</div>
        {[
          { icon:'📦', title:'Supplier Delivery',    desc:'When a purchase order arrives at the branch.' },
          { icon:'🔄', title:'Replenishment',         desc:'Adding buffer stock above the reorder point.' },
          { icon:'↩️', title:'Customer Return',       desc:'Returned item going back on the shelf.' },
          { icon:'✅', title:'Inventory Correction',  desc:'Adjusting system count up to match physical count.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{ display:'flex',gap:12,padding:'12px 14px',background:'#F6F8FB',borderRadius:10,marginBottom:10 }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:'#1C2B3A' }}>{title}</div>
              <div style={{ fontSize:12,color:'#8A9AB5',marginTop:2 }}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{ padding:'10px 14px',background:'#FEF0E6',borderRadius:10,fontSize:12,color:'#C45A00',marginTop:4 }}>
          💡 For large supplier deliveries, use <strong>Purchase Orders</strong> — it creates FEFO batches with expiry dates automatically.
        </div>
      </Card>
    </div>
  )
}

// ── Stock Out Tab ─────────────────────────────────────────────────────────────
function StockOutTab({ products, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(inOutSchema), defaultValues: { product_id:'', quantity:1, notes:'' } })

  const mut = useMutation({
    mutationFn: (d) => api.post('/inventory/adjust', { product_id:d.product_id, branch_id:user?.branch_id, type:'remove', quantity:d.quantity, notes:d.notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['inventory'] }); toast.success('Stock removed and logged ✓'); form.reset({ product_id:'', quantity:1, notes:'' }) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowUpFromLine} />

  return (
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start' }}>
      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:20 }}>Record Stock Removal</div>
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ padding:'10px 14px',background:'#FDECEA',borderRadius:10,fontSize:12,color:'#C0392B',display:'flex',gap:8,alignItems:'center' }}>
            <AlertTriangle size={14} style={{ flexShrink:0 }} />
            Reduces stock WITHOUT recording a sale. Use for damage, sampling, or internal use ONLY.
          </div>
          <FormField label="Product" required error={form.formState.errors.product_id?.message}>
            <FormSelect register={form.register('product_id')}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Quantity to Remove" required error={form.formState.errors.quantity?.message}>
            <FormInput register={form.register('quantity')} type="number" min={1} placeholder="0" />
          </FormField>
          <FormField label="Reason (required for audit)" required>
            <textarea {...form.register('notes', { required:'Please provide a reason' })} rows={3}
              placeholder="e.g. Damaged in transit — 5 bottles broken&#10;Sampling for customer promotion"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical',fontFamily:'inherit' }}
              onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
            />
          </FormField>
          <button onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}
            style={{ padding:'10px 18px',background:mut.isPending?'#8A9AB5':'#C0392B',color:'#fff',border:'none',borderRadius:9,cursor:mut.isPending?'not-allowed':'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:8,justifyContent:'center' }}>
            {mut.isPending ? <><Spinner size={12}/> Removing…</> : <><ArrowUpFromLine size={14}/> Remove Stock</>}
          </button>
        </div>
      </Card>

      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:16 }}>Valid Reason Codes</div>
        {[
          { icon:'💥', title:'Damaged / Broken',    desc:'Physical damage during handling, storage, or delivery.' },
          { icon:'🧪', title:'Sampling / Demo',     desc:'Marketing samples, customer tastings, staff demos.' },
          { icon:'🏢', title:'Internal Use',         desc:'Supplies consumed within the branch.' },
          { icon:'👔', title:'Management Use',       desc:'Authorised management consumption.' },
          { icon:'📋', title:'Inventory Correction', desc:'Reducing count to match lower physical stock-take.' },
          { icon:'⏰', title:'Expired Product',      desc:'Use the Expiry Disposal workflow for expired items instead.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{ display:'flex',gap:12,padding:'10px 14px',background:'#F6F8FB',borderRadius:10,marginBottom:8 }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <div>
              <div style={{ fontSize:12,fontWeight:600,color:'#1C2B3A' }}>{title}</div>
              <div style={{ fontSize:11,color:'#8A9AB5',marginTop:1 }}>{desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── Transfer Tab ──────────────────────────────────────────────────────────────
function TransferTab({ products, branches, user, isAdminLike }) {
  const queryClient = useQueryClient()
  const form = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: { product_id:'', from_branch_id: user?.branch_id ?? '', to_branch_id:'', quantity:1, notes:'' },
  })

  const mut = useMutation({
    mutationFn: (d) => api.post('/inventory/transfer', d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['inventory'] })
      toast.success('Transfer request submitted for approval ✓')
      form.reset({ product_id:'', from_branch_id: user?.branch_id ?? '', to_branch_id:'', quantity:1, notes:'' })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Transfer failed'),
  })

  if (!isAdminLike) return <ViewOnly icon={ArrowLeftRight} message="Only administrators can initiate inter-branch transfers." />

  return (
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start' }}>
      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:20 }}>New Transfer Request</div>
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ padding:'10px 14px',background:'#EAF0FB',borderRadius:10,fontSize:12,color:'#1A3FA6',display:'flex',gap:8,alignItems:'center' }}>
            <ArrowLeftRight size={14} style={{ flexShrink:0 }} />
            Transfer requests require admin approval before stock is physically moved.
          </div>
          <FormField label="Product" required error={form.formState.errors.product_id?.message}>
            <FormSelect register={form.register('product_id')}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
            </FormSelect>
          </FormField>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="From Branch" required error={form.formState.errors.from_branch_id?.message}>
              <FormSelect register={form.register('from_branch_id')}>
                <option value="">Select…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="To Branch" required error={form.formState.errors.to_branch_id?.message}>
              <FormSelect register={form.register('to_branch_id')}>
                <option value="">Select…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
          </div>
          <FormField label="Quantity" required error={form.formState.errors.quantity?.message}>
            <FormInput register={form.register('quantity')} type="number" min={1} placeholder="1" />
          </FormField>
          <FormField label="Justification">
            <textarea {...form.register('notes')} rows={2} placeholder="e.g. Ikeja branch out of stock, surplus at HQ"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical',fontFamily:'inherit' }}
              onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
            />
          </FormField>
          <Btn onClick={form.handleSubmit(d => mut.mutate(d))} disabled={mut.isPending}>
            {mut.isPending ? <><Spinner size={12}/> Submitting…</> : <><ArrowLeftRight size={14}/> Submit Transfer Request</>}
          </Btn>
        </div>
      </Card>

      <Card style={{ padding:24 }}>
        <div style={{ fontSize:14,fontWeight:700,color:'#1C2B3A',marginBottom:16 }}>Transfer Process</div>
        {[
          { step:'1', label:'Request Submitted', desc:'Branch manager creates the transfer request here.', color:'#1A3FA6', bg:'#EAF0FB' },
          { step:'2', label:'Admin Approval',    desc:'Goes to Approvals inbox. Admin approves or rejects.', color:'#5B3FA6', bg:'#F0ECFB' },
          { step:'3', label:'Stock Moved',        desc:'Source branch decremented, destination branch incremented.', color:'#1A6E3A', bg:'#EAF5EE' },
          { step:'4', label:'Audit Logged',       desc:'Full record with timestamps in inventory history.', color:'#C45A00', bg:'#FEF0E6' },
        ].map(({ step, label, desc, color, bg }, i) => (
          <div key={step} style={{ display:'flex',gap:14,padding:'14px 0',borderBottom:i<3?'1px dashed #F0F4F8':'none' }}>
            <div style={{ width:28,height:28,borderRadius:'50%',background:bg,color,fontWeight:800,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{step}</div>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:'#1C2B3A' }}>{label}</div>
              <div style={{ fontSize:12,color:'#8A9AB5',marginTop:2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [tab, setTab]           = useState('list')
  const [search, setSearch]     = useState('')
  const [debouncedSearch]       = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]         = useState(1)
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [stockTakeOpen, setStockTakeOpen] = useState(false)

  const { title, subtitle } = TAB_META[tab] ?? TAB_META.list

  // ── Queries ──────────────────────────────────────────────────
  const inventoryQuery = useQuery({
    queryKey: ['inventory', { q:debouncedSearch, status:statusFilter, page }],
    enabled: tab === 'list',
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { search:debouncedSearch||undefined, status:statusFilter||undefined, page, per_page:20 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => { const res = await api.get('/inventory/low-stock'); return res.data?.data ?? [] },
    staleTime: 30_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => { const res = await api.get('/branches', { params:{ all:true } }); return res.data?.data ?? [] },
    staleTime: 300_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'simple-list'],
    queryFn: async () => { const res = await api.get('/products', { params:{ per_page:300, active_only:true } }); return res.data?.data ?? [] },
    staleTime: 300_000,
    enabled: ['in','out','transfer','stocktake'].includes(tab),
  })

  const rows     = inventoryQuery.data?.data ?? []
  const meta     = inventoryQuery.data?.meta
  const lowRows  = lowStockQuery.data ?? []
  const branches = branchesQuery.data ?? []
  const products = productsQuery.data ?? []

  const outCount = rows.filter(r => r.status === 'out').length
  const lowCount = rows.filter(r => r.status === 'low').length
  const okCount  = rows.filter(r => r.status === 'ok').length

  // ── Inline adjust ─────────────────────────────────────────────
  const adjustForm = useForm({ resolver: zodResolver(adjustSchema), defaultValues: { type:'add', quantity:1, notes:'' } })
  const adjustMut  = useMutation({
    mutationFn: (d) => api.post('/inventory/adjust', { product_id:adjustTarget?.product_id, branch_id:user?.branch_id, ...d }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['inventory'] }); toast.success('Stock adjusted ✓'); setAdjustTarget(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Stock-Take ────────────────────────────────────────────────
  const stForm  = useForm({ defaultValues: { items:[] } })
  const { fields:stFields, replace:replaceStFields } = useFieldArray({ control:stForm.control, name:'items' })

  function openStockTake() {
    replaceStFields(rows.map(r => ({ product_id:r.product_id, name:r.product?.name??`#${r.product_id}`, current:r.quantity, quantity:r.quantity })))
    setStockTakeOpen(true)
  }

  const stMut = useMutation({
    mutationFn: (d) => api.post('/inventory/stock-take', { items: d.items.map(i => ({ product_id:i.product_id, quantity:Number(i.quantity) })) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey:['inventory'] })
      const variances = (res.data?.data ?? []).filter(r => r.variance !== 0).length
      toast.success(`Stock-take saved · ${variances} variance${variances !== 1 ? 's' : ''} found`)
      setStockTakeOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Stock-take failed'),
  })

  // ── Columns ───────────────────────────────────────────────────
  const columns = useMemo(() => [
    { key:'product', header:'Product', cell:(r) => (
      <div>
        <div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
        <div style={{ fontSize:11,color:'#8A9AB5' }}>{r.product?.category?.name ?? '—'} · {r.product?.sku ?? '—'}</div>
      </div>
    )},
    { key:'stock',    header:'Stock Level', cell:(r) => <StockBar qty={r.quantity} reorderLevel={r.product?.reorder_level ?? 5} /> },
    { key:'available',header:'Available',   cell:(r) => <span style={{ fontWeight:700,fontSize:13,color:'#1C2B3A' }}>{r.available_quantity ?? r.quantity}</span> },
    { key:'reserved', header:'Reserved',    cell:(r) => <span style={{ fontSize:12,color:'#8A9AB5' }}>{r.reserved_quantity ?? 0}</span> },
    { key:'status',   header:'Status',      cell:(r) => <StockBadge status={r.status} /> },
    { key:'last',     header:'Last Count',  cell:(r) => r.last_stock_take_at
      ? <span style={{ fontSize:11,color:'#8A9AB5' }}>{formatDistanceToNow(new Date(r.last_stock_take_at), { addSuffix:true })}</span>
      : <span style={{ fontSize:11,color:'#D5DFE9' }}>Never counted</span>
    },
    ...(isAdminLike ? [{ key:'actions', header:'', align:'right', cell:(r) => (
      <button onClick={e => { e.stopPropagation(); adjustForm.reset({ type:'add', quantity:1, notes:'' }); setAdjustTarget(r) }}
        style={{ fontSize:12,fontWeight:600,color:'#1A3FA6',background:'none',border:'1px solid #E5EBF2',cursor:'pointer',padding:'5px 10px',borderRadius:7,display:'flex',alignItems:'center',gap:4 }}>
        <RefreshCw size={12}/> Adjust
      </button>
    )}] : []),
  ], [isAdminLike])

  const lowColumns = useMemo(() => [
    { key:'product', header:'Product', cell:(r) => (
      <div>
        <div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{r.product?.name ?? `#${r.product_id}`}</div>
        <div style={{ fontSize:11,color:'#8A9AB5' }}>{r.product?.sku} · Reorder at {r.product?.reorder_level ?? 5}</div>
      </div>
    )},
    { key:'branch', header:'Branch',        cell:(r) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{r.branch?.name ?? '—'}</span> },
    { key:'stock',  header:'Current Stock', cell:(r) => <StockBar qty={r.quantity} reorderLevel={r.product?.reorder_level ?? 5} /> },
    { key:'status', header:'Status',        cell:(r) => <StockBadge status={r.status} /> },
    ...(isAdminLike ? [{ key:'action', header:'', align:'right', cell:() => (
      <button onClick={() => setTab('in')}
        style={{ fontSize:12,fontWeight:700,color:'#1A6E3A',background:'#EAF5EE',border:'none',cursor:'pointer',padding:'6px 12px',borderRadius:8 }}>
        Stock In →
      </button>
    )}] : []),
  ], [isAdminLike])

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:24 }}>

      {/* Dynamic header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:'#1C2B3A' }}>{title}</h1>
          <p style={{ margin:'4px 0 0',fontSize:13,color:'#8A9AB5' }}>{subtitle}</p>
        </div>
        {tab === 'list' && isAdminLike && (
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey:['inventory'] })}>
              <RefreshCw size={14}/> Refresh
            </Btn>
            <Btn variant="secondary" onClick={openStockTake}>
              <ClipboardCheck size={14}/> Stock-Take
            </Btn>
          </div>
        )}
      </div>

      {/* KPI cards — list tab only */}
      {tab === 'list' && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          <StatCard label="In Stock"     value={inventoryQuery.isLoading ? '…' : okCount}  icon={CheckCircle}  accent="#1A6E3A" />
          <StatCard label="Low Stock"    value={inventoryQuery.isLoading ? '…' : lowCount} icon={AlertTriangle} accent="#C45A00" />
          <StatCard label="Out of Stock" value={inventoryQuery.isLoading ? '…' : outCount} icon={Package}       accent="#C0392B" />
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
        {TABS.map(({ id, label, icon:Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display:'flex',alignItems:'center',gap:6,
            padding:'9px 16px',fontSize:13,fontWeight:600,borderRadius:8,cursor:'pointer',
            border: tab===id ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
            background: tab===id ? 'rgba(232,160,32,0.08)' : '#fff',
            color: tab===id ? '#C98516' : '#8A9AB5',
            transition:'all 0.15s',
          }}>
            <Icon size={13}/> {label}
            {id==='low' && lowRows.length > 0 && (
              <span style={{ fontSize:10,fontWeight:800,background:'#C0392B',color:'#fff',borderRadius:20,padding:'1px 6px',marginLeft:2 }}>
                {lowRows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ALL STOCK ─────────────────────────────────────────── */}
      {tab === 'list' && (
        <Card>
          <div style={{ padding:'16px 20px',borderBottom:'1px solid #F0F4F8',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center' }}>
            <div style={{ position:'relative',flex:'1 1 240px',maxWidth:360 }}>
              <Search size={14} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#8A9AB5',pointerEvents:'none' }}/>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search product name or SKU…"
                style={{ width:'100%',padding:'9px 12px 9px 34px',fontSize:13,border:'1px solid #E5EBF2',borderRadius:9,outline:'none',boxSizing:'border-box',color:'#3A4A5C' }}
                onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#E5EBF2'}
              />
            </div>
            {['','low','out'].map(v => (
              <button key={v} onClick={() => { setStatusFilter(v); setPage(1) }}
                style={{ fontSize:11,padding:'7px 14px',borderRadius:20,fontWeight:600,cursor:'pointer',
                  border: statusFilter===v ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
                  background: statusFilter===v ? 'rgba(232,160,32,0.08)' : '#fff',
                  color: statusFilter===v ? '#C98516' : '#8A9AB5',
                }}>
                {v==='' ? 'All' : v==='low' ? '⚠ Low Stock' : '🔴 Out of Stock'}
              </button>
            ))}
          </div>
          <DataTable
            columns={columns} rows={rows} rowKey={r => r.id}
            loading={inventoryQuery.isLoading}
            emptyMessage="No inventory records found."
            pagination={meta ? { current:meta.current_page, last:meta.last_page, total:meta.total, onPage:setPage } : undefined}
          />
        </Card>
      )}

      {tab === 'in'       && <StockInTab  products={products} user={user} isAdminLike={isAdminLike} />}
      {tab === 'out'      && <StockOutTab products={products} user={user} isAdminLike={isAdminLike} />}
      {tab === 'transfer' && <TransferTab products={products} branches={branches} user={user} isAdminLike={isAdminLike} />}

      {/* ── STOCK-TAKE ────────────────────────────────────────── */}
      {tab === 'stocktake' && (
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ padding:'12px 16px',background:'#FEF0E6',borderRadius:10,fontSize:13,color:'#C45A00',display:'flex',gap:10,alignItems:'center' }}>
            <AlertTriangle size={15} style={{ flexShrink:0 }}/>
            Go to <strong>All Stock</strong> tab first to load inventory, then click <strong>Stock-Take</strong> to enter physical counts.
          </div>
          <Card style={{ padding:40,display:'flex',flexDirection:'column',alignItems:'center',gap:16 }}>
            <ClipboardCheck size={48} color="#E5EBF2"/>
            <div style={{ fontSize:16,fontWeight:700,color:'#1C2B3A' }}>Start a Stock-Take</div>
            <div style={{ fontSize:13,color:'#8A9AB5',textAlign:'center',maxWidth:400 }}>
              Load the <strong>All Stock</strong> tab, then click the <strong>Stock-Take</strong> button top-right to enter physical counts and auto-calculate variances.
            </div>
            <Btn onClick={() => setTab('list')}><Package size={14}/> Go to All Stock →</Btn>
          </Card>
        </div>
      )}

      {/* ── LOW STOCK ────────────────────────────────────────── */}
      {tab === 'low' && (
        <Card>
          {lowRows.length === 0 && !lowStockQuery.isLoading ? (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,padding:'60px 0' }}>
              <CheckCircle size={40} color="#EAF5EE"/>
              <div style={{ fontSize:16,fontWeight:700,color:'#1C2B3A' }}>All stock levels are healthy!</div>
              <div style={{ fontSize:13,color:'#8A9AB5' }}>Nothing below reorder level.</div>
            </div>
          ) : (
            <DataTable columns={lowColumns} rows={lowRows} rowKey={r => r.id}
              loading={lowStockQuery.isLoading} emptyMessage="No low stock items." />
          )}
        </Card>
      )}

      {/* ── Inline Adjust Modal ───────────────────────────────── */}
      <Modal open={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.product?.name ?? ''}`} width={420}
        footer={<>
          <Btn variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Btn>
          <Btn onClick={adjustForm.handleSubmit(d => adjustMut.mutate(d))} disabled={adjustMut.isPending}>
            {adjustMut.isPending ? <><Spinner size={12}/> Applying…</> : 'Apply Adjustment'}
          </Btn>
        </>}
      >
        {adjustTarget && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ background:'#F6F8FB',borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11,color:'#8A9AB5',marginBottom:2 }}>Current Stock</div>
                <div style={{ fontSize:26,fontWeight:800,color:'#1C2B3A' }}>{adjustTarget.quantity}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11,color:'#8A9AB5',marginBottom:2 }}>Reorder Level</div>
                <div style={{ fontSize:20,fontWeight:700,color:'#C45A00' }}>{adjustTarget.product?.reorder_level ?? 5}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12,fontWeight:600,color:'#3A4A5C',marginBottom:8 }}>Adjustment Type</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
                {[
                  { value:'add',    label:'+ Add',    color:'#1A6E3A', bg:'#EAF5EE' },
                  { value:'remove', label:'− Remove', color:'#C0392B', bg:'#FDECEA' },
                  { value:'set',    label:'= Set',    color:'#1A3FA6', bg:'#EAF0FB' },
                ].map(opt => {
                  const sel = adjustForm.watch('type') === opt.value
                  return (
                    <button key={opt.value} type="button" onClick={() => adjustForm.setValue('type', opt.value)}
                      style={{ padding:'10px 4px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
                        border:`1px solid ${sel ? opt.color : '#E5EBF2'}`,
                        background:sel ? opt.bg : '#fff', color:sel ? opt.color : '#8A9AB5', transition:'all 0.15s' }}>
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
                style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}/>
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
            {stMut.isPending ? <><Spinner size={12}/> Saving…</> : 'Save Stock-Take'}
          </Btn>
        </>}
      >
        <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
          <div style={{ padding:'10px 14px',background:'#FEF0E6',borderRadius:8,fontSize:12,color:'#C45A00',marginBottom:8,display:'flex',gap:8,alignItems:'center' }}>
            <AlertTriangle size={14} style={{ flexShrink:0 }}/>
            Enter the physical count for each item. Variances are calculated automatically.
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 80px 80px 80px',gap:8,padding:'8px 12px',background:'#F6F8FB',borderRadius:8,fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.05em' }}>
            <span>Product</span>
            <span style={{ textAlign:'right' }}>System</span>
            <span style={{ textAlign:'right' }}>Physical</span>
            <span style={{ textAlign:'right' }}>Variance</span>
          </div>
          <div style={{ maxHeight:400,overflowY:'auto' }}>
            {stFields.map((field, idx) => {
              const phys     = Number(stForm.watch(`items.${idx}.quantity`)) || 0
              const variance = phys - (field.current ?? 0)
              const varColor = variance > 0 ? '#1A6E3A' : variance < 0 ? '#C0392B' : '#8A9AB5'
              return (
                <div key={field.id} style={{ display:'grid',gridTemplateColumns:'1fr 80px 80px 80px',gap:8,padding:'8px 12px',borderBottom:'1px solid #F0F4F8',alignItems:'center' }}>
                  <span style={{ fontSize:13,color:'#3A4A5C',fontWeight:500 }}>{field.name}</span>
                  <span style={{ textAlign:'right',fontSize:13,color:'#8A9AB5',fontWeight:600 }}>{field.current}</span>
                  <input type="number" min={0} {...stForm.register(`items.${idx}.quantity`)} defaultValue={field.current}
                    style={{ width:'100%',padding:'5px 8px',fontSize:13,fontWeight:700,textAlign:'right',border:'1px solid #D5DFE9',borderRadius:6,outline:'none',color:'#1C2B3A' }}
                    onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
                  />
                  <span style={{ textAlign:'right',fontSize:13,fontWeight:700,color:varColor }}>
                    {variance > 0 ? `+${variance}` : variance}
                  </span>
                </div>
              )
            })}
            {stFields.length === 0 && (
              <div style={{ textAlign:'center',padding:'30px 0',color:'#8A9AB5',fontSize:13 }}>
                Go to All Stock tab first to load inventory items.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
