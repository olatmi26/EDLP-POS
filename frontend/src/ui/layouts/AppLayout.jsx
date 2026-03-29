import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, BarChart2, Package, Users, ShoppingCart,
  Truck, ClipboardList, Settings, Bell, LogOut, RefreshCw,
  Menu, X, Building2, UserCog, Wallet, AlertCircle,
  Layers, BookOpen, GitBranch, TrendingUp,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to:'/',      icon:LayoutDashboard, label:'Dashboard' },
      { to:'/pos',   icon:ShoppingCart,    label:'POS Checkout' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to:'/sales',     icon:BarChart2,  label:'Sales Reports' },
      { to:'/products',  icon:Layers,     label:'Products' },
      { to:'/inventory', icon:Package,    label:'Inventory' },
      { to:'/customers', icon:Users,      label:'Customers' },
      { to:'/expenses',  icon:Wallet,     label:'Expenses' },
      { to:'/wholesale', icon:TrendingUp, label:'Wholesale / B2B' },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { to:'/suppliers',       icon:Truck,        label:'Suppliers' },
      { to:'/purchase-orders', icon:ClipboardList, label:'Purchase Orders' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to:'/approvals',       icon:AlertCircle, label:'Approvals' },
      { to:'/users',           icon:UserCog,     label:'Users & Roles' },
      { to:'/branches',        icon:Building2,   label:'Branches' },
      { to:'/accounting',      icon:BookOpen,    label:'Accounting' },
      { to:'/workflow-config', icon:GitBranch,   label:'Workflow Config' },
      { to:'/settings',        icon:Settings,    label:'Settings' },
    ],
  },
]

function SideNavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) => [
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-[var(--edlp-primary)] text-[var(--edlp-navy)]'
          : 'text-white/60 hover:bg-white/6 hover:text-white',
      ].join(' ')}
      title={collapsed ? label : undefined}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export function AppLayout() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const user         = useAuthStore((s) => s.user)
  const isAdminLike  = useAuthStore((s) => s.isAdminLike())
  const setUser      = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const branchesQuery = useQuery({
    queryKey: ['branches','all'],
    enabled: Boolean(isAdminLike),
    queryFn: async () => {
      const res = await api.get('/branches', { params:{ all:true } })
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const pendingCountQuery = useQuery({
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

  const switchBranchMutation = useMutation({
    mutationFn: async (branchId) => {
      const res = await api.post('/auth/switch-branch', { branch_id: branchId })
      return res.data?.data
    },
    onSuccess: async (userData) => {
      if (userData) setUser(userData)
      await queryClient.invalidateQueries({ queryKey:['me'] })
      toast.success('Branch switched')
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Branch switch failed'),
  })

  async function logout() {
    try { await api.delete('/auth/logout') } catch {}
    finally { clearSession(); toast.success('Logged out'); navigate('/login', { replace:true }) }
  }

  const initials = user?.name
    ? user.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
    : '?'

  const pendingCount = pendingCountQuery.data ?? 0

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--edlp-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 224 : 60,
        background: 'var(--edlp-navy)',
        borderRight: '1px solid var(--edlp-border)',
        transition: 'width 200ms ease',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding:'16px 14px', borderBottom:'1px solid var(--edlp-border)', display:'flex', alignItems:'center', gap:10, minHeight:60 }}>
          <div style={{ width:32,height:32,borderRadius:8,flexShrink:0,background:'var(--edlp-primary)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ShoppingCart size={16} color="var(--edlp-navy)" />
          </div>
          {sidebarOpen && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ color:'#fff',fontSize:13,fontWeight:700,lineHeight:1.2,whiteSpace:'nowrap' }}>EDLP Nig Ltd</div>
              <div style={{ color:'var(--edlp-white35)',fontSize:10,whiteSpace:'nowrap' }}>Hybrid POS System</div>
            </div>
          )}
        </div>

        {/* Branch scope */}
        {sidebarOpen && user?.branch && (
          <div style={{ margin:'10px 12px 0',padding:'6px 10px',background:'rgba(232,160,32,0.08)',border:'1px solid rgba(232,160,32,0.2)',borderRadius:8,color:'var(--edlp-primary)',fontSize:11,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
            {user.branch.is_head_office ? '🏢 Head Office' : `📍 ${user.branch.name}`}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1,overflowY:'auto',overflowX:'hidden',padding:'12px 8px' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom:8 }}>
              {group.label && sidebarOpen && (
                <div style={{ color:'var(--edlp-white35)',fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',padding:'8px 8px 4px' }}>
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <div key={item.to} style={{ position:'relative' }}>
                  <SideNavItem collapsed={!sidebarOpen} {...item} />
                  {/* Pending badge on Approvals */}
                  {item.to === '/approvals' && pendingCount > 0 && sidebarOpen && (
                    <span style={{ position:'absolute',top:6,right:8,background:'#C0392B',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,pointerEvents:'none' }}>
                      {pendingCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* User bottom */}
        <div style={{ borderTop:'1px solid var(--edlp-border)',padding:'12px 10px',display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ width:30,height:30,borderRadius:'50%',flexShrink:0,background:'var(--edlp-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--edlp-navy)',fontSize:11,fontWeight:700 }}>
            {initials}
          </div>
          {sidebarOpen && (
            <>
              <div style={{ flex:1,overflow:'hidden' }}>
                <div style={{ color:'#fff',fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{user?.name ?? user?.email ?? 'User'}</div>
                <div style={{ color:'var(--edlp-white35)',fontSize:10,whiteSpace:'nowrap' }}>{(typeof user?.roles?.[0] === 'object' ? user?.roles?.[0]?.name : user?.roles?.[0]) ?? 'Staff'}</div>
              </div>
              <button onClick={logout} title="Logout"
                style={{ background:'none',border:'none',cursor:'pointer',color:'var(--edlp-white35)',padding:4,borderRadius:6,display:'flex',alignItems:'center' }}
                onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='var(--edlp-white35)'}
              >
                <LogOut size={14}/>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>

        {/* Top bar */}
        <header style={{ height:56,background:'#fff',borderBottom:'1px solid #E5EBF2',display:'flex',alignItems:'center',gap:12,padding:'0 20px',flexShrink:0 }}>
          <button onClick={() => setSidebarOpen(v=>!v)}
            style={{ background:'none',border:'none',cursor:'pointer',color:'var(--edlp-text-light)',padding:6,borderRadius:6,display:'flex',alignItems:'center' }}>
            {sidebarOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>

          {/* Branch selector */}
          {isAdminLike && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:12,color:'var(--edlp-text-light)' }}>Branch:</span>
              <select value={user?.branch?.id ?? ''}
                onChange={(e) => switchBranchMutation.mutate(Number(e.target.value))}
                disabled={branchesQuery.isLoading || switchBranchMutation.isPending}
                style={{ fontSize:12,border:'1px solid #D5DFE9',borderRadius:6,padding:'4px 8px',color:'var(--edlp-text)',outline:'none',cursor:'pointer',background:'#fff' }}>
                <option value="" disabled>Select…</option>
                {(branchesQuery.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {switchBranchMutation.isPending && <RefreshCw size={14} style={{ animation:'spin 0.7s linear infinite' }} color="#8A9AB5" />}
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* Approvals bell badge */}
          {pendingCount > 0 && (
            <div style={{ position:'relative' }}>
              <button onClick={() => navigate('/approvals')}
                style={{ background:'#FDECEA',border:'1px solid #FACAC5',borderRadius:20,padding:'4px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:'#C0392B' }}>
                <AlertCircle size={13}/> {pendingCount} pending
              </button>
            </div>
          )}

          <button style={{ position:'relative',background:'none',border:'none',cursor:'pointer',color:'var(--edlp-text-light)',padding:6,borderRadius:6,display:'flex',alignItems:'center' }}>
            <Bell size={18}/>
          </button>

          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 10px',borderRadius:20,border:'1px solid #E5EBF2',cursor:'pointer' }}>
            <div style={{ width:26,height:26,borderRadius:'50%',background:'var(--edlp-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--edlp-navy)',fontSize:10,fontWeight:700 }}>
              {initials}
            </div>
            <span style={{ fontSize:12,fontWeight:600,color:'var(--edlp-text)' }}>{user?.name?.split(' ')[0] ?? 'User'}</span>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1,overflowY:'auto',padding:24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
