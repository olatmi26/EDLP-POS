/**
 * AppLayout — EDLP POS Shell
 *
 * Structure:
 *  ┌──────────────────────────────────────────────────────┐
 *  │  224px Sidebar  │ [220px Flyout panel — slides out] │  Main content
 *  └──────────────────────────────────────────────────────┘
 *
 * Sidebar rules:
 *  - Always 224px wide, full viewport height, no horizontal scroll ever
 *  - Vertical scroll on nav area when items overflow
 *  - overflow-x: hidden on every container
 *
 * Flyout rules:
 *  - Slides out to the RIGHT of the 224px sidebar
 *  - ← back arrow on flyout header closes it (points outward toward main content)
 *  - Clicking the semi-transparent backdrop closes it
 *  - Clicking same nav item again toggles it closed
 *
 * Nav structure:
 *  - Dashboard     → standalone (no flyout)
 *  - POS Checkout  → standalone MAJOR link (no flyout)
 *  - Branch Stats  → flyout
 *  - Sales         → flyout
 *  - Products      → flyout (Categories/Brands/Units sub-pages)
 *  - Inventory     → flyout
 *  - Customers     → flyout
 *  - Expenses      → standalone
 *  - Wholesale     → flyout
 *  - Promotions    → flyout
 *  - Stock Movements → standalone
 *  - Suppliers     → standalone
 *  - Purchase Orders → flyout
 *  - Approvals     → standalone (approval badge count)
 *  - Administration → flyout
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, ShoppingCart, BarChart2, Package, Layers,
  Users, Wallet, TrendingUp, Tag, MoveHorizontal, Truck,
  ClipboardList, CheckCircle, UserCog, Building2, BookOpen,
  GitBranch, Settings, Bell, LogOut, RefreshCw, ChevronRight,
  ArrowLeft, Store,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// NAV DEFINITION
//  type: 'standalone' | 'flyout'
//  flyoutKey: string — must match FLYOUT_MENUS keys
// ─────────────────────────────────────────────────────────────────────────────
const NAV = {
  top: [
    {
      type: 'standalone',
      to:   '/',
      icon: LayoutDashboard,
      label: 'Dashboard',
      end: true,
    },
    {
      type:  'standalone',
      to:    '/pos',
      icon:  ShoppingCart,
      label: 'POS Checkout',
      major: true,
      badge: { text: 'Sprint 4', color: '#E8A020', bg: 'rgba(232,160,32,0.15)' },
    },
  ],
  sections: [
    {
      label: 'Operations',
      items: [
        { type: 'flyout',     flyoutKey: 'branch-stats', icon: Store,          label: 'Branch Stats' },
        { type: 'flyout',     flyoutKey: 'sales',        icon: BarChart2,       label: 'Sales' },
        { type: 'flyout',     flyoutKey: 'products',     icon: Layers,          label: 'Products' },
        { type: 'flyout',     flyoutKey: 'inventory',    icon: Package,         label: 'Inventory' },
        { type: 'flyout',     flyoutKey: 'customers',    icon: Users,           label: 'Customers' },
        { type: 'standalone', to: '/expenses',            icon: Wallet,          label: 'Expenses' },
        { type: 'flyout',     flyoutKey: 'wholesale',    icon: TrendingUp,      label: 'Wholesale / B2B' },
        { type: 'flyout',     flyoutKey: 'promotions',   icon: Tag,             label: 'Promotions' },
        { type: 'standalone', to: '/stock-movements',    icon: MoveHorizontal,  label: 'Stock Movements' },
      ],
    },
    {
      label: 'Purchasing',
      items: [
        { type: 'standalone', to: '/suppliers',           icon: Truck,          label: 'Suppliers' },
        { type: 'flyout',     flyoutKey: 'purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { type: 'standalone', to: '/approvals',           icon: CheckCircle,    label: 'Approvals', approvalBadge: true },
        { type: 'flyout',     flyoutKey: 'admin',         icon: Settings,       label: 'Administration' },
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// FLYOUT MENU DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const FLYOUT_MENUS = {
  'branch-stats': {
    title: 'Branch Stats',
    sections: [
      { items: [
        { icon: '📊', label: "Today's Overview",    sub: 'Revenue, txns, cashiers',  to: '/' },
        { icon: '📅', label: 'Daily Summary',        sub: 'Full day breakdown',       to: '/' },
        { icon: '📈', label: 'Week Comparison',      sub: '7-day trend per branch',   to: '/' },
        { icon: '🏆', label: 'Top Products',         sub: 'Best sellers today',       to: '/' },
        { icon: '👤', label: 'Cashier Performance',  sub: 'Per-staff statistics',     to: '/' },
      ]},
    ],
  },
  sales: {
    title: 'Sales',
    sections: [
      { items: [
        { icon: '📋', label: 'All Sales',            sub: 'Complete history',         to: '/sales' },
        { icon: '🔍', label: 'Sale Detail',          sub: 'Receipt & refund view',    to: '/sales', isNew: true },
        { icon: '↩️', label: 'Sales Returns',        sub: 'Refund management',        to: '/sales', isNew: true },
      ]},
      { label: 'Import / Export', items: [
        { icon: '📥', label: 'Import Sales',         sub: 'Historical data migration', to: '/sales', isNew: true },
        { icon: '📤', label: 'Export CSV',           sub: 'Download records',          to: '/sales' },
      ]},
    ],
  },
  products: {
    title: 'Products',
    sections: [
      { items: [
        { icon: '➕', label: 'Create Product',       sub: 'Add new SKU to catalogue', to: '/products' },
        { icon: '📋', label: 'All Products',         sub: 'Browse & edit catalogue',  to: '/products' },
        { icon: '🏷️', label: 'Print Labels',         sub: 'Barcode label printing',   to: '/products', isNew: true },
        { icon: '🔢', label: 'Count Stock',          sub: 'Full stock-take page',      to: '/inventory', isNew: true },
      ]},
      { label: 'Catalogue Setup', items: [
        { icon: '📂', label: 'Categories',           sub: 'Product group management', to: '/products/categories', isNew: true },
        { icon: '🏷️', label: 'Brands',               sub: 'Brand management',         to: '/products/brands',     isNew: true },
        { icon: '📐', label: 'Units',                sub: 'kg, pcs, litre, carton…', to: '/products/units',      isNew: true },
      ]},
      { label: 'Import / Export', items: [
        { icon: '📥', label: 'Import Products',      sub: 'CSV bulk import wizard',   to: '/products', isNew: true },
        { icon: '📤', label: 'Export Catalogue',     sub: 'Download full CSV',        to: '/products' },
        { icon: '📦', label: 'Opening Stock Import', sub: 'Initial data migration',   to: '/products', isNew: true },
      ]},
    ],
  },
  inventory: {
    title: 'Inventory',
    sections: [
      { items: [
        { icon: '📦', label: 'All Stock',            sub: 'Branch inventory view',    to: '/inventory' },
        { icon: '📥', label: 'Stock In',             sub: 'Record deliveries',        to: '/inventory' },
        { icon: '📤', label: 'Stock Out',            sub: 'Remove without a sale',    to: '/inventory' },
        { icon: '🔄', label: 'Transfers',            sub: 'Branch-to-branch moves',   to: '/inventory' },
        { icon: '⏱️', label: 'Expiry & Batches',     sub: 'FEFO expiry tracking',     to: '/inventory' },
        { icon: '📊', label: 'Stock Movements',      sub: 'Sampling & damage log',    to: '/stock-movements' },
        { icon: '⚠️', label: 'Low Stock Alerts',     sub: 'Items to reorder',         to: '/inventory' },
      ]},
    ],
  },
  customers: {
    title: 'Customers',
    sections: [
      { items: [
        { icon: '👤', label: 'All Customers',        sub: 'Browse CRM list',          to: '/customers' },
        { icon: '➕', label: 'Add Customer',         sub: 'Create new record',        to: '/customers' },
        { icon: '🏢', label: 'B2B Accounts',         sub: 'Wholesale customers',      to: '/wholesale' },
        { icon: '🏆', label: 'Leaderboard',          sub: 'Top customers by spend',   to: '/customers' },
      ]},
    ],
  },
  wholesale: {
    title: 'Wholesale / B2B',
    sections: [
      { label: 'Orders', items: [
        { icon: '📋', label: 'All B2B Orders',       sub: 'Wholesale order list',     to: '/wholesale' },
        { icon: '➕', label: 'New Order',            sub: 'Create wholesale order',   to: '/wholesale' },
        { icon: '📦', label: 'Order Tracking',       sub: 'Kanban status board',      to: '/wholesale' },
      ]},
      { label: 'Customers & Pricing', items: [
        { icon: '🏢', label: 'B2B Customers',        sub: 'Account management',       to: '/wholesale' },
        { icon: '💰', label: 'Price Tiers',          sub: 'Gold / Silver / Bronze',   to: '/wholesale' },
        { icon: '📊', label: 'Aged Debt Report',     sub: 'Receivables 0–90d+',       to: '/wholesale' },
      ]},
    ],
  },
  promotions: {
    title: 'Promotions',
    sections: [
      { items: [
        { icon: '📋', label: 'All Promotions',       sub: 'Active & draft list',      to: '/promotions' },
        { icon: '➕', label: 'Create Promotion',     sub: 'New discount rule',        to: '/promotions/create' },
        { icon: '🎟️', label: 'Coupons',              sub: 'Generate & track codes',   to: '/promotions/coupons' },
        { icon: '⏳', label: 'Pending Approval',     sub: 'Awaiting sign-off',        to: '/approvals' },
      ]},
    ],
  },
  'purchase-orders': {
    title: 'Purchase Orders',
    sections: [
      { items: [
        { icon: '➕', label: 'New Purchase Order',   sub: 'Create PO',                to: '/purchase-orders' },
        { icon: '📋', label: 'All Orders',           sub: 'PO list & history',        to: '/purchase-orders' },
        { icon: '⏳', label: 'Pending Approval',     sub: 'Awaiting sign-off',        to: '/approvals' },
        { icon: '✅', label: 'Received',             sub: 'Completed & received POs', to: '/purchase-orders' },
      ]},
    ],
  },
  admin: {
    title: 'Administration',
    sections: [
      { label: 'Access & Config', items: [
        { icon: '👥', label: 'Users & Roles',        sub: 'IAM & permissions',        to: '/users' },
        { icon: '🏢', label: 'Branches',             sub: 'Store management',         to: '/branches' },
        { icon: '🔄', label: 'Workflow Config',      sub: 'Approval engine setup',    to: '/workflow-config' },
        { icon: '⚙️', label: 'System Settings',      sub: 'Global configuration',     to: '/settings' },
      ]},
      { label: 'Finance', items: [
        { icon: '📒', label: 'Accounting',           sub: 'Ledger & journals',        to: '/accounting' },
        { icon: '💰', label: 'Payment Queue',        sub: 'Accountant dashboard',     to: '/accounting' },
        { icon: '🧾', label: 'eTax / FIRS',          sub: 'Compliance submissions',   to: '/accounting' },
      ]},
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — injected once
// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_CSS = `
.edlp-sidebar {
  width: 224px;
  min-width: 224px;
  max-width: 224px;
  height: 100vh;
  background: #0A1628;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;       /* NO horizontal scroll — ever */
  position: relative;
  z-index: 40;
}
.edlp-sidebar-nav {
  flex: 1;
  overflow-y: auto;       /* vertical scroll when items overflow */
  overflow-x: hidden;     /* hard stop — no horizontal scroll */
  padding: 10px 8px 10px;
  /* custom thin scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.12) transparent;
}
.edlp-sidebar-nav::-webkit-scrollbar { width: 4px; }
.edlp-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
.edlp-sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
.edlp-sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

/* Nav link base */
.edlp-nl {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
  position: relative;
  user-select: none;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;       /* no horizontal overflow from text */
  min-width: 0;
}
.edlp-nl:hover { background: rgba(255,255,255,0.06); color: #fff; }
.edlp-nl.standalone-active { background: #E8A020; color: #0A1628; font-weight: 700; }
.edlp-nl.flyout-active { background: rgba(232,160,32,0.14); color: #E8A020; }
.edlp-nl-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.edlp-nl-icon { width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.edlp-nl-chevron { flex-shrink: 0; opacity: 0.45; transition: transform 0.15s, opacity 0.15s; }
.edlp-nl.flyout-active .edlp-nl-chevron { opacity: 1; transform: translateX(2px); }

/* Section label */
.edlp-section-label {
  color: rgba(255,255,255,0.28);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 10px 4px;
  white-space: nowrap;
  overflow: hidden;
}

/* Flyout panel */
.edlp-flyout {
  position: fixed;
  top: 0;
  left: 224px;
  height: 100vh;
  width: 220px;
  background: #fff;
  border-right: 0.5px solid #E5EBF2;
  box-shadow: 6px 0 28px rgba(10,22,40,0.13);
  z-index: 39;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(-12px);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.edlp-flyout.open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: all;
}
.edlp-flyout-header {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 0 10px;
  border-bottom: 0.5px solid #F0F4F8;
  flex-shrink: 0;
}
.edlp-flyout-back {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #8A9AB5;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.edlp-flyout-back:hover { background: #F0F4F8; color: #1C2B3A; }
.edlp-flyout-title { font-size: 13px; font-weight: 700; color: #0A1628; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edlp-flyout-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 0 16px;
  scrollbar-width: thin;
  scrollbar-color: #E5EBF2 transparent;
}
.edlp-flyout-body::-webkit-scrollbar { width: 3px; }
.edlp-flyout-body::-webkit-scrollbar-thumb { background: #E5EBF2; border-radius: 3px; }
.edlp-flyout-section {
  padding: 10px 14px 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #B0BCC8;
}
.edlp-flyout-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: 1px 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #3A4A5C;
  border-radius: 7px;
  border-left: 2px solid transparent;
  transition: background 0.1s, color 0.1s;
  text-decoration: none;
  min-width: 0;
}
.edlp-flyout-item:hover { background: #F6F8FB; color: #0A1628; }
.edlp-flyout-item.fli-active { background: #FDF3DC; color: #C98516; border-left-color: #E8A020; font-weight: 600; }
.edlp-flyout-item-icon { width: 24px; height: 24px; border-radius: 6px; background: #F4F6FA; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.edlp-flyout-item.fli-active .edlp-flyout-item-icon { background: rgba(232,160,32,0.14); }
.edlp-flyout-item-text { flex: 1; min-width: 0; overflow: hidden; }
.edlp-flyout-item-label { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px; }
.edlp-flyout-item-sub { font-size: 10px; color: #8A9AB5; font-weight: 400; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.edlp-new-pill { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 5px; background: #EAF5EE; color: #1A6E3A; flex-shrink: 0; }

/* Backdrop */
.edlp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 38;
  display: none;
}
.edlp-backdrop.open { display: block; }

/* approval count badge */
.edlp-appr-badge {
  font-size: 9px; font-weight: 700;
  padding: 1px 5px; border-radius: 10px;
  background: #C0392B; color: #fff;
  min-width: 16px; text-align: center;
  flex-shrink: 0;
  line-height: 1.5;
}
`

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function AppLayout() {
  const navigate     = useNavigate()
  const location     = useLocation()
  const queryClient  = useQueryClient()
  const user         = useAuthStore(s => s.user)
  const isAdminLike  = useAuthStore(s => s.isAdminLike())
  const setUser      = useAuthStore(s => s.setUser)
  const clearSession = useAuthStore(s => s.clearSession)

  const [openFlyout, setOpenFlyout] = useState(null)  // flyoutKey string | null
  const [activeSub, setActiveSub]   = useState({})    // { [flyoutKey]: itemLabel }
  const [userMenuOpen, setUserMenu] = useState(false)
  const userMenuRef = useRef(null)

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('edlp-sidebar-css')) return
    const style = document.createElement('style')
    style.id    = 'edlp-sidebar-css'
    style.textContent = SIDEBAR_CSS
    document.head.appendChild(style)
  }, [])

  // Close flyout when route changes
  useEffect(() => { setOpenFlyout(null) }, [location.pathname])

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────
  const branchesQ = useQuery({
    queryKey: ['branches', 'all'],
    enabled:  Boolean(isAdminLike),
    queryFn:  async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const pendingCountQ = useQuery({
    queryKey: ['approval-count'],
    queryFn:  async () => {
      try {
        const res = await api.get('/approvals/pending-count')
        return res.data?.data?.count ?? 0
      } catch { return 0 }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const switchBranchMut = useMutation({
    mutationFn: branchId => api.post('/auth/switch-branch', { branch_id: branchId }),
    onSuccess: async res => {
      if (res.data?.data) setUser(res.data.data)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Branch switched')
      setUserMenu(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Branch switch failed'),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFlyoutToggle = useCallback((key) => {
    setOpenFlyout(prev => prev === key ? null : key)
  }, [])

  const closeFlyout = useCallback(() => setOpenFlyout(null), [])

  async function logout() {
    try { await api.delete('/auth/logout') } catch {}
    clearSession()
    toast.success('Logged out')
    navigate('/login', { replace: true })
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const pendingCount = pendingCountQ.data ?? 0
  const initials     = user?.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?'
  const roleName     = typeof user?.roles?.[0] === 'object'
    ? user?.roles?.[0]?.name
    : user?.roles?.[0]

  // Check if current route belongs to a flyout's items
  function isFlyoutSectionActive(flyoutKey) {
    const menu = FLYOUT_MENUS[flyoutKey]
    if (!menu) return false
    // Use exact match only — prevents /products matching /products/categories etc.
    return menu.sections.some(sec =>
      sec.items.some(item => item.to !== '/' && location.pathname === item.to)
    )
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function renderNavLink(item, idx) {
    if (item.type === 'standalone') {
      return (
        <NavLink
          key={item.to + idx}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            'edlp-nl' + (isActive ? ' standalone-active' : '')
          }
          onClick={closeFlyout}
        >
          <span className="edlp-nl-icon"><item.icon size={15} /></span>
          <span className="edlp-nl-label" style={item.major ? { fontWeight: 700 } : {}}>
            {item.label}
          </span>
          {item.badge && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: item.badge.bg, color: item.badge.color, flexShrink: 0 }}>
              {item.badge.text}
            </span>
          )}
          {item.approvalBadge && pendingCount > 0 && (
            <span className="edlp-appr-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
          )}
        </NavLink>
      )
    }

    // flyout type
    const isOpen   = openFlyout === item.flyoutKey
    const isActive = isFlyoutSectionActive(item.flyoutKey)

    return (
      <div
        key={item.flyoutKey + idx}
        className={'edlp-nl' + (isOpen || isActive ? ' flyout-active' : '')}
        onClick={() => handleFlyoutToggle(item.flyoutKey)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleFlyoutToggle(item.flyoutKey)}
      >
        <span className="edlp-nl-icon"><item.icon size={15} /></span>
        <span className="edlp-nl-label">{item.label}</span>
        <ChevronRight size={13} className="edlp-nl-chevron" />
      </div>
    )
  }

  // ── Flyout panel ───────────────────────────────────────────────────────────
  const currentMenu = openFlyout ? FLYOUT_MENUS[openFlyout] : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--edlp-bg)' }}>

      {/* ── 224px SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className="edlp-sidebar">

        {/* Logo */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShoppingCart size={16} color="#0A1628" />
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>EDLP Nig Ltd</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, whiteSpace: 'nowrap' }}>Hybrid POS System</div>
          </div>
        </div>

        {/* Branch scope badge */}
        {user?.branch && (
          <div style={{ margin: '10px 12px 0', padding: '6px 10px', background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 8, color: '#E8A020', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
            {user.branch.is_head_office ? '🏢 Head Office' : `📍 ${user.branch.name}`}
          </div>
        )}

        {/* ── NAVIGATION (scrollable, no horizontal scroll) ── */}
        <nav className="edlp-sidebar-nav">

          {/* Top standalone items: Dashboard + POS */}
          {NAV.top.map((item, i) => renderNavLink(item, i))}

          {/* Sectioned items */}
          {NAV.sections.map((section, si) => (
            <div key={si}>
              <div className="edlp-section-label">{section.label}</div>
              {section.items.map((item, ii) => renderNavLink(item, ii))}
            </div>
          ))}

        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A1628', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? user?.email ?? 'User'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {roleName ?? 'Staff'}
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            <LogOut size={14} />
          </button>
        </div>

      </aside>

      {/* ── FLYOUT PANEL ───────────────────────────────────────────────────── */}
      <div className={`edlp-flyout${openFlyout ? ' open' : ''}`} role="dialog" aria-label="Sub-navigation">

        <div className="edlp-flyout-header">
          {/* ← Back arrow points LEFT (outward, toward the main content) — closes flyout */}
          <div
            className="edlp-flyout-back"
            onClick={closeFlyout}
            title="Close panel"
            role="button"
          >
            <ArrowLeft size={16} />
          </div>
          <span className="edlp-flyout-title">{currentMenu?.title ?? ''}</span>
        </div>

        <div className="edlp-flyout-body">
          {currentMenu?.sections.map((sec, si) => (
            <div key={si}>
              {sec.label && (
                <div className="edlp-flyout-section">{sec.label}</div>
              )}
              {sec.items.map((item, ii) => {
                // Only active when current route exactly matches this item
                const isActive = item.to !== '/' && location.pathname === item.to

                return (
                  <div
                    key={ii}
                    className={'edlp-flyout-item' + (isActive ? ' fli-active' : '')}
                    onClick={() => {
                      navigate(item.to)
                      closeFlyout()
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(item.to)}
                  >
                    <div className="edlp-flyout-item-icon">{item.icon}</div>
                    <div className="edlp-flyout-item-text">
                      <div className="edlp-flyout-item-label">
                        {item.label}
                        {item.isNew && <span className="edlp-new-pill">NEW</span>}
                      </div>
                      <div className="edlp-flyout-item-sub">{item.sub}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── BACKDROP — closes flyout on click ──────────────────────────────── */}
      <div
        className={`edlp-backdrop${openFlyout ? ' open' : ''}`}
        onClick={closeFlyout}
        aria-hidden="true"
      />

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #E5EBF2', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', flexShrink: 0 }}>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Pending approvals pill */}
          {pendingCount > 0 && (
            <button
              onClick={() => navigate('/approvals')}
              style={{ background: '#FDECEA', border: '1px solid #FACAC5', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#C0392B' }}
            >
              <CheckCircle size={13} /> {pendingCount} pending
            </button>
          )}

          {/* Bell */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--edlp-text-light)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <Bell size={18} />
          </button>

          {/* User menu */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              onClick={() => setUserMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 20, border: '1px solid #E5EBF2', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A1628', fontSize: 10, fontWeight: 700 }}>
                {initials}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--edlp-text)' }}>
                {user?.name?.split(' ')[0] ?? 'User'}
              </span>
            </button>

            {userMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', border: '1px solid #E5EBF2', borderRadius: 10, boxShadow: '0 10px 30px rgba(15,23,42,0.12)', minWidth: 230, zIndex: 100, padding: 12 }}>

                {/* User info */}
                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--edlp-text)' }}>{user?.name ?? 'User'}</div>
                  <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 2 }}>{user?.email}</div>
                  <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>{roleName ?? 'Staff'}</div>
                </div>

                {/* Branch switcher — admin+ only */}
                {isAdminLike && (
                  <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Switch Branch
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select
                        value={user?.branch?.id ?? ''}
                        onChange={e => switchBranchMut.mutate(Number(e.target.value))}
                        disabled={branchesQ.isLoading || switchBranchMut.isPending}
                        style={{ flex: 1, fontSize: 12, border: '1px solid #D5DFE9', borderRadius: 6, padding: '5px 8px', color: 'var(--edlp-text)', outline: 'none', cursor: 'pointer', background: '#fff' }}
                      >
                        <option value="" disabled>Select branch…</option>
                        {(branchesQ.data ?? []).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      {switchBranchMut.isPending && (
                        <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} color="#8A9AB5" />
                      )}
                    </div>
                  </div>
                )}

                {/* Logout */}
                <button
                  onClick={logout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600, border: '1px solid #FDECEA', background: '#FDECEA', color: '#C0392B', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 24 }}>
          <Outlet />
        </main>

      </div>
    </div>
  )
}
