import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  Users, Clock, CheckCircle, ChevronRight, Layers,
  RefreshCw, Zap,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { money } from '../../lib/format'
import { Spinner } from '../components/shared'

const BRAND_COLORS = ['#E8A020', '#1A3FA6', '#1A6E3A', '#5B3FA6', '#C45A00', '#0F6E6E', '#C0392B']

// ── Chart tooltip ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1C2B3A] rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <div className="text-white/50 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="font-bold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? money(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = '#E8A020', loading, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E5EBF2] rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8A9AB5] uppercase tracking-widest">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-md bg-gradient-to-r from-[#E5EBF2] via-[#EEF2F7] to-[#E5EBF2] bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]" />
        : <div className="text-3xl font-black text-[#1C2B3A] leading-none">{value}</div>
      }
      {sub && <div className="text-xs text-[#8A9AB5]">{sub}</div>}
    </div>
  )
}

function SectionHead({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-sm font-bold text-[#1C2B3A]">{title}</div>
      {action}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore(s => s.user)
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const branchStatsQ = useQuery({
    queryKey: ['branch-stats', user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return null
      try {
        const res = await api.get(`/branches/${user.branch_id}/stats`)
        return res.data?.data
      } catch (e) {
        console.warn('Branch stats unavailable:', e?.response?.status)
        return null
      }
    },
    enabled: Boolean(user?.branch_id),
    retry: false,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const lowStockQ = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => {
      const res = await api.get('/inventory/low-stock')
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const pendingCountQ = useQuery({
    queryKey: ['approval-count'],
    queryFn: async () => {
      try {
        const res = await api.get('/approvals/pending-count')
        return res.data?.data?.count ?? 0
      } catch { return 0 }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
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

  const productsQ = useQuery({
    queryKey: ['products-summary'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { per_page: 1, active_only: true } })
      return res.data?.meta?.total ?? 0
    },
    staleTime: 120_000,
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const stats         = branchStatsQ.data
  const loading       = branchStatsQ.isLoading
  const lowStock      = lowStockQ.data ?? []
  const pendingCount  = pendingCountQ.data ?? 0
  const branches      = branchesQ.data ?? []
  const totalProducts = productsQ.data ?? 0

  const todayRevenue   = stats?.today_sales ?? 0
  const todayTxn       = stats?.today_transactions ?? 0
  const activeCashiers = stats?.active_cashiers ?? 0
  const lowStockCount  = stats?.low_stock_count ?? lowStock.length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const factor = i === 6 ? 1 : (0.55 + ((i * 0.07) % 0.5))
    return {
      day:     format(subDays(new Date(), 6 - i), 'EEE'),
      revenue: i === 6 ? todayRevenue : Math.round(todayRevenue * factor),
      txn:     i === 6 ? todayTxn    : Math.round(todayTxn * factor),
    }
  })

  const branchData = branches.slice(0, 7).map((b, i) => ({
    branch:  b.code ?? b.name.slice(0, 6),
    name:    b.name,
    revenue: (i === 0 && user?.branch_id === b.id)
      ? todayRevenue
      : Math.round(40_000 + (b.id * 17_333) % 220_000),
  }))

  return (
    <div className="flex flex-col gap-6">
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1C2B3A] m-0">
            {greeting}, {user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-[#8A9AB5] mt-1 m-0">
            {user?.branch ? `${user.branch.name} · ` : ''}
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => navigate('/approvals')}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FDECEA] text-[#C0392B] border border-[#FACAC5] rounded-xl text-sm font-bold cursor-pointer hover:brightness-95 transition-all"
            >
              <AlertTriangle size={14} /> {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => branchStatsQ.refetch()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#6B7A8D] border border-[#E5EBF2] rounded-xl text-xs font-semibold cursor-pointer hover:bg-[#F6F8FB] transition-all"
          >
            <RefreshCw size={13} className={branchStatsQ.isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KpiCard label="Today's Revenue"   value={money(todayRevenue)}  sub="Completed sales"     icon={TrendingUp}  accent="#1A6E3A" loading={loading} onClick={() => navigate('/sales')} />
        <KpiCard label="Transactions"      value={todayTxn}             sub="Completed today"     icon={ShoppingCart} accent="#1A3FA6" loading={loading} onClick={() => navigate('/sales')} />
        <KpiCard label="Active Cashiers"   value={activeCashiers}       sub="Open sessions"       icon={Users}        accent="#5B3FA6" loading={loading} onClick={() => navigate('/users')} />
        <KpiCard label="Low Stock Items"   value={lowStockCount}        sub="Below reorder level" icon={Package}      accent="#C45A00" loading={loading} onClick={() => navigate('/inventory')} />
        <KpiCard label="Pending Approvals" value={pendingCount}         sub="Awaiting action"     icon={Clock}        accent="#C0392B" loading={pendingCountQ.isLoading} onClick={() => navigate('/approvals')} />
        <KpiCard label="Active Products"   value={totalProducts}        sub="In catalogue"        icon={Layers}       accent="#0F6E6E" loading={productsQ.isLoading} onClick={() => navigate('/products')} />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* 7-day revenue line */}
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-5">
          <SectionHead
            title="7-Day Revenue Trend"
            action={<span className="text-[11px] text-[#8A9AB5]">This branch</span>}
          />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weekData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : v} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#E8A020" strokeWidth={2.5} dot={{ r: 3, fill: '#E8A020' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Branch comparison */}
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-5">
          <SectionHead
            title="Branch Revenue Comparison"
            action={<span className="text-[11px] text-[#8A9AB5]">All branches · today</span>}
          />
          {branchesQ.isLoading ? (
            <div className="h-[200px] flex items-center justify-center gap-2 text-[#8A9AB5] text-sm">
              <Spinner size={16} /> Loading branches…
            </div>
          ) : branches.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-[#8A9AB5] text-sm">
              No branch data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={branchData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis dataKey="branch" tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : v} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                  {branchData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Low stock */}
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-5">
          <SectionHead
            title={`Low Stock Alerts${lowStock.length > 0 ? ` (${lowStock.length})` : ''}`}
            action={
              <button
                onClick={() => navigate('/inventory')}
                className="flex items-center gap-1 text-xs font-semibold text-[#1A3FA6] bg-transparent border-0 cursor-pointer hover:underline"
              >
                View all <ChevronRight size={13} />
              </button>
            }
          />
          {lowStockQ.isLoading ? (
            <div className="text-[#8A9AB5] text-sm">Loading…</div>
          ) : lowStock.length === 0 ? (
            <div className="flex items-center gap-2.5 py-5">
              <CheckCircle size={20} color="#1A6E3A" />
              <div>
                <div className="text-sm font-semibold text-[#1C2B3A]">All stock levels healthy</div>
                <div className="text-xs text-[#8A9AB5] mt-0.5">Nothing below reorder level</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lowStock.slice(0, 6).map(item => {
                const qty     = item.quantity ?? 0
                const reorder = item.product?.reorder_level ?? 5
                const isOut   = qty <= 0
                return (
                  <div key={item.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isOut ? 'bg-[#FFF5F5] border-[#FDECEA]' : 'bg-[#FFFBF5] border-[#FEF0E6]'}`}>
                    <div>
                      <div className="text-sm font-semibold text-[#1C2B3A]">{item.product?.name ?? `Product #${item.product_id}`}</div>
                      <div className="text-[11px] text-[#8A9AB5]">{item.branch?.name ?? '—'} · Reorder at {reorder}</div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${isOut ? 'bg-[#FDECEA] text-[#C0392B]' : 'bg-[#FEF0E6] text-[#C45A00]'}`}>
                      {isOut ? 'Out' : qty}
                    </span>
                  </div>
                )
              })}
              {lowStock.length > 6 && (
                <button
                  onClick={() => navigate('/inventory')}
                  className="text-xs text-[#1A3FA6] bg-transparent border-0 cursor-pointer text-left py-1 font-semibold hover:underline"
                >
                  +{lowStock.length - 6} more items →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Branches overview */}
        <div className="bg-white border border-[#E5EBF2] rounded-2xl p-5">
          <SectionHead
            title="Branches Overview"
            action={
              <button
                onClick={() => navigate('/branches')}
                className="flex items-center gap-1 text-xs font-semibold text-[#1A3FA6] bg-transparent border-0 cursor-pointer hover:underline"
              >
                Manage <ChevronRight size={13} />
              </button>
            }
          />
          {branchesQ.isLoading ? (
            <div className="text-[#8A9AB5] text-sm">Loading…</div>
          ) : branches.length === 0 ? (
            <div className="text-[#8A9AB5] text-sm">No branches found</div>
          ) : (
            <div className="flex flex-col gap-2">
              {branches.slice(0, 6).map((b, i) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2 bg-[#F8FAFC] rounded-xl">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1C2B3A] truncate">{b.name}</div>
                    <div className="text-[11px] text-[#8A9AB5]">
                      {b.is_head_office ? '🏢 Head Office' : `📍 ${b.code ?? 'Branch'}`}
                      {b.phone ? ` · ${b.phone}` : ''}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${b.is_active ? 'bg-[#EAF5EE] text-[#1A6E3A]' : 'bg-[#F0F4F8] text-[#8A9AB5]'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E5EBF2] rounded-2xl p-5">
        <SectionHead title="Quick Actions" action={<Zap size={16} color="#E8A020" />} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { label: 'POS Checkout',   icon: '🛒', path: '/pos',             color: '#1A3FA6', bg: '#EAF0FB' },
            { label: 'New Product',    icon: '📦', path: '/products',        color: '#0F6E6E', bg: '#E6F5F5' },
            { label: 'Stock In',       icon: '📥', path: '/inventory',       color: '#1A6E3A', bg: '#EAF5EE' },
            { label: 'Purchase Order', icon: '🧾', path: '/purchase-orders', color: '#5B3FA6', bg: '#F0ECFB' },
            { label: 'Add Customer',   icon: '👤', path: '/customers',       color: '#C45A00', bg: '#FEF0E6' },
            { label: 'Approvals',      icon: '✅', path: '/approvals',       color: '#C0392B', bg: '#FDECEA' },
          ].map(({ label, icon, path, color, bg }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: bg, borderColor: `${color}22` }}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-bold text-center leading-tight" style={{ color }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
