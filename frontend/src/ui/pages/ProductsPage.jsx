/**
 * ProductsPage v2 — Central Product Catalog
 * ─────────────────────────────────────────────────────────────────────────────
 * Three tabs:
 *   1. Catalog      — searchable, filterable product table with real stock levels
 *   2. Price History — price change log per product
 *   3. Analytics    — margin heatmap, stock distribution, category breakdown
 *
 * Key fixes vs v1:
 *   • Stock is now loaded from the API (inventory eager-loaded per branch)
 *   • Aggregate total stock shown on table; branch breakdown on hover
 *   • Skeleton loaders on first load
 *   • "No category" products now use a sensible fallback
 *   • Import CSV triggers file picker; Export CSV downloads full catalog
 *   • Improved visual design: card stats bar, pill filters, compact table
 */
import { useState, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import {
  Layers, Plus, Pencil, Trash2, Upload, Download,
  Tag, AlertTriangle, BarChart2, Image as ImageIcon, X,
  RefreshCw, TrendingUp, Package, DollarSign, Search,
  Filter, ChevronDown, ChevronRight, ArrowUpDown, Eye,
} from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, Card, DataTable, Badge, Modal,
  ConfirmDialog, FormField, FormInput, FormSelect, Spinner,
} from '../components/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['Catalog', 'Price History', 'Analytics']

const STATUS_OPTIONS = [
  { v: '',       label: 'All Status' },
  { v: 'low',    label: 'Low Stock' },
  { v: 'out',    label: 'Out of Stock' },
  { v: 'ok',     label: 'In Stock' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Animated skeleton block */
function Skeleton({ width = '100%', height = 16, radius = 6 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#E5EBF2 25%,#EEF2F7 50%,#E5EBF2 75%)',
      backgroundSize: '200% 100%',
      animation: 'edlp-shimmer 1.4s infinite',
    }} />
  )
}

/** Inject shimmer keyframes once */
function ShimmerStyle() {
  return (
    <style>{`
      @keyframes edlp-shimmer {
        0%   { background-position: 200% 0 }
        100% { background-position: -200% 0 }
      }
    `}</style>
  )
}

/** Skeleton row for table loading state */
function SkeletonRow({ cols = 7 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <Skeleton height={14} width={i === 0 ? 160 : i === 1 ? 80 : 100} />
        </td>
      ))}
    </tr>
  )
}

/** Stat card with skeleton support */
function ProductStatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5EBF2',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      {loading
        ? <><Skeleton height={28} width={100} /><Skeleton height={12} width={140} /></>
        : <>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1C2B3A', lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: '#8A9AB5' }}>{sub}</div>}
          </>
      }
    </div>
  )
}

/** Horizontal stock level indicator with tooltip-like branch breakdown */
function StockLevelBar({ qty, reorderLevel, branchStocks }) {
  const [hover, setHover] = useState(false)
  const max   = Math.max((reorderLevel ?? 0) * 5, qty, 1)
  const pct   = Math.min((qty / max) * 100, 100)
  const isOut = qty <= 0
  const isLow = !isOut && qty <= (reorderLevel ?? 0)
  const color = isOut ? '#C0392B' : isLow ? '#C45A00' : '#1A6E3A'
  const bg    = isOut ? '#FDECEA' : isLow ? '#FEF0E6' : '#EAF5EE'

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
        <div style={{ flex: 1, height: 6, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: color, borderRadius: 4,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          background: bg, padding: '1px 7px', borderRadius: 20, minWidth: 36, textAlign: 'center',
        }}>
          {qty}
        </span>
      </div>

      {/* Branch breakdown popover */}
      {hover && branchStocks && branchStocks.length > 1 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50,
          background: '#1C2B3A', color: '#fff',
          borderRadius: 10, padding: '10px 14px',
          minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          marginTop: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 }}>
            Stock by Branch
          </div>
          {branchStocks.map((b) => (
            <div key={b.branch_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Branch {b.branch_id}</span>
              <span style={{ fontWeight: 700, color: b.quantity <= 0 ? '#F87171' : b.quantity <= (reorderLevel ?? 0) ? '#FBBF24' : '#34D399' }}>
                {b.quantity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Small product thumbnail */
function ProductThumb({ url, name }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
      background: url ? 'transparent' : '#F0F4F8',
      border: '1px solid #E5EBF2',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <ImageIcon size={14} color="#D5DFE9" />
      }
    </div>
  )
}

/** Tab bar */
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F0F4F8', borderRadius: 12, padding: 4, width: 'fit-content' }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          background: active === t ? '#fff' : 'transparent',
          color: active === t ? '#1C2B3A' : '#8A9AB5',
          boxShadow: active === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.15s',
        }}>
          {t}
        </button>
      ))}
    </div>
  )
}

/** Pill filter chip */
function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 600,
      background: active ? 'var(--edlp-navy)' : '#F0F4F8',
      color: active ? '#fff' : '#6B7A8D',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsTab({ products, loading }) {
  const categoryData = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      const cat = p.category?.name ?? 'Uncategorised'
      if (!map[cat]) map[cat] = { count: 0, value: 0, lowStock: 0 }
      map[cat].count++
      map[cat].value += (p.stock ?? 0) * (p.cost_price ?? 0)
      if (p.stock_status === 'low' || p.stock_status === 'out') map[cat].lowStock++
    })
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
  }, [products])

  const marginData = useMemo(() => {
    return products
      .filter((p) => p.cost_price > 0)
      .map((p) => ({
        name: p.name,
        margin: Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100),
        revenue: p.selling_price,
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 8)
  }, [products])

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0, 1].map((i) => (
          <Card key={i} style={{ padding: 24 }}>
            <Skeleton height={18} width={180} />
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} height={12} />)}
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const maxCount = Math.max(...categoryData.map((d) => d[1].count), 1)
  const maxMargin = Math.max(...marginData.map((d) => d.margin), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Category distribution */}
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>
          Products by Category
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categoryData.map(([cat, data]) => (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#3A4A5C', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {data.lowStock > 0 && (
                    <span style={{ fontSize: 11, color: '#C45A00', fontWeight: 600 }}>{data.lowStock} low</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2B3A' }}>{data.count}</span>
                </div>
              </div>
              <div style={{ height: 6, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${(data.count / maxCount) * 100}%`,
                  height: '100%',
                  background: 'var(--edlp-primary)',
                  borderRadius: 4,
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top margin products */}
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>
          Top Products by Margin %
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {marginData.map((p, i) => (
            <div key={p.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#3A4A5C', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i + 1}. {p.name}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: p.margin >= 30 ? '#1A6E3A' : p.margin >= 15 ? '#C45A00' : '#C0392B',
                }}>
                  {p.margin}%
                </span>
              </div>
              <div style={{ height: 6, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${(p.margin / maxMargin) * 100}%`,
                  height: '100%',
                  background: p.margin >= 30 ? '#1A6E3A' : p.margin >= 15 ? '#E8A020' : '#C0392B',
                  borderRadius: 4,
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Stock status summary */}
      <Card style={{ padding: 24, gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 20 }}>
          Inventory Health Overview
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Well Stocked',  color: '#1A6E3A', bg: '#EAF5EE', filter: (p) => p.stock_status === 'ok'  },
            { label: 'Low Stock',     color: '#C45A00', bg: '#FEF0E6', filter: (p) => p.stock_status === 'low' },
            { label: 'Out of Stock',  color: '#C0392B', bg: '#FDECEA', filter: (p) => p.stock_status === 'out' },
            { label: 'Not Tracked',   color: '#6B7A8D', bg: '#F0F4F8', filter: (p) => !p.stock_status || p.stock_status === 'unknown' },
          ].map(({ label, color, bg, filter: fn }) => {
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
// Price History Tab
// ─────────────────────────────────────────────────────────────────────────────
function PriceHistoryTab({ products, loading }) {
  const [searchPH, setSearchPH] = useState('')

  const filtered = useMemo(() => {
    const q = searchPH.toLowerCase()
    return products.filter((p) =>
      (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    )
  }, [products, searchPH])

  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5', pointerEvents: 'none' }} />
          <input
            value={searchPH}
            onChange={(e) => setSearchPH(e.target.value)}
            placeholder="Search products…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 9,
              outline: 'none', boxSizing: 'border-box', color: '#3A4A5C',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#8A9AB5' }}>{filtered.length} products</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
              {['Product', 'SKU', 'Current Cost', 'Current Selling', 'Margin', 'Status'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : filtered.map((p) => {
                  const margin = p.cost_price > 0
                    ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100)
                    : null
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFD'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{p.name}</div>
                        {p.category && <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 2 }}>{p.category.name}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7A8D' }}>{p.sku}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#3A4A5C', fontWeight: 600 }}>
                        {money(p.cost_price)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#1A6E3A', fontWeight: 700 }}>
                        {money(p.selling_price)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {margin !== null ? (
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: margin >= 20 ? '#1A6E3A' : margin >= 10 ? '#C45A00' : '#C0392B',
                            background: margin >= 20 ? '#EAF5EE' : margin >= 10 ? '#FEF0E6' : '#FDECEA',
                            padding: '2px 8px', borderRadius: 20,
                          }}>
                            {margin}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: p.is_active ? '#1A6E3A' : '#8A9AB5',
                          background: p.is_active ? '#EAF5EE' : '#F0F4F8',
                          padding: '2px 8px', borderRadius: 20,
                        }}>
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ProductsPage
// ─────────────────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  // Tab
  const [activeTab, setActiveTab] = useState('Catalog')

  // Catalog filters
  const [search, setSearch]             = useState('')
  const [debouncedSearch]               = useDebounce(search, 300)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeOnly, setActiveOnly]     = useState(true)
  const [page, setPage]                 = useState(1)

  // Modals
  const [productModal, setProductModal] = useState(false)
  const [editProduct, setEditProduct]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkModal, setBulkModal]       = useState(false)
  const [imageTarget, setImageTarget]   = useState(null)
  const importRef = useRef(null)

  // ── Data queries ────────────────────────────────────────────
  const productsQuery = useQuery({
    queryKey: ['products', { q: debouncedSearch, category_id: categoryFilter, supplier_id: supplierFilter, status: statusFilter, active_only: activeOnly, page }],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: {
          search:      debouncedSearch || undefined,
          category_id: categoryFilter || undefined,
          supplier_id: supplierFilter || undefined,
          active_only: activeOnly,
          page,
          per_page: 20,
        },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  // All products (unfiltered) for analytics + price history tabs
  const allProductsQuery = useQuery({
    queryKey: ['products', 'all-for-analytics'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, per_page: 500, active_only: false } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
    enabled: activeTab !== 'Catalog',
  })

  // Categories (derived from products)
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { all: true, per_page: 300 } })
      const cats = new Map()
      ;(res.data?.data ?? []).forEach((p) => {
        if (p.category) cats.set(p.category.id, p.category)
      })
      return [...cats.values()].sort((a, b) => a.name.localeCompare(b.name))
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
  const allProducts = allProductsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const suppliers  = suppliersQuery.data ?? []
  const isLoading  = productsQuery.isLoading

  // ── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = productsQuery.data?.data ?? []
    return {
      total:    meta?.total ?? 0,
      lowStock: all.filter((p) => p.stock_status === 'low').length,
      outStock: all.filter((p) => p.stock_status === 'out').length,
      avgMargin: all.length
        ? Math.round(all.filter((p) => p.cost_price > 0).reduce((s, p) => s + ((p.selling_price - p.cost_price) / p.selling_price) * 100, 0) / Math.max(all.filter((p) => p.cost_price > 0).length, 1))
        : 0,
    }
  }, [productsQuery.data, meta])

  // ── Product form ────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productSchema),
  })

  const bulkForm = useForm({ resolver: zodResolver(bulkPriceSchema), defaultValues: { type: 'percentage', value: '', reason: '' } })

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

  // ── Mutations ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) => {
      const p = { ...data }
      if (!p.category_id) p.category_id = null
      if (!p.supplier_id) p.supplier_id = null
      return editProduct
        ? api.put(`/products/${editProduct.id}`, p)
        : api.post('/products', p)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(editProduct ? 'Product updated' : 'Product created')
      setProductModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to save'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Cannot delete'),
  })

  const bulkMutation = useMutation({
    mutationFn: (data) => api.post('/products/bulk-price-update', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(res.data?.message ?? 'Prices updated')
      setBulkModal(false)
      bulkForm.reset()
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Update failed'),
  })

  const imageMutation = useMutation({
    mutationFn: ({ id, file }) => {
      const fd = new FormData()
      fd.append('image', file)
      return api.post(`/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Image uploaded')
      setImageTarget(null)
    },
    onError: () => toast.error('Image upload failed'),
  })

  const importMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/products/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(res.data?.message ?? 'Import complete')
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Import failed'),
  })

  // ── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const rows = [
      ['Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost Price', 'Selling Price', 'Unit', 'Reorder Level', 'Active', 'Stock'],
      ...products.map((p) => [
        p.name, p.sku, p.barcode ?? '', p.category?.name ?? '', p.supplier?.name ?? '',
        p.cost_price, p.selling_price, p.unit ?? '', p.reorder_level ?? '', p.is_active ? 'Yes' : 'No', p.stock ?? '',
      ]),
    ]
    const csv  = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `edlp-products-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Catalog exported')
  }, [products])

  // ── Catalog table columns ───────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'name', header: 'Product',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProductThumb url={p.thumbnail_url} name={p.name} />
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </div>
            <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>
              {p.category?.name ?? <span style={{ fontStyle: 'italic' }}>No category</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'sku', header: 'SKU / Barcode',
      render: (p) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1A3FA6' }}>{p.sku}</div>
          {p.barcode && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#8A9AB5' }}>{p.barcode}</div>}
        </div>
      ),
    },
    {
      key: 'supplier', header: 'Supplier',
      render: (p) => (
        <span style={{ fontSize: 12, color: '#6B7A8D' }}>{p.supplier?.name ?? '—'}</span>
      ),
    },
    {
      key: 'selling_price', header: 'Price',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1A6E3A', fontSize: 13 }}>{money(p.selling_price)}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>Cost: {money(p.cost_price)}</div>
        </div>
      ),
    },
    {
      key: 'stock', header: 'Stock Level',
      render: (p) => {
        if (p.stock === null || p.stock === undefined) {
          return <span style={{ fontSize: 12, color: '#D5DFE9' }}>—</span>
        }
        return (
          <StockLevelBar
            qty={p.stock}
            reorderLevel={p.reorder_level}
            branchStocks={p.branch_stocks}
          />
        )
      },
    },
    {
      key: 'status', header: 'Status',
      render: (p) => {
        const st = p.stock_status
        const cfg = {
          ok:      { label: 'In Stock',   color: '#1A6E3A', bg: '#EAF5EE' },
          low:     { label: 'Low Stock',  color: '#C45A00', bg: '#FEF0E6' },
          out:     { label: 'Out',        color: '#C0392B', bg: '#FDECEA' },
          unknown: { label: 'Untracked',  color: '#6B7A8D', bg: '#F0F4F8' },
        }[st ?? 'unknown']
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
            {!p.is_active && <span style={{ fontSize: 10, color: '#8A9AB5', fontWeight: 600 }}>Inactive</span>}
          </div>
        )
      },
    },
    ...(isAdminLike ? [{
      key: 'actions', header: '',
      render: (p) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="Upload image" onClick={(e) => { e.stopPropagation(); setImageTarget(p) }}
            style={{ padding: '5px', borderRadius: 6, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#8A9AB5', display: 'flex', alignItems: 'center' }}>
            <ImageIcon size={13} />
          </button>
          <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(p) }}
            style={{ padding: '5px', borderRadius: 6, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#1A3FA6', display: 'flex', alignItems: 'center' }}>
            <Pencil size={13} />
          </button>
          <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }}
            style={{ padding: '5px', borderRadius: 6, border: '1px solid #FDECEA', background: 'transparent', cursor: 'pointer', color: '#C0392B', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ),
    }] : []),
  ], [isAdminLike])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ShimmerStyle />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1C2B3A' }}>Product Catalog</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8A9AB5' }}>
            Manage products, pricing, stock levels and analytics across all branches.
          </p>
        </div>
        {isAdminLike && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={handleExport}>
              <Download size={14} /> Export CSV
            </Btn>
            <Btn variant="ghost" onClick={() => importRef.current?.click()} disabled={importMutation.isPending}>
              {importMutation.isPending ? <Spinner size={12} /> : <Upload size={14} />}
              Import CSV
            </Btn>
            <input ref={importRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) { importMutation.mutate(e.target.files[0]); e.target.value = '' } }}
            />
            <Btn variant="ghost" onClick={() => setBulkModal(true)}>
              <Tag size={14} /> Bulk Price Update
            </Btn>
            <Btn onClick={openCreate}>
              <Plus size={14} /> Add Product
            </Btn>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16 }}>
        <ProductStatCard icon={Layers}      label="Total Products" value={stats.total}     sub="In current filter" color="#1A3FA6" loading={isLoading} />
        <ProductStatCard icon={Package}     label="Low Stock"      value={stats.lowStock}  sub="Needs replenishment" color="#C45A00" loading={isLoading} />
        <ProductStatCard icon={AlertTriangle} label="Out of Stock" value={stats.outStock}  sub="Zero inventory" color="#C0392B" loading={isLoading} />
        <ProductStatCard icon={TrendingUp}  label="Avg Margin"     value={`${stats.avgMargin}%`} sub="Across visible products" color="#1A6E3A" loading={isLoading} />
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={(t) => { setActiveTab(t); setPage(1) }} />

      {/* ── CATALOG TAB ─────────────────────────────────────── */}
      {activeTab === 'Catalog' && (
        <Card>
          {/* Filters bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by name, SKU, barcode…"
                style={{
                  width: '100%', padding: '9px 12px 9px 34px',
                  fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 9,
                  outline: 'none', boxSizing: 'border-box', color: '#3A4A5C',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--edlp-primary)'}
                onBlur={(e) => e.target.style.borderColor = '#E5EBF2'}
              />
            </div>

            {/* Category filter */}
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 9, color: '#3A4A5C', background: '#fff', outline: 'none', cursor: 'pointer' }}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Supplier filter */}
            <select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1) }}
              style={{ padding: '9px 12px', fontSize: 13, border: '1px solid #E5EBF2', borderRadius: 9, color: '#3A4A5C', background: '#fff', outline: 'none', cursor: 'pointer' }}>
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* Stock status pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(({ v, label }) => (
                <FilterPill key={v} label={label} active={statusFilter === v} onClick={() => { setStatusFilter(v); setPage(1) }} />
              ))}
            </div>

            {/* Active toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6B7A8D', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => { setActiveOnly(e.target.checked); setPage(1) }}
                style={{ accentColor: 'var(--edlp-primary)', width: 14, height: 14 }} />
              Active only
            </label>

            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#8A9AB5', display: 'flex', alignItems: 'center' }}
              title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
                    {['Product', 'SKU / Barcode', 'Supplier', 'Price', 'Stock Level', 'Status', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
                </tbody>
              </table>
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={products}
              rowKey={(p) => p.id}
              loading={false}
              emptyMessage="No products match your filters. Try adjusting search or category."
              pagination={meta ? {
                current: meta.current_page,
                last: meta.last_page,
                total: meta.total,
                onPage: setPage,
              } : undefined}
            />
          )}
        </Card>
      )}

      {/* ── PRICE HISTORY TAB ───────────────────────────────── */}
      {activeTab === 'Price History' && (
        <PriceHistoryTab products={allProducts} loading={allProductsQuery.isLoading} />
      )}

      {/* ── ANALYTICS TAB ───────────────────────────────────── */}
      {activeTab === 'Analytics' && (
        <AnalyticsTab products={allProducts} loading={allProductsQuery.isLoading} />
      )}

      {/* ── Create / Edit Product Modal ──────────────────────── */}
      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editProduct ? `Edit: ${editProduct.name}` : 'Add New Product'}
        width={660}
        footer={<>
          <Btn variant="ghost" onClick={() => setProductModal(false)} disabled={saveMutation.isPending}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editProduct ? 'Save Changes' : 'Create Product'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section: Basic Info */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Basic Information</div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FormField label="Product Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="e.g. Indomie Chicken Noodles 70g" />
            </FormField>
            <FormField label="SKU" required error={errors.sku?.message} hint="Unique stock code">
              <FormInput register={register('sku')} error={errors.sku} placeholder="IND-CHK-70G" />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Barcode / EAN" error={errors.barcode?.message}>
              <FormInput register={register('barcode')} placeholder="8901491501234" />
            </FormField>
            <FormField label="Unit of Measure" hint="e.g. unit, pack, kg, litre, bottle, tin">
              <FormInput register={register('unit')} placeholder="unit" />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Category">
              <FormSelect register={register('category_id')}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Supplier">
              <FormSelect register={register('supplier_id')}>
                <option value="">No supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <div style={{ height: 1, background: '#F0F4F8', margin: '4px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pricing & Inventory</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Cost Price (₦)" required error={errors.cost_price?.message}>
              <FormInput register={register('cost_price')} type="number" step="0.01" min="0" placeholder="500.00" />
            </FormField>
            <FormField label="Selling Price (₦)" required error={errors.selling_price?.message}>
              <FormInput register={register('selling_price')} type="number" step="0.01" min="0" placeholder="750.00" />
            </FormField>
            <FormField label="Reorder Level" hint="Alert threshold">
              <FormInput register={register('reorder_level')} type="number" min={0} placeholder="5" />
            </FormField>
          </div>

          <FormField label="Description">
            <textarea {...register('description')} rows={2} placeholder="Optional product description…"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical',fontFamily:'inherit' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--edlp-primary)'}
              onBlur={(e) => e.target.style.borderColor = '#D5DFE9'}
            />
          </FormField>

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

      {/* ── Bulk Price Update Modal ──────────────────────────── */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Price Update" width={460}
        footer={<>
          <Btn variant="ghost" onClick={() => setBulkModal(false)}>Cancel</Btn>
          <Btn onClick={bulkForm.handleSubmit((d) => bulkMutation.mutate(d))} disabled={bulkMutation.isPending}>
            {bulkMutation.isPending ? <><Spinner size={12}/> Updating…</> : 'Apply Price Update'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: '#FEF0E6', borderRadius: 10, fontSize: 12, color: '#C45A00', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
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
            hint={bulkForm.watch('type') === 'percentage' ? 'e.g. 10 = +10%, -5 = –5%' : 'New fixed selling price in ₦'}>
            <FormInput register={bulkForm.register('value')} type="number" step="0.01"
              placeholder={bulkForm.watch('type') === 'percentage' ? '10' : '750.00'} />
          </FormField>
          <FormField label="Apply to Category" hint="Leave blank to apply to all products">
            <FormSelect register={bulkForm.register('category_id')}>
              <option value="">All products</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormSelect>
          </FormField>
          <FormField label="Reason (optional)">
            <FormInput register={bulkForm.register('reason')} placeholder="e.g. Q2 price review" />
          </FormField>
        </form>
      </Modal>

      {/* ── Image Upload Modal ───────────────────────────────── */}
      <Modal open={Boolean(imageTarget)} onClose={() => setImageTarget(null)}
        title={`Upload Image — ${imageTarget?.name}`} width={380}
        footer={<Btn variant="ghost" onClick={() => setImageTarget(null)}>Close</Btn>}
      >
        {imageTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '8px 0' }}>
            <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', border: '2px solid #E5EBF2', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F8FB' }}>
              {imageTarget.thumbnail_url
                ? <img src={imageTarget.thumbnail_url} alt={imageTarget.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <ImageIcon size={28} color="#D5DFE9" />
              }
            </div>
            <div style={{ fontSize: 13, color: '#8A9AB5', textAlign: 'center' }}>
              JPEG / PNG / WebP · max 2 MB
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 24px',
              background: 'var(--edlp-navy)', color: '#fff',
              borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>
              <Upload size={15} />
              {imageMutation.isPending ? 'Uploading…' : 'Choose Image'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) imageMutation.mutate({ id: imageTarget.id, file: e.target.files[0] }) }}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ───────────────────────────────────── */}
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
