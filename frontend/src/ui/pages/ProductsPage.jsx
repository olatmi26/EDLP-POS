/**
 * ProductsPage — Central Product Catalog
 * Matches design Image 17: product table with thumbnails, stock level bars,
 * Low Stock badge, Bulk Price Update panel, + Add New Product button.
 * Full CRUD: create, edit, delete, image upload, bulk price update, CSV import.
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import {
  Layers, Plus, Pencil, Trash2, Upload, Download,
  Tag, AlertTriangle, BarChart2, Image, X, RefreshCw,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Badge, Modal, ConfirmDialog, FormField, FormInput,
  FormSelect, Spinner, StatusDot,
} from '../components/shared'

// ── Schemas ───────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name:          z.string().min(2, 'Name required'),
  sku:           z.string().min(1, 'SKU required'),
  barcode:       z.string().optional().or(z.literal('')),
  description:   z.string().optional().or(z.literal('')),
  category_id:   z.coerce.number().optional().nullable(),
  supplier_id:   z.coerce.number().optional().nullable(),
  cost_price:    z.coerce.number().min(0, 'Required'),
  selling_price: z.coerce.number().min(0, 'Required'),
  unit:          z.string().optional().or(z.literal('')),
  reorder_level: z.coerce.number().min(0).optional(),
  is_active:     z.boolean().optional(),
  is_vat_exempt: z.boolean().optional(),
})

const bulkPriceSchema = z.object({
  type:        z.enum(['percentage', 'fixed']),
  value:       z.coerce.number().min(0.01, 'Enter a value'),
  category_id: z.coerce.number().optional().nullable(),
  reason:      z.string().optional(),
})

// ── Stock level bar ───────────────────────────────────────────────────────────
function StockBar({ qty, reorderLevel }) {
  const max  = Math.max(reorderLevel * 4, qty, 1)
  const pct  = Math.min((qty / max) * 100, 100)
  const isLow = qty > 0 && qty <= reorderLevel
  const isOut = qty <= 0
  const color = isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 5, background: '#F0F4F8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>{qty}</span>
    </div>
  )
}

// ── Product thumbnail ─────────────────────────────────────────────────────────
function ProductThumb({ url, name }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
      background: url ? 'transparent' : '#F0F4F8',
      border: '1px solid #E5EBF2',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Image size={14} color="#D5DFE9" />
      }
    </div>
  )
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]             = useState('')
  const [debouncedSearch]               = useDebounce(search, 300)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]                 = useState(1)

  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkModal, setBulkModal]       = useState(false)
  const [imageTarget, setImageTarget]   = useState(null)
  const importRef = useRef(null)

  // ── Data ───────────────────────────────────────────────────
  const productsQuery = useQuery({
    queryKey: ['products', { q: debouncedSearch, category_id: categoryFilter, supplier_id: supplierFilter, status: statusFilter, page }],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: {
          search:      debouncedSearch || undefined,
          category_id: categoryFilter || undefined,
          supplier_id: supplierFilter || undefined,
          active_only: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
          page,
          per_page: 20,
        },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, per_page: 200 } })
      // extract unique categories
      const cats = new Map()
      ;(res.data?.data ?? []).forEach(p => { if (p.category) cats.set(p.category.id, p.category) })
      return [...cats.values()]
    },
    staleTime: 300_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { per_page: 200 } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const products   = productsQuery.data?.data ?? []
  const meta       = productsQuery.data?.meta
  const categories = categoriesQuery.data ?? []
  const suppliers  = suppliersQuery.data ?? []

  // ── Product form ───────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productSchema),
  })

  function openCreate() {
    setEditProduct(null)
    reset({ name: '', sku: '', barcode: '', description: '', category_id: null, supplier_id: null, cost_price: '', selling_price: '', unit: 'unit', reorder_level: 5, is_active: true, is_vat_exempt: false })
    setProductModal(true)
  }

  function openEdit(p) {
    setEditProduct(p)
    reset({
      name: p.name, sku: p.sku, barcode: p.barcode ?? '', description: p.description ?? '',
      category_id: p.category_id ?? null, supplier_id: p.supplier_id ?? null,
      cost_price: p.cost_price, selling_price: p.selling_price,
      unit: p.unit ?? 'unit', reorder_level: p.reorder_level ?? 5,
      is_active: p.is_active, is_vat_exempt: p.is_vat_exempt,
    })
    setProductModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => editProduct
      ? api.put(`/products/${editProduct.id}`, data)
      : api.post('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(editProduct ? 'Product updated' : 'Product created')
      setProductModal(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to save product'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Cannot delete — has sales history. Deactivate instead.'),
  })

  // ── Bulk price form ────────────────────────────────────────
  const bulkForm = useForm({ resolver: zodResolver(bulkPriceSchema), defaultValues: { type: 'percentage', value: '', category_id: null, reason: '' } })

  const bulkMutation = useMutation({
    mutationFn: (data) => api.post('/products/bulk-price-update', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`Updated ${res.data?.data?.updated_count ?? 0} product prices`)
      setBulkModal(false)
      bulkForm.reset()
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Bulk update failed'),
  })

  // ── Image upload ───────────────────────────────────────────
  const imageMutation = useMutation({
    mutationFn: ({ id, file }) => {
      const fd = new FormData(); fd.append('image', file)
      return api.post(`/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Image uploaded')
      setImageTarget(null)
    },
    onError: () => toast.error('Image upload failed'),
  })

  // ── CSV import ─────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData(); fd.append('file', file)
      return api.post('/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      const { imported, skipped } = res.data?.data ?? {}
      toast.success(`Imported ${imported} products, skipped ${skipped}`)
    },
    onError: () => toast.error('Import failed'),
  })

  // ── Table columns ──────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'product',
      header: 'Product',
      cell: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProductThumb url={p.thumbnail_url} name={p.name} />
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#8A9AB5', fontFamily: 'monospace' }}>
              {p.sku}{p.barcode ? ` · ${p.barcode}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (p) => p.category
        ? <Badge color="info">{p.category.name}</Badge>
        : <span style={{ color: '#8A9AB5', fontSize: 12 }}>—</span>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (p) => <span style={{ fontSize: 12, color: '#6B7A8D' }}>{p.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'cost_price',
      header: 'Cost Price',
      cell: (p) => <span style={{ fontSize: 12, color: '#8A9AB5' }}>{money(p.cost_price)}</span>,
    },
    {
      key: 'selling_price',
      header: 'Selling Price',
      cell: (p) => <span style={{ fontWeight: 700, fontSize: 13, color: '#1C2B3A' }}>{money(p.selling_price)}</span>,
    },
    {
      key: 'stock',
      header: 'Stock Level',
      cell: (p) => <StockBar qty={p.stock ?? 0} reorderLevel={p.reorder_level ?? 5} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => {
        const stockStatus = p.stock_status ?? (p.stock <= 0 ? 'out' : p.stock <= (p.reorder_level ?? 5) ? 'low' : 'ok')
        if (!p.is_active) return <Badge color="default">Inactive</Badge>
        if (stockStatus === 'out')  return <Badge color="danger">Out of Stock</Badge>
        if (stockStatus === 'low')  return <Badge color="warning">Low Stock</Badge>
        return <Badge color="success">Active</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {isAdminLike && (
            <>
              <button title="Upload image" onClick={(e) => { e.stopPropagation(); setImageTarget(p) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='#1A3FA6'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Image size={14}/></button>
              <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(p) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='#3A4A5C'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Pencil size={14}/></button>
              <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='#C0392B'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Trash2 size={14}/></button>
            </>
          )}
        </div>
      ),
    },
  ], [isAdminLike])

  // ── Low stock summary banner ───────────────────────────────
  const lowCount = products.filter(p => p.stock_status === 'low' || p.stock_status === 'out').length

  return (
    <div>
      <PageHeader
        title="Central Product Catalog"
        subtitle={`${meta?.total ?? '—'} products · manage pricing, stock levels, and details`}
        actions={
          isAdminLike && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" icon={Download} onClick={() => importRef.current?.click()}>
                {importMutation.isPending ? 'Importing…' : 'Bulk Import'}
              </Btn>
              <Btn variant="secondary" icon={Tag} onClick={() => setBulkModal(true)}>Bulk Price</Btn>
              <Btn icon={Plus} onClick={openCreate}>+ Add New Product</Btn>
              <input ref={importRef} type="file" accept=".csv" className="hidden" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) { importMutation.mutate(e.target.files[0]); e.target.value = '' } }}
              />
            </div>
          )
        }
      />

      {/* Low stock warning banner */}
      {lowCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FEF0E6', border: '1px solid #F5CBA7', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#C45A00', fontWeight: 600 }}>
          <AlertTriangle size={15} />
          {lowCount} product{lowCount > 1 ? 's are' : ' is'} low or out of stock in the current view.
        </div>
      )}

      <Card>
        {/* Filters row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search by name, SKU, or barcode…"
            style={{ flex: 1, minWidth: 220 }}
          />
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', color: '#3A4A5C', cursor: 'pointer', background: '#fff' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1) }}
            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', color: '#3A4A5C', cursor: 'pointer', background: '#fff' }}>
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {/* Quick filter chips */}
          {['', 'low', 'out'].map((v) => (
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
          rows={products}
          rowKey={(p) => p.id}
          loading={productsQuery.isLoading}
          emptyMessage="No products found. Use the filters above or add your first product."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* ── Create / Edit Product Modal ─────────────────────── */}
      <Modal open={productModal} onClose={() => setProductModal(false)}
        title={editProduct ? `Edit: ${editProduct.name}` : 'Add New Product'} width={640}
        footer={<>
          <Btn variant="ghost" onClick={() => setProductModal(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editProduct ? 'Save Changes' : 'Create Product'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name + SKU */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FormField label="Product Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Indomie Instant Noodles (Chicken)" />
            </FormField>
            <FormField label="SKU" required error={errors.sku?.message} hint="Unique stock code">
              <FormInput register={register('sku')} error={errors.sku} placeholder="IND-CHK-70G" />
            </FormField>
          </div>

          {/* Barcode + Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Barcode / EAN" error={errors.barcode?.message}>
              <FormInput register={register('barcode')} placeholder="8901491501234" />
            </FormField>
            <FormField label="Unit of Measure" hint="e.g. unit, pack, kg, litre">
              <FormInput register={register('unit')} placeholder="unit" />
            </FormField>
          </div>

          {/* Category + Supplier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Category">
              <FormSelect register={register('category_id')}>
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Supplier">
              <FormSelect register={register('supplier_id')}>
                <option value="">No supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FormSelect>
            </FormField>
          </div>

          {/* Prices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Cost Price (₦)" required error={errors.cost_price?.message}>
              <FormInput register={register('cost_price')} type="number" step="0.01" placeholder="500.00" />
            </FormField>
            <FormField label="Selling Price (₦)" required error={errors.selling_price?.message}>
              <FormInput register={register('selling_price')} type="number" step="0.01" placeholder="750.00" />
            </FormField>
            <FormField label="Reorder Level" hint="Alert when stock ≤ this">
              <FormInput register={register('reorder_level')} type="number" min={0} placeholder="5" />
            </FormField>
          </div>

          {/* Description */}
          <FormField label="Description">
            <textarea {...register('description')} rows={2} placeholder="Optional product description…"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
              onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
            />
          </FormField>

          {/* Flags */}
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
              <input type="checkbox" {...register('is_active')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
              Active product
            </label>
            <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
              <input type="checkbox" {...register('is_vat_exempt')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
              VAT Exempt
            </label>
          </div>
        </form>
      </Modal>

      {/* ── Bulk Price Update Modal ─────────────────────────── */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Price Update" width={440}
        footer={<>
          <Btn variant="ghost" onClick={() => setBulkModal(false)}>Cancel</Btn>
          <Btn onClick={bulkForm.handleSubmit((d) => bulkMutation.mutate(d))} disabled={bulkMutation.isPending}>
            {bulkMutation.isPending ? <><Spinner size={12}/> Updating…</> : 'Apply Price Update'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 12px', background: '#FEF0E6', borderRadius: 8, fontSize: 12, color: '#C45A00', display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Original selling prices are never mutated — price history is always preserved.
          </div>
          <FormField label="Update Type" required>
            <FormSelect register={bulkForm.register('type')}>
              <option value="percentage">Percentage adjustment (%)</option>
              <option value="fixed">Set fixed price (₦)</option>
            </FormSelect>
          </FormField>
          <FormField label="Value" required error={bulkForm.formState.errors.value?.message}
            hint={bulkForm.watch('type') === 'percentage' ? 'e.g. 10 = 10% increase, -5 = 5% decrease' : 'New fixed selling price in ₦'}>
            <FormInput register={bulkForm.register('value')} type="number" step="0.01" placeholder={bulkForm.watch('type') === 'percentage' ? '10' : '750.00'} />
          </FormField>
          <FormField label="Apply to Category (optional)" hint="Leave blank to apply to all products">
            <FormSelect register={bulkForm.register('category_id')}>
              <option value="">All products</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Reason (optional)">
            <FormInput register={bulkForm.register('reason')} placeholder="e.g. Quarterly price review" />
          </FormField>
        </form>
      </Modal>

      {/* ── Image Upload Modal ──────────────────────────────── */}
      <Modal open={Boolean(imageTarget)} onClose={() => setImageTarget(null)} title={`Upload Image — ${imageTarget?.name}`} width={380}
        footer={<Btn variant="ghost" onClick={() => setImageTarget(null)}>Close</Btn>}
      >
        {imageTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <ProductThumb url={imageTarget.thumbnail_url} name={imageTarget.name} />
            <div style={{ fontSize: 13, color: '#8A9AB5', textAlign: 'center' }}>JPEG / PNG · max 2MB</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--edlp-primary)', color: 'var(--edlp-navy)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              <Upload size={15} />
              {imageMutation.isPending ? 'Uploading…' : 'Choose Image'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) imageMutation.mutate({ id: imageTarget.id, file: e.target.files[0] }) }}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ──────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? Products with sales history cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete Product"
      />
    </div>
  )
}
