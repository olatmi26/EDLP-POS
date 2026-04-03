/**
 * ProductsPage v3 — EDLP POS Product Catalog
 *
 * Fixes vs v2:
 *  ✅ Stock Level column now showing (DataTable uses col.cell, not col.render)
 *  ✅ "Untracked" badge for products with no inventory records
 *  ✅ Create/Edit modal: Unit of Measure is a dropdown (from /api/units)
 *  ✅ Create/Edit modal: Category & Supplier have "Add new on the fly" inline
 *  ✅ Create/Edit modal: Image upload inline
 *  ✅ Bulk Price Update: does NOT close on backdrop click
 *  ✅ Bulk Price Update: two modes — (1) multi-product selector, (2) CSV/XLS upload
 *  ✅ Export CSV: opens modal with filters (branch, category, brand, price range)
 *  ✅ Import CSV: modal with template download + step-by-step preview
 *  ✅ Branch switching auto-refreshes all product/inventory data
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import {
  Layers, Plus, Pencil, Trash2, Upload, Download,
  Tag, AlertTriangle, BarChart2, X, RefreshCw,
  TrendingUp, Package, Search, Image as ImageIcon,
  Filter, ChevronDown, FileSpreadsheet,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, Card, DataTable, Badge, Modal,
  ConfirmDialog, FormField, FormInput, FormSelect, Spinner,
} from '../components/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name:          z.string().min(2, 'Name required'),
  sku:           z.string().min(1, 'SKU required'),
  barcode:       z.string().optional().or(z.literal('')),
  description:   z.string().optional().or(z.literal('')),
  category_id:   z.coerce.number().optional().nullable(),
  supplier_id:   z.coerce.number().optional().nullable(),
  brand_id:      z.coerce.number().optional().nullable(),
  cost_price:    z.coerce.number().min(0, 'Required'),
  selling_price: z.coerce.number().min(0, 'Required'),
  unit:          z.string().optional().or(z.literal('')),
  reorder_level: z.coerce.number().min(0).optional(),
  is_active:     z.boolean().optional(),
  is_vat_exempt: z.boolean().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 14, radius = 4 }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: 'linear-gradient(90deg,#E5EBF2 25%,#EEF2F7 50%,#E5EBF2 75%)', backgroundSize: '200% 100%', animation: 'edlp-shimmer 1.4s infinite' }} />
  )
}

function ShimmerStyle() {
  return <style>{`@keyframes edlp-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
}

function SkeletonRow({ cols = 7 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <Skeleton height={13} width={i === 0 ? 160 : 90} />
        </td>
      ))}
    </tr>
  )
}

// Small product thumb
function ProductThumb({ url, name }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: url ? 'transparent' : '#F0F4F8', border: '1px solid #E5EBF2', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={13} color="#D5DFE9" />}
    </div>
  )
}

// Tab bar
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F0F4F8', borderRadius: 12, padding: 4, width: 'fit-content' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: active === t ? '#fff' : 'transparent', color: active === t ? '#1C2B3A' : '#8A9AB5', boxShadow: active === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
          {t}
        </button>
      ))}
    </div>
  )
}

// Stat card
function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5EBF2', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      {loading ? <Skeleton height={28} width={60} /> : <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>}
    </div>
  )
}

// Inline "Add new" quick-create for category/supplier
function QuickAddInline({ label, placeholder, onAdd, loading }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  return (
    <div style={{ marginTop: 4 }}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 11, color: '#1A3FA6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          + Add new {label.toLowerCase()}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(''); setOpen(false) } } }}
            style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #D5DFE9', borderRadius: 6, outline: 'none' }}
            autoFocus
          />
          <button type="button" disabled={!val.trim() || loading}
            onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); setOpen(false) } }}
            style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, background: '#0A1628', color: '#E8A020', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {loading ? '…' : 'Add'}
          </button>
          <button type="button" onClick={() => { setOpen(false); setVal('') }} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', borderRadius: 4 }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab (unchanged from v2)
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ products, loading }) {
  const categoryData = useMemo(() => {
    const map = {}
    products.forEach(p => {
      const cat = p.category?.name ?? 'Uncategorised'
      if (!map[cat]) map[cat] = { count: 0, value: 0, lowStock: 0 }
      map[cat].count++
      if (p.stock_status === 'low' || p.stock_status === 'out') map[cat].lowStock++
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
  }, [products])

  const marginData = useMemo(() =>
    products.filter(p => p.cost_price > 0)
      .map(p => ({ name: p.name, margin: Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100) }))
      .sort((a, b) => b.margin - a.margin).slice(0, 8),
    [products]
  )

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={24} /></div>
  const maxCount  = Math.max(...categoryData.map(d => d[1].count), 1)
  const maxMargin = Math.max(...marginData.map(d => d.margin), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>Products by Category</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categoryData.map(([cat, data]) => (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#3A4A5C', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{cat}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {data.lowStock > 0 && <span style={{ fontSize: 11, color: '#C45A00', fontWeight: 600 }}>{data.lowStock} low</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2B3A' }}>{data.count}</span>
                </div>
              </div>
              <div style={{ height: 5, background: '#F0F4F8', borderRadius: 4 }}>
                <div style={{ width: `${(data.count / maxCount) * 100}%`, height: '100%', background: '#E8A020', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>Top Products by Margin %</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {marginData.map((p, i) => (
            <div key={p.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#3A4A5C', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{i + 1}. {p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.margin >= 30 ? '#1A6E3A' : p.margin >= 15 ? '#C45A00' : '#C0392B' }}>{p.margin}%</span>
              </div>
              <div style={{ height: 5, background: '#F0F4F8', borderRadius: 4 }}>
                <div style={{ width: `${(p.margin / maxMargin) * 100}%`, height: '100%', background: p.margin >= 30 ? '#1A6E3A' : '#E8A020', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ padding: 24, gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>Inventory Health Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Well Stocked', color: '#1A6E3A', bg: '#EAF5EE', fn: p => p.stock_status === 'ok' },
            { label: 'Low Stock',    color: '#C45A00', bg: '#FEF0E6', fn: p => p.stock_status === 'low' },
            { label: 'Out of Stock', color: '#C0392B', bg: '#FDECEA', fn: p => p.stock_status === 'out' },
            { label: 'Not Tracked',  color: '#6B7A8D', bg: '#F0F4F8', fn: p => !p.stock_status || p.stock_status === 'unknown' },
          ].map(({ label, color, bg, fn }) => {
            const count = products.filter(fn).length
            const pct   = products.length ? Math.round((count / products.length) * 100) : 0
            return (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 6 }}>{count}</div>
                <div style={{ fontSize: 12, color: `${color}99`, marginTop: 2 }}>{pct}% of catalog</div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ProductsPage
// ─────────────────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const queryClient = useQueryClient()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  // Re-fetch products when branch changes
  const branchId = user?.branch_id
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }, [branchId, queryClient])

  // Tabs
  const [activeTab, setActiveTab] = useState('Product List')

  // Catalog filters
  const [search, setSearch]               = useState('')
  const [debouncedSearch]                 = useDebounce(search, 300)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [activeOnly, setActiveOnly]       = useState(true)
  const [page, setPage]                   = useState(1)

  // Modals
  const [productModal, setProductModal]   = useState(false)
  const [editProduct, setEditProduct]     = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [bulkModal, setBulkModal]         = useState(false)
  const [bulkMode, setBulkMode]           = useState('multi') // 'multi' | 'upload'
  const [selectedForBulk, setSelectedForBulk] = useState([])
  const [bulkValue, setBulkValue]         = useState('')
  const [bulkType, setBulkType]           = useState('percentage')
  const [bulkCatFilter, setBulkCatFilter] = useState('')
  const [bulkFile, setBulkFile]           = useState(null)
  const [exportModal, setExportModal]     = useState(false)
  const [importModal, setImportModal]     = useState(false)
  const [importFile, setImportFile]       = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importStep, setImportStep]       = useState(1)

  // Export filters
  const [exportBranch, setExportBranch]   = useState('')
  const [exportCategory, setExportCategory] = useState('')
  const [exportBrand, setExportBrand]     = useState('')
  const [exportPriceMin, setExportPriceMin] = useState('')
  const [exportPriceMax, setExportPriceMax] = useState('')

  // Product image upload within modal
  const [pendingImage, setPendingImage]   = useState(null) // file

  const importRef  = useRef(null)
  const bulkUpRef  = useRef(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const productsQ = useQuery({
    queryKey: ['products', { q: debouncedSearch, category_id: categoryFilter, supplier_id: supplierFilter, status: statusFilter, active_only: activeOnly, page, branch: branchId }],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { search: debouncedSearch || undefined, category_id: categoryFilter || undefined, supplier_id: supplierFilter || undefined, active_only: activeOnly, page, per_page: 20 },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const allProductsQ = useQuery({
    queryKey: ['products-all-analytics', branchId],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, per_page: 500, active_only: false } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
    enabled: activeTab !== 'Product List',
  })

  const categoriesQ = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const suppliersQ = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { per_page: 200 } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const unitsQ = useQuery({
    queryKey: ['units', 'all'],
    queryFn: async () => {
      const res = await api.get('/units', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 600_000,
  })

  const brandsQ = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: async () => {
      const res = await api.get('/brands', { params: { all: true, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const branchesQ = useQuery({
    queryKey: ['branches', 'all'],
    enabled: isAdminLike,
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const products   = productsQ.data?.data ?? []
  const meta       = productsQ.data?.meta
  const categories = categoriesQ.data ?? []
  const suppliers  = suppliersQ.data ?? []
  const units      = unitsQ.data ?? []
  const brands     = brandsQ.data ?? []
  const branches   = branchesQ.data ?? []
  const allProducts = allProductsQ.data ?? []

  // Stats
  const stats = useMemo(() => ({
    total:     meta?.total ?? 0,
    lowStock:  products.filter(p => p.stock_status === 'low').length,
    outStock:  products.filter(p => p.stock_status === 'out').length,
    untracked: products.filter(p => !p.stock_status || p.stock_status === 'unknown').length,
  }), [products, meta])

  // ── Product form ───────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(productSchema),
  })

  function openCreate() {
    setEditProduct(null)
    setPendingImage(null)
    reset({ name: '', sku: '', barcode: '', description: '', category_id: null, supplier_id: null, brand_id: null, cost_price: '', selling_price: '', unit: 'pcs', reorder_level: 10, is_active: true, is_vat_exempt: false })
    setProductModal(true)
  }

  function openEdit(p) {
    setEditProduct(p)
    setPendingImage(null)
    reset({ name: p.name, sku: p.sku, barcode: p.barcode ?? '', description: p.description ?? '', category_id: p.category_id ?? null, supplier_id: p.supplier_id ?? null, brand_id: p.brand_id ?? null, cost_price: p.cost_price, selling_price: p.selling_price, unit: p.unit ?? 'pcs', reorder_level: p.reorder_level ?? 10, is_active: p.is_active, is_vat_exempt: p.is_vat_exempt })
    setProductModal(true)
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (data) => {
      const p = { ...data }
      if (!p.category_id) p.category_id = null
      if (!p.supplier_id) p.supplier_id = null
      if (!p.brand_id)    p.brand_id    = null
      const res = editProduct
        ? await api.put(`/products/${editProduct.id}`, p)
        : await api.post('/products', p)
      // Upload image if selected
      if (pendingImage) {
        const fd = new FormData()
        fd.append('image', pendingImage)
        await api.post(`/products/${res.data?.data?.id ?? editProduct.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(editProduct ? 'Product updated' : 'Product created')
      setProductModal(false)
    },
    onError: e => toast.error(e.response?.data?.message ?? e.message ?? 'Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted'); setDeleteTarget(null) },
    onError: e => toast.error(e.response?.data?.message ?? 'Cannot delete'),
  })

  // Quick-add category inline
  const addCategoryMut = useMutation({
    mutationFn: name => api.post('/categories', { name, is_active: true }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      const newCat = res.data?.data
      if (newCat) setValue('category_id', newCat.id)
      toast.success('Category added')
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  // Quick-add supplier inline
  const addSupplierMut = useMutation({
    mutationFn: name => api.post('/suppliers', { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      const newSup = res.data?.data
      if (newSup) setValue('supplier_id', newSup.id)
      toast.success('Supplier added')
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  // Bulk price update
  const bulkMut = useMutation({
    mutationFn: data => api.post('/products/bulk-price-update', data),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(res.data?.message ?? 'Prices updated')
      setBulkModal(false)
      setSelectedForBulk([])
      setBulkValue('')
      setBulkFile(null)
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Update failed'),
  })

  // Import
  const importMut = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(res.data?.message ?? 'Import complete')
      setImportModal(false)
      setImportFile(null)
      setImportPreview(null)
      setImportStep(1)
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Import failed'),
  })

  const previewMut = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/products/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      setImportPreview(res.data?.data)
      setImportStep(2)
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Preview failed'),
  })

  // ── Bulk price toggle ──────────────────────────────────────────────────────
  function toggleBulkProduct(id) {
    setSelectedForBulk(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function applyBulkUpdate() {
    if (bulkMode === 'upload' && bulkFile) {
      const fd = new FormData()
      fd.append('file', bulkFile)
      bulkMut.mutate(fd)
    } else {
      if (!bulkValue) { toast.error('Enter a value'); return }
      const payload = {
        type:        bulkType,
        value:       parseFloat(bulkValue),
        category_id: bulkCatFilter || undefined,
        product_ids: selectedForBulk.length > 0 ? selectedForBulk : undefined,
        reason:      'Bulk price update',
      }
      bulkMut.mutate(payload)
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  async function doExport() {
    try {
      const params = new URLSearchParams()
      if (exportBranch)      params.append('branch_id', exportBranch)
      if (exportCategory)    params.append('category_id', exportCategory)
      if (exportBrand)       params.append('brand_id', exportBrand)
      if (exportPriceMin)    params.append('price_min', exportPriceMin)
      if (exportPriceMax)    params.append('price_max', exportPriceMax)
      params.append('all', 'true')

      const res = await api.get('/products/export', { params: Object.fromEntries(params), responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a   = document.createElement('a')
      a.href = url; a.download = `edlp-products-${new Date().toISOString().slice(0, 10)}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast.success('Catalog exported')
      setExportModal(false)
    } catch { toast.error('Export failed') }
  }

  // ── CSV template download ──────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = ['name*', 'sku*', 'barcode', 'category_id', 'supplier_id', 'cost_price*', 'selling_price*', 'unit', 'reorder_level', 'description', 'is_active', 'is_vat_exempt']
    const example = ['Indomie Chicken 70g', 'IND-CHK-70G', '8901491501234', '1', '2', '320', '550', 'pcs', '10', 'Instant noodles', 'true', 'false']
    const csv = [headers, example].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a   = document.createElement('a')
    a.href = url; a.download = 'edlp-products-import-template.csv'
    a.click(); URL.revokeObjectURL(url)
    toast.success('Template downloaded')
  }

  // ── Table columns — using col.cell() to match DataTable ───────────────────
  const columns = useMemo(() => [
    {
      key: 'name', header: 'Product',
      cell: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProductThumb url={p.thumbnail_url} name={p.name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>{p.category?.name ?? <span style={{ fontStyle: 'italic' }}>No category</span>}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'sku', header: 'SKU / Barcode',
      cell: p => (
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1A3FA6' }}>{p.sku}</div>
          {p.barcode && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#8A9AB5' }}>{p.barcode}</div>}
        </div>
      ),
    },
    {
      key: 'price', header: 'Price',
      cell: p => (
        <div>
          <div style={{ fontWeight: 700, color: '#1A6E3A', fontSize: 13 }}>{money(p.selling_price)}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>Cost: {money(p.cost_price)}</div>
        </div>
      ),
    },
    {
      key: 'stock', header: 'Stock Level',
      cell: p => {
        // Stock comes from inventory eager-loaded on this branch
        const qty = p.stock
        if (qty === null || qty === undefined) {
          return <span style={{ fontSize: 11, color: '#C8D4E0', fontStyle: 'italic' }}>Untracked</span>
        }
        const reorder  = p.reorder_level ?? 10
        const isOut    = qty <= 0
        const isLow    = qty > 0 && qty <= reorder
        const barColor = isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A'
        const barPct   = reorder > 0 ? Math.min(100, Math.round((qty / (reorder * 2)) * 100)) : 0
        return (
          <div style={{ minWidth: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{qty}</span>
              <span style={{ fontSize: 10, color: '#8A9AB5' }}>/{reorder}</span>
            </div>
            <div style={{ height: 4, background: '#F0F4F8', borderRadius: 3 }}>
              <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Status',
      cell: p => {
        const cfg = {
          ok:      { label: 'In Stock',   color: '#1A6E3A', bg: '#EAF5EE' },
          low:     { label: 'Low Stock',  color: '#C45A00', bg: '#FEF0E6' },
          out:     { label: 'Out',        color: '#C0392B', bg: '#FDECEA' },
          unknown: { label: 'Untracked',  color: '#6B7A8D', bg: '#F0F4F8' },
        }[p.stock_status ?? 'unknown']
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, width: 'fit-content' }}>{cfg.label}</span>
            {!p.is_active && <span style={{ fontSize: 10, color: '#8A9AB5', fontWeight: 600 }}>Inactive</span>}
          </div>
        )
      },
    },
    ...(isAdminLike ? [{
      key: 'actions', header: '',
      cell: p => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="Edit" onClick={e => { e.stopPropagation(); openEdit(p) }}
            style={{ padding: 5, borderRadius: 6, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#1A3FA6', display: 'flex', alignItems: 'center' }}>
            <Pencil size={13} />
          </button>
          <button title="Delete" onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
            style={{ padding: 5, borderRadius: 6, border: '1px solid #FDECEA', background: 'transparent', cursor: 'pointer', color: '#C0392B', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    }] : []),
  ], [isAdminLike])

  // Bulk select column for bulk-price mode
  const bulkColumns = [
    {
      key: 'sel', header: (
        <input type="checkbox" checked={selectedForBulk.length === products.length && products.length > 0}
          onChange={e => setSelectedForBulk(e.target.checked ? products.map(p => p.id) : [])} />
      ),
      cell: p => <input type="checkbox" checked={selectedForBulk.includes(p.id)} onChange={() => toggleBulkProduct(p.id)} onClick={e => e.stopPropagation()} />,
    },
    { key: 'name', header: 'Product', cell: p => <span style={{ fontWeight: 600 }}>{p.name}</span> },
    { key: 'price', header: 'Current Price', cell: p => money(p.selling_price) },
    { key: 'cat', header: 'Category', cell: p => p.category?.name ?? '—' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ShimmerStyle />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1C2B3A' }}>Product Catalog</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8A9AB5' }}>
            {user?.branch ? `${user.branch.name} · ` : ''}Manage products, pricing, stock levels and analytics.
          </p>
        </div>
        {isAdminLike && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setExportModal(true)}><Download size={14} /> Export CSV</Btn>
            <Btn variant="ghost" onClick={() => { setImportStep(1); setImportFile(null); setImportPreview(null); setImportModal(true) }}><Upload size={14} /> Import CSV</Btn>
            <Btn variant="ghost" onClick={() => setBulkModal(true)}><Tag size={14} /> Bulk Price Update</Btn>
            <Btn onClick={openCreate}><Plus size={14} /> Add Product</Btn>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard icon={Layers}        label="Total Products" value={stats.total}     color="#1A3FA6" loading={productsQ.isLoading} />
        <StatCard icon={Package}       label="Low Stock"      value={stats.lowStock}  color="#C45A00" loading={productsQ.isLoading} />
        <StatCard icon={AlertTriangle} label="Out of Stock"   value={stats.outStock}  color="#C0392B" loading={productsQ.isLoading} />
        <StatCard icon={TrendingUp}    label="Untracked"      value={stats.untracked} color="#6B7A8D" loading={productsQ.isLoading} />
      </div>

      {/* Tabs */}
      <Tabs tabs={['Product List', 'Price History', 'Analytics']} active={activeTab} onChange={t => { setActiveTab(t); setPage(1) }} />

      {/* ── CATALOG TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'Product List' && (
        <Card style={{ padding: 0 }}>
          {/* Filters */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5', pointerEvents: 'none' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, SKU, barcode…"
                style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C' }}
                onFocus={e => e.target.style.borderColor = '#E8A020'} onBlur={e => e.target.style.borderColor = '#E5EBF2'} />
            </div>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, color: '#3A4A5C', background: '#fff', outline: 'none' }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1) }}
              style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 8, color: '#3A4A5C', background: '#fff', outline: 'none' }}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {[{ v: '', label: 'All' }, { v: 'ok', label: 'In Stock' }, { v: 'low', label: 'Low' }, { v: 'out', label: 'Out' }].map(({ v, label }) => (
              <button key={v} onClick={() => { setStatusFilter(v); setPage(1) }}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: statusFilter === v ? '#0A1628' : '#F0F4F8', color: statusFilter === v ? '#fff' : '#6B7A8D', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#6B7A8D', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1) }} style={{ accentColor: '#E8A020', width: 13, height: 13 }} />
              Active only
            </label>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} style={{ padding: 7, borderRadius: 7, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#8A9AB5', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Table */}
          {productsQ.isLoading ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #F0F4F8' }}>{['Product','SKU / Barcode','Price','Stock Level','Status',''].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
              <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}</tbody>
            </table>
          ) : (
            <DataTable
              columns={columns}
              rows={products}
              rowKey={p => p.id}
              loading={false}
              emptyMessage="No products match your filters. Try adjusting search or category."
              pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
            />
          )}
        </Card>
      )}

      {/* ── PRICE HISTORY TAB ────────────────────────────────────────────── */}
      {activeTab === 'Price History' && (
        <Card style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
                  {['Product', 'SKU', 'Cost Price', 'Selling Price', 'Margin', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allProductsQ.isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : allProducts.map(p => {
                      const margin = p.cost_price > 0 ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100) : null
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FAFBFD'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1C2B3A' }}>{p.name}</td>
                          <td style={{ padding: '11px 14px' }}><code style={{ fontSize: 12, color: '#6B7A8D' }}>{p.sku}</code></td>
                          <td style={{ padding: '11px 14px', fontWeight: 600 }}>{money(p.cost_price)}</td>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1A6E3A' }}>{money(p.selling_price)}</td>
                          <td style={{ padding: '11px 14px' }}>
                            {margin !== null
                              ? <span style={{ fontSize: 12, fontWeight: 700, color: margin >= 20 ? '#1A6E3A' : margin >= 10 ? '#C45A00' : '#C0392B', background: margin >= 20 ? '#EAF5EE' : margin >= 10 ? '#FEF0E6' : '#FDECEA', padding: '2px 8px', borderRadius: 20 }}>{margin}%</span>
                              : '—'}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: p.is_active ? '#1A6E3A' : '#8A9AB5', background: p.is_active ? '#EAF5EE' : '#F0F4F8', padding: '2px 8px', borderRadius: 20 }}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'Analytics' && <AnalyticsTab products={allProducts} loading={allProductsQ.isLoading} />}

      {/* ══════════════════════════════════════════════════════════════════
          CREATE / EDIT PRODUCT MODAL
          ══════════════════════════════════════════════════════════════════ */}
      <Modal open={productModal} onClose={() => setProductModal(false)}
        title={editProduct ? `Edit: ${editProduct.name}` : 'Add New Product'} width={700}
        footer={<>
          <Btn variant="ghost" onClick={() => setProductModal(false)} disabled={saveMut.isPending}>Cancel</Btn>
          <Btn onClick={handleSubmit(d => saveMut.mutate(d))} disabled={saveMut.isPending}>
            {saveMut.isPending ? <><Spinner size={12} /> Saving…</> : editProduct ? 'Save Changes' : 'Create Product'}
          </Btn>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Image upload strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #D5DFE9' }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', border: '1px solid #E5EBF2', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
              {pendingImage
                ? <img src={URL.createObjectURL(pendingImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : editProduct?.thumbnail_url
                  ? <img src={editProduct.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <ImageIcon size={20} color="#D5DFE9" />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', marginBottom: 2 }}>Product Image</div>
              <div style={{ fontSize: 11, color: '#8A9AB5' }}>JPEG / PNG / WebP · max 2 MB · optional</div>
            </div>
            <label style={{ padding: '7px 16px', background: '#0A1628', color: '#E8A020', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={13} /> {pendingImage ? 'Change' : 'Upload'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setPendingImage(e.target.files[0]) }} />
            </label>
            {pendingImage && <button type="button" onClick={() => setPendingImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}><X size={14} /></button>}
          </div>

          {/* Section: Basic Info */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Basic Information</div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FormField label="Product Name *" error={errors.name?.message}>
              <FormInput register={register('name')} placeholder="e.g. Indomie Chicken Noodles 70g" />
            </FormField>
            <FormField label="SKU *" error={errors.sku?.message} hint="Unique stock code">
              <FormInput register={register('sku')} placeholder="IND-CHK-70G" />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Barcode / EAN">
              <FormInput register={register('barcode')} placeholder="8901491501234" />
            </FormField>
            {/* Unit of Measure — DROPDOWN from /api/units */}
            <FormField label="Unit of Measure">
              <FormSelect register={register('unit')}>
                <option value="">Select unit…</option>
                {units.map(u => <option key={u.id} value={u.short_code}>{u.name} ({u.short_code})</option>)}
                <option value="other">Other (type below)</option>
              </FormSelect>
              {watch('unit') === 'other' && (
                <FormInput register={register('unit')} placeholder="Custom unit…" style={{ marginTop: 6 }} />
              )}
            </FormField>
          </div>

          {/* Category + Supplier + Brand — with inline add */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <FormField label="Category">
                <FormSelect register={register('category_id')}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </FormSelect>
              </FormField>
              <QuickAddInline label="Category" placeholder="New category name" onAdd={name => addCategoryMut.mutate(name)} loading={addCategoryMut.isPending} />
            </div>
            <div>
              <FormField label="Supplier">
                <FormSelect register={register('supplier_id')}>
                  <option value="">No supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </FormSelect>
              </FormField>
              <QuickAddInline label="Supplier" placeholder="New supplier name" onAdd={name => addSupplierMut.mutate(name)} loading={addSupplierMut.isPending} />
            </div>
            <FormField label="Brand">
              <FormSelect register={register('brand_id')}>
                <option value="">No brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <div style={{ height: 1, background: '#F0F4F8' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pricing & Inventory</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Cost Price (₦) *" error={errors.cost_price?.message}>
              <FormInput register={register('cost_price')} type="number" step="0.01" min="0" placeholder="500.00" />
            </FormField>
            <FormField label="Selling Price (₦) *" error={errors.selling_price?.message}>
              <FormInput register={register('selling_price')} type="number" step="0.01" min="0" placeholder="750.00" />
            </FormField>
            <FormField label="Reorder Level" hint="Alert threshold">
              <FormInput register={register('reorder_level')} type="number" min={0} placeholder="10" />
            </FormField>
          </div>

          {/* Live margin preview */}
          {(() => {
            const cp = parseFloat(watch('cost_price') || 0)
            const sp = parseFloat(watch('selling_price') || 0)
            if (cp > 0 && sp > 0) {
              const margin = Math.round(((sp - cp) / sp) * 100)
              const profit = sp - cp
              return (
                <div style={{ display: 'flex', gap: 16, padding: '10px 14px', background: margin >= 20 ? '#EAF5EE' : margin >= 10 ? '#FEF0E6' : '#FDECEA', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: '#8A9AB5' }}>Gross Margin:</span>
                  <span style={{ fontWeight: 700, color: margin >= 20 ? '#1A6E3A' : margin >= 10 ? '#C45A00' : '#C0392B' }}>{margin}%</span>
                  <span style={{ color: '#8A9AB5' }}>Profit per unit:</span>
                  <span style={{ fontWeight: 700, color: margin >= 20 ? '#1A6E3A' : margin >= 10 ? '#C45A00' : '#C0392B' }}>{money(profit)}</span>
                </div>
              )
            }
            return null
          })()}

          <FormField label="Description">
            <textarea {...register('description')} rows={2} placeholder="Optional product description…"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = '#E8A020'} onBlur={e => e.target.style.borderColor = '#D5DFE9'} />
          </FormField>

          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_active')} style={{ width: 14, height: 14, accentColor: '#E8A020' }} /> Active product
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_vat_exempt')} style={{ width: 14, height: 14, accentColor: '#E8A020' }} /> VAT Exempt
            </label>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          BULK PRICE UPDATE MODAL — does NOT close on backdrop click
          ══════════════════════════════════════════════════════════════════ */}
      {bulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()} /* NEVER close on backdrop */>
          <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(10,22,40,0.25)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>Bulk Price Update</div>
                <div style={{ fontSize: 12, color: '#8A9AB5', marginTop: 2 }}>Update multiple product prices at once</div>
              </div>
              <button onClick={() => setBulkModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 4, borderRadius: 6 }}><X size={18} /></button>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #F0F4F8', flexShrink: 0 }}>
              {[{ id: 'multi', label: '🔢 Select Products', desc: 'Pick products manually' }, { id: 'upload', label: '📁 Upload File', desc: 'CSV / Excel bulk update' }].map(m => (
                <button key={m.id} onClick={() => setBulkMode(m.id)} style={{ flex: 1, padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: bulkMode === m.id ? '2px solid #E8A020' : '2px solid transparent', color: bulkMode === m.id ? '#1C2B3A' : '#8A9AB5', fontWeight: 600, fontSize: 13, textAlign: 'left', marginBottom: -1 }}>
                  {m.label}<div style={{ fontSize: 10, fontWeight: 400, color: '#B0BCC8', marginTop: 1 }}>{m.desc}</div>
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {bulkMode === 'multi' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>Update Type *</label>
                      <select value={bulkType} onChange={e => setBulkType(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
                        <option value="percentage">% Percentage adjustment</option>
                        <option value="fixed">₦ Set fixed price</option>
                        <option value="markup">% Markup on cost</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>Value * {bulkType === 'percentage' ? '(e.g. 10 = +10%)' : bulkType === 'markup' ? '(e.g. 40 = 40% markup)' : '(New price ₦)'}</label>
                      <input type="number" step="0.01" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder={bulkType === 'percentage' ? '10' : '750'} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C', display: 'block', marginBottom: 6 }}>Filter by Category</label>
                      <select value={bulkCatFilter} onChange={e => { setBulkCatFilter(e.target.value); setSelectedForBulk([]) }} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#8A9AB5', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: '#1A3FA6' }}>{selectedForBulk.length || 'All'}</span> {selectedForBulk.length === 1 ? 'product' : 'products'} selected · Select individually below or leave unchecked to apply to all visible products
                  </div>
                  <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #F0F4F8', borderRadius: 8 }}>
                    <DataTable columns={bulkColumns} rows={products.filter(p => !bulkCatFilter || p.category_id === parseInt(bulkCatFilter))} rowKey={p => p.id} loading={productsQ.isLoading} emptyMessage="No products." />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ padding: '12px 16px', background: '#EAF0FB', borderRadius: 10, fontSize: 13, color: '#1A3FA6' }}>
                    Upload a CSV or Excel file with columns: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>sku</code>, <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>selling_price</code>. Download the template to get started.
                  </div>
                  <Btn variant="ghost" onClick={downloadTemplate}><Download size={13} /> Download CSV Template</Btn>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 20px', border: '2px dashed #D5DFE9', borderRadius: 12, cursor: 'pointer', background: bulkFile ? '#F0F9F4' : '#F8FAFC' }}>
                    <FileSpreadsheet size={36} color={bulkFile ? '#1A6E3A' : '#C8D4E0'} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: bulkFile ? '#1A6E3A' : '#3A4A5C' }}>{bulkFile ? bulkFile.name : 'Drop CSV or Excel file here'}</div>
                      <div style={{ fontSize: 12, color: '#8A9AB5', marginTop: 4 }}>or click to browse · .csv, .xlsx</div>
                    </div>
                    <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} ref={bulkUpRef}
                      onChange={e => { if (e.target.files?.[0]) setBulkFile(e.target.files[0]) }} />
                  </label>
                  {bulkFile && <Btn variant="ghost" onClick={() => setBulkFile(null)}><X size={13} /> Remove file</Btn>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #F0F4F8', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
              <Btn variant="ghost" onClick={() => setBulkModal(false)}>Cancel</Btn>
              <Btn onClick={applyBulkUpdate} disabled={bulkMut.isPending || (bulkMode === 'upload' && !bulkFile) || (bulkMode === 'multi' && !bulkValue)}>
                {bulkMut.isPending ? <><Spinner size={12} /> Updating…</> : 'Apply Price Update'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EXPORT CSV MODAL — with filters
          ══════════════════════════════════════════════════════════════════ */}
      <Modal open={exportModal} onClose={() => setExportModal(false)} title="Export Product Catalog" width={500}
        footer={<>
          <Btn variant="ghost" onClick={() => setExportModal(false)}>Cancel</Btn>
          <Btn onClick={doExport}><Download size={13} /> Download CSV</Btn>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: '#EAF0FB', borderRadius: 8, fontSize: 12, color: '#1A3FA6' }}>
            Filter the export by branch, category, brand and price range. Leave filters blank to export the full catalogue.
          </div>
          {isAdminLike && branches.length > 0 && (
            <FormField label="Branch">
              <FormSelect register={{ name: 'exportBranch', onChange: e => setExportBranch(e.target.value), ref: () => {} }} value={exportBranch}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Category">
              <select value={exportCategory} onChange={e => setExportCategory(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Brand">
              <select value={exportBrand} onChange={e => setExportBrand(e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', background: '#fff' }}>
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Min Selling Price (₦)">
              <input type="number" min={0} value={exportPriceMin} onChange={e => setExportPriceMin(e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </FormField>
            <FormField label="Max Selling Price (₦)">
              <input type="number" min={0} value={exportPriceMax} onChange={e => setExportPriceMax(e.target.value)} placeholder="Unlimited" style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          IMPORT CSV MODAL — step-by-step with template download
          ══════════════════════════════════════════════════════════════════ */}
      <Modal open={importModal} onClose={() => { setImportModal(false); setImportStep(1); setImportFile(null); setImportPreview(null) }}
        title="Import Products from CSV" width={640}
        footer={
          importStep === 1 ? (
            <>
              <Btn variant="ghost" onClick={() => setImportModal(false)}>Cancel</Btn>
              <Btn onClick={() => { if (importFile) previewMut.mutate(importFile) }} disabled={!importFile || previewMut.isPending}>
                {previewMut.isPending ? <><Spinner size={12} /> Previewing…</> : 'Preview Import →'}
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="ghost" onClick={() => { setImportStep(1); setImportPreview(null) }}>← Back</Btn>
              <Btn onClick={() => importMut.mutate(importFile)} disabled={importMut.isPending}>
                {importMut.isPending ? <><Spinner size={12} /> Importing…</> : `Confirm Import (${importPreview?.rows?.length ?? 0} rows)`}
              </Btn>
            </>
          )
        }
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
          {[{ n: 1, label: 'Upload File' }, { n: 2, label: 'Preview' }, { n: 3, label: 'Done' }].map(s => (
            <div key={s.n} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: importStep >= s.n ? '#0A1628' : '#F0F4F8', color: importStep >= s.n ? '#E8A020' : '#8A9AB5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, margin: '0 auto 4px' }}>{s.n}</div>
              <div style={{ fontSize: 11, color: importStep >= s.n ? '#1C2B3A' : '#8A9AB5', fontWeight: importStep === s.n ? 700 : 400 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {importStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: '#EAF0FB', borderRadius: 10, fontSize: 12, color: '#1A3FA6' }}>
              <strong>Required columns:</strong> name, sku, cost_price, selling_price<br />
              <strong>Optional:</strong> barcode, category_id, supplier_id, unit, reorder_level, description, is_active
            </div>
            <Btn variant="ghost" onClick={downloadTemplate}><Download size={13} /> Download CSV Template</Btn>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 20px', border: `2px dashed ${importFile ? '#1A6E3A' : '#D5DFE9'}`, borderRadius: 12, cursor: 'pointer', background: importFile ? '#EAF5EE' : '#F8FAFC' }}>
              <Upload size={32} color={importFile ? '#1A6E3A' : '#C8D4E0'} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: importFile ? '#1A6E3A' : '#3A4A5C' }}>{importFile ? importFile.name : 'Drop CSV file here or click to browse'}</div>
                <div style={{ fontSize: 12, color: '#8A9AB5', marginTop: 3 }}>.csv or .txt · max 5 MB</div>
              </div>
              <input type="file" accept=".csv,.txt" style={{ display: 'none' }} ref={importRef}
                onChange={e => { if (e.target.files?.[0]) setImportFile(e.target.files[0]) }} />
            </label>
            {importFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#EAF5EE', borderRadius: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#1A6E3A' }}>✓ {importFile.name}</span>
                <span style={{ color: '#8A9AB5' }}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={() => { setImportFile(null); if (importRef.current) importRef.current.value = '' }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}><X size={12} /></button>
              </div>
            )}
          </div>
        )}

        {importStep === 2 && importPreview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 14px', background: '#EAF5EE', borderRadius: 8, fontSize: 12, color: '#1A6E3A' }}>
              <strong>Preview — first {importPreview.rows?.length ?? 0} rows shown.</strong> Review before confirming import.
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid #F0F4F8', borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                  <tr>
                    {(importPreview.headers ?? []).map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', fontSize: 10, letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid #F0F4F8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(importPreview.rows ?? []).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '0.5px solid #F8FAFC' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '7px 12px', color: '#3A4A5C', whiteSpace: 'nowrap' }}>{cell ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: '#8A9AB5' }}>Showing first {importPreview.rows?.length ?? 0} rows · Duplicate SKUs will be skipped</div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget?.id)}
        loading={deleteMut.isPending}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? Products with sales history cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete Product"
      />
    </div>
  )
}
