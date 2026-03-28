import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  Users, Clock, CheckCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { money } from '../../lib/format'
import { StatCard, Card, Badge, RoleBadge } from '../components/shared'

// ── Small sparkline for stat cards ───────────────────────────────────────────
function MiniTrend({ data = [], color = '#E8A020' }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Placeholder weekly data (replaced by real API data when wired)
const WEEK_MOCK = Array.from({ length: 7 }, (_, i) => ({
  day: format(subDays(new Date(), 6 - i), 'EEE'),
  revenue: Math.round(80000 + Math.random() * 80000),
  transactions: Math.round(30 + Math.random() * 60),
}))

const BRANCH_MOCK = [
  { branch: 'Lagos',   revenue: 245000, margin: 18.2 },
  { branch: 'Abuja',   revenue: 188000, margin: 14.1 },
  { branch: 'Kano',    revenue: 142000, margin: 12.8 },
  { branch: 'Enugu',   revenue: 118000, margin: 11.5 },
  { branch: 'Ilabdan', revenue: 98000,  margin: 10.2 },
  { branch: 'Onitsha', revenue: 76000,  margin: 9.4  },
]

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1C2B3A', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? money(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 14 }}>{children}</div>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  // ── Real API calls ────────────────────────────────────────
  const branchStats = useQuery({
    queryKey: ['branch-stats', user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return null
      const res = await api.get(`/branches/${user.branch_id}/stats`)
      return res.data?.data
    },
    enabled: Boolean(user?.branch_id),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => {
      const res = await api.get('/inventory/low-stock')
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const stats = branchStats.data
  const lowStock = lowStockQuery.data ?? []

  const todayRevenue   = stats?.today_sales ?? 0
  const todayTxn       = stats?.today_transactions ?? 0
  const activeCashiers = stats?.active_cashiers ?? 0
  const lowStockCount  = stats?.low_stock_count ?? lowStock.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1C2B3A' }}>
            {isAdminLike ? 'Global Operations Dashboard' : `Welcome, ${user?.name?.split(' ')[0] ?? 'Staff'}`}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8A9AB5' }}>
            {isAdminLike ? 'Real-time view across all branches' : `${user?.branch?.name ?? 'Your branch'} — ${format(new Date(), 'EEEE, d MMMM yyyy')}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#EAF5EE', border: '1px solid #C3E6CB' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A6E3A', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A6E3A' }}>System Online</span>
        </div>
      </div>

      {/* KPI stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard
          label="Today's Revenue"
          value={money(todayRevenue)}
          sub="+2.5% vs yesterday"
          icon={TrendingUp}
          accent="#E8A020"
        />
        <StatCard
          label="Total Transactions"
          value={todayTxn}
          sub="All branches"
          icon={ShoppingCart}
          accent="#1A3FA6"
        />
        <StatCard
          label="Total Stock Units"
          value="350,000"
          sub="Across all branches"
          icon={Package}
          accent="#0F6E6E"
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStockCount}
          sub={`Across ${Math.min(lowStockCount, 3)} branches`}
          icon={AlertTriangle}
          accent="#C45A00"
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 7-Day Revenue Trend */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionTitle>7-Day Revenue Trend</SectionTitle>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Today', 'This Week', 'Custom Range'].map(l => (
                <button key={l} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  border: l === 'This Week' ? '1px solid var(--edlp-primary)' : '1px solid #E5EBF2',
                  background: l === 'This Week' ? 'rgba(232,160,32,0.08)' : '#fff',
                  color: l === 'This Week' ? '#C98516' : '#8A9AB5',
                  cursor: 'pointer', fontWeight: 600,
                }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={WEEK_MOCK} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke="#E8A020" strokeWidth={2.5} dot={{ r: 3, fill: '#E8A020' }} name="Revenue" />
              <Line type="monotone" dataKey="transactions" stroke="#1A3FA6" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Txns" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Branch Performance */}
        <Card>
          <SectionTitle>Branch Performance Comparison</SectionTitle>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={BRANCH_MOCK} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="branch" tick={{ fontSize: 10, fill: '#8A9AB5' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8A9AB5' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A9AB5' }} />
              <Bar yAxisId="left" dataKey="revenue" fill="#1A9E75" radius={[4, 4, 0, 0]} name="Revenue (Today)" />
              <Bar yAxisId="right" dataKey="margin" fill="#E8A020" radius={[4, 4, 0, 0]} name="Profit Margin %" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Frequent Customers Leaderboard */}
        <Card>
          <SectionTitle>Frequent Customer Leaderboard</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { name: 'Babatunde Adekunle', visits: 65, spend: 485000, badge: 'Gold' },
              { name: 'Chioma Okoro',       visits: 28, spend: 188000, badge: 'Silver' },
              { name: 'Emeka Nwosu',        visits: 18, spend: 102000, badge: 'Silver' },
              { name: 'Fatima Aliyu',        visits: 11, spend: 58000,  badge: null },
              { name: 'Dele Akinwande',     visits: 7,  spend: 32000,  badge: null },
            ].map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < 4 ? '1px solid #F0F4F8' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', width: 18 }}>#{i + 1}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? '#E8A020' : i === 1 ? '#8A9AB5' : '#E5EBF2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: i < 2 ? '#fff' : '#8A9AB5', fontSize: 10, fontWeight: 700,
                  }}>
                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B3A' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#8A9AB5' }}>{c.visits} visits</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A' }}>{money(c.spend)}</div>
                  {c.badge && <Badge color="warning">{c.badge}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Low Stock Alerts + Active Sessions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active session info */}
          <Card>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #F0F4F8', paddingRight: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#E8A020' }}>{activeCashiers}</div>
                <div style={{ fontSize: 11, color: '#8A9AB5', fontWeight: 600 }}>Active Cashiers</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1A3FA6' }}>0</div>
                <div style={{ fontSize: 11, color: '#8A9AB5', fontWeight: 600 }}>Pending Approvals</div>
              </div>
            </div>
          </Card>

          {/* Low stock list */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionTitle>Low Stock Alerts</SectionTitle>
              {lowStockCount > 0 && <Badge color="warning">{lowStockCount} items</Badge>}
            </div>
            {lowStockQuery.isLoading ? (
              <div style={{ color: '#8A9AB5', fontSize: 13 }}>Loading…</div>
            ) : lowStock.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1A6E3A', fontSize: 13 }}>
                <CheckCircle size={16} /> All stock levels are healthy
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {lowStock.slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F6F8FB', fontSize: 13 }}>
                    <span style={{ color: '#3A4A5C' }}>{item.product?.name ?? `Product #${item.product_id}`}</span>
                    <span style={{ fontWeight: 700, color: item.quantity <= 0 ? '#C0392B' : '#C45A00' }}>
                      {item.quantity} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

    </div>
  )
}
