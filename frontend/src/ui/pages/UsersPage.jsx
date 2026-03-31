/**
 * UsersPage v3 — Identity & Access Management (IAM)
 * ─────────────────────────────────────────────────────────────────────────────
 * Three tabs:
 *   1. Users       — full user list, create/edit/deactivate, role assignment
 *   2. Roles       — list all 9 roles, click to inspect full permission set
 *   3. Permissions — matrix view; super-admin can grant/revoke per role
 *
 * Backend endpoints consumed:
 *   GET  /api/users                        – paginated user list
 *   POST /api/users                        – create user
 *   PUT  /api/users/:id                    – update user
 *   PATCH /api/users/:id/toggle-active     – activate / deactivate
 *   POST /api/users/:id/reset-password     – force password reset
 *   GET  /api/roles                        – list roles (NEW)
 *   GET  /api/roles/:role/permissions      – permissions for a role (NEW)
 *   PUT  /api/roles/:role/permissions      – sync role permissions (NEW, super-admin)
 *   GET  /api/permissions                  – all permissions grouped (NEW)
 *   GET  /api/branches?all=true            – branch list for assignment
 */
import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import {
  UserPlus, Pencil, RotateCcw, Trash2, Building2,
  ShieldCheck, Shield, Users, Lock, CheckCircle2,
  XCircle, ChevronRight, Search, RefreshCw, Eye, EyeOff,
  AlertTriangle, UserCog, Loader2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  Btn, Card, DataTable, Badge, Modal, ConfirmDialog,
  FormField, FormInput, FormSelect, Spinner, StatCard,
} from '../components/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Role metadata (colours, descriptions)
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_META = {
  'super-admin':            { label: 'Super Admin',           bg: '#EAF0FB', color: '#1A3FA6', desc: 'Full unrestricted system access. Manages roles & permissions.' },
  'ceo':                    { label: 'CEO / Executive',        bg: '#F0ECFB', color: '#5B3FA6', desc: 'Read-only analytics, cross-branch reporting, high-level approvals.' },
  'admin':                  { label: 'Admin',                  bg: '#E6F5F5', color: '#0F6E6E', desc: 'Full operational access across all modules except system settings.' },
  'accountant':             { label: 'Accountant',             bg: '#EAF5EE', color: '#1A6E3A', desc: 'Expenses, purchase orders, accounting ledger, financial reports.' },
  'receivable-accountant':  { label: 'Receivable Accountant', bg: '#E9F5EE', color: '#145E32', desc: 'B2B sales view, receivables, customer payment processing.' },
  'quality-control':        { label: 'Quality Control',        bg: '#FEF0E6', color: '#8B3E00', desc: 'Product inspection, inventory stock-take, quality reports.' },
  'b2b-sales-rep':          { label: 'B2B Sales Rep',          bg: '#EAF0FB', color: '#153D96', desc: 'B2B customer management, wholesale orders, sales leads.' },
  'branch-manager':         { label: 'Branch Manager',         bg: '#F0ECFB', color: '#5B3FA6', desc: 'Branch-scoped operations: inventory, sales, staff, reports.' },
  'cashier':                { label: 'Cashier',                bg: '#FEF0E6', color: '#C45A00', desc: 'POS sales only — view products & customers, create sales.' },
}

function roleMeta(name) {
  return ROLE_META[name] ?? { label: name, bg: '#F0F4F8', color: '#6B7A8D', desc: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission grouping / labels
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_LABELS = {
  products:        'Products',
  inventory:       'Inventory',
  sales:           'Sales',
  customers:       'Customers',
  reports:         'Reports',
  users:           'User Management',
  branches:        'Branches',
  expenses:        'Expenses',
  purchase_orders: 'Purchase Orders',
  accounting:      'Accounting & Finance',
  settings:        'Settings',
  quality:         'Quality Control',
  ceo:             'CEO / Executive',
  b2b:             'B2B / Wholesale',
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 14, radius = 6 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#E5EBF2 25%,#EEF2F7 50%,#E5EBF2 75%)',
      backgroundSize: '200% 100%',
      animation: 'edlp-shimmer 1.4s infinite',
    }} />
  )
}

function ShimmerStyle() {
  return <style>{`@keyframes edlp-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
}

function SkeletonRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <Skeleton height={14} width={i === 0 ? 180 : 100} />
        </td>
      ))}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F0F4F8', borderRadius: 12, padding: 4, width: 'fit-content' }}>
      {tabs.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => onChange(key)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          background: active === key ? '#fff' : 'transparent',
          color: active === key ? '#1C2B3A' : '#8A9AB5',
          boxShadow: active === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.15s',
        }}>
          {Icon && <Icon size={14} />} {label}
        </button>
      ))}
    </div>
  )
}

function RolePill({ name }) {
  const m = roleMeta(name)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, background: m.bg, color: m.color, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

function Avatar({ name, size = 36 }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  const hue = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,50%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
    }}>
      {initials}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────────────────────────────────────
const userSchema = z.object({
  name:              z.string().min(2, 'Name required'),
  email:             z.string().email('Valid email required'),
  phone:             z.string().optional().or(z.literal('')),
  password:          z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  role:              z.string().min(1, 'Select a role'),
  branch_id:         z.coerce.number().optional().nullable(),
  staff_id:          z.string().optional().or(z.literal('')),
  pin:               z.string().optional().or(z.literal('')),
  pin_login_enabled: z.boolean().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// USERS TAB
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab({ currentUser, isAdminLike, isSuperAdmin }) {
  const queryClient = useQueryClient()
  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [viewUser, setViewUser]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const usersQuery = useQuery({
    queryKey: ['users', { q: debouncedSearch, role: roleFilter, page }],
    queryFn: async () => {
      const res = await api.get('/users', {
        params: { search: debouncedSearch || undefined, role: roleFilter || undefined, page, per_page: 15, active_only: false },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const viewUserQuery = useQuery({
    queryKey: ['users', viewUser?.id, 'detail'],
    enabled: Boolean(viewUser?.id),
    queryFn: async () => { const res = await api.get(`/users/${viewUser.id}`); return res.data?.data },
    staleTime: 30_000,
  })

  const users    = usersQuery.data?.data ?? []
  const meta     = usersQuery.data?.meta
  const branches = branchesQuery.data ?? []

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver: zodResolver(userSchema) })

  function openCreate() {
    setEditUser(null)
    reset({ name:'',email:'',phone:'',password:'',role:'cashier',branch_id:null,staff_id:'',pin:'',pin_login_enabled:false })
    setModalOpen(true)
  }
  function openEdit(u) {
    setEditUser(u)
    reset({ name:u.name,email:u.email,phone:u.phone??'',password:'',role:u.roles?.[0]??'cashier',branch_id:u.branch_id??null,staff_id:u.staff_id??'',pin:'',pin_login_enabled:u.pin_login_enabled??false })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data }
      if (!payload.password) delete payload.password
      if (!payload.pin)      delete payload.pin
      if (!payload.branch_id) payload.branch_id = null
      return editUser ? api.put(`/users/${editUser.id}`, payload) : api.post('/users', payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success(editUser ? 'User updated' : 'User created'); setModalOpen(false) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Save failed'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User status updated') },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  const resetPwMutation = useMutation({
    mutationFn: ({ id, password }) => api.post(`/users/${id}/reset-password`, { password, password_confirmation: password }),
    onSuccess: () => toast.success('Password reset — user must log in again'),
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  const stats = useMemo(() => {
    const all = users
    return {
      total:  meta?.total ?? 0,
      active: all.filter((u) => u.is_active).length,
      admins: all.filter((u) => (u.roles ?? []).some((r) => ['super-admin','admin'].includes(r))).length,
    }
  }, [users, meta])

  // --- Fix: Prevent rendering objects as React children for "branch" column ---
  const columns = useMemo(() => [
    {
      key: 'name', header: 'Staff Member',
      cell: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={u.name} />
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{u.name}</div>
            <div style={{ fontSize: 11, color: '#8A9AB5' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      cell: (u) => (u.roles ?? []).map((r) => <RolePill key={r} name={r} />),
    },
    {
      key: 'branch', header: 'Branch',
      cell: (u) => {
        // Fix: ensure only string is rendered, not an object
        let branchName = 'All Branches'
        // Accept branch as string or {name: string}, but not full object
        if (u.branch && typeof u.branch === 'object' && u.branch !== null && typeof u.branch.name === 'string') {
          branchName = u.branch.name
        } else if (typeof u.branch === 'string') {
          branchName = u.branch
        }
        // Prevent rendering ANY object or array.
        if (typeof branchName !== 'string') branchName = 'All Branches'
        return (
          <span style={{ fontSize: 12, color: '#6B7A8D', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={12} />
            {branchName}
          </span>
        )
      },
    },
    {
      key: 'last_login', header: 'Last Login',
      cell: (u) => (
        <span style={{ fontSize: 12, color: '#8A9AB5' }}>
          {u.last_login_at ? formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true }) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      cell: (u) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: u.is_active ? '#EAF5EE' : '#F0F4F8',
            color: u.is_active ? '#1A6E3A' : '#8A9AB5',
          }}>
            {u.is_active ? 'Active' : 'Inactive'}
          </span>
          {u.pin_login_enabled && (
            <span style={{ fontSize: 10, color: '#1A3FA6', fontWeight: 600 }}>PIN enabled</span>
          )}
        </div>
      ),
    },
    ...(isAdminLike ? [{
      key: 'actions', header: '',
      cell: (u) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="View permissions" onClick={(e) => { e.stopPropagation(); setViewUser(u) }}
            style={{ padding: 5, borderRadius: 6, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#8A9AB5', display: 'flex' }}>
            <Eye size={13} />
          </button>
          <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(u) }}
            style={{ padding: 5, borderRadius: 6, border: '1px solid #E5EBF2', background: 'transparent', cursor: 'pointer', color: '#1A3FA6', display: 'flex' }}>
            <Pencil size={13} />
          </button>
          {u.id !== currentUser?.id && (
            <button title={u.is_active ? 'Deactivate' : 'Activate'} onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(u.id) }}
              style={{ padding: 5, borderRadius: 6, border: `1px solid ${u.is_active ? '#FDECEA' : '#EAF5EE'}`, background: 'transparent', cursor: 'pointer', color: u.is_active ? '#C0392B' : '#1A6E3A', display: 'flex' }}>
              {u.is_active ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
            </button>
          )}
        </div>
      ),
    }] : []),
  ], [isAdminLike, currentUser])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Total Staff', value: stats.total, icon: Users, color: '#1A3FA6' },
          { label: 'Active Users', value: stats.active, icon: CheckCircle2, color: '#1A6E3A' },
          { label: 'Administrators', value: stats.admins, icon: ShieldCheck, color: '#5B3FA6' },
          { label: 'Branches', value: branches.length, icon: Building2, color: '#C45A00' },
        ].map(({ label, value, icon, color }) => (
          <StatCard key={label} label={label} value={usersQuery.isLoading ? '…' : value} icon={icon} accent={color} />
        ))}
      </div>

      {/* Users table */}
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5', pointerEvents: 'none' }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search name or email…"
              style={{ width:'100%',padding:'9px 12px 9px 34px',fontSize:13,border:'1px solid #E5EBF2',borderRadius:9,outline:'none',boxSizing:'border-box',color:'#3A4A5C' }}
              onFocus={(e) => e.target.style.borderColor='var(--edlp-primary)'}
              onBlur={(e) => e.target.style.borderColor='#E5EBF2'}
            />
          </div>

          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            style={{ padding:'9px 12px',fontSize:13,border:'1px solid #E5EBF2',borderRadius:9,color:'#3A4A5C',background:'#fff',outline:'none',cursor:'pointer' }}>
            <option value="">All Roles</option>
            {Object.entries(ROLE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>

          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
            style={{ padding:8,borderRadius:8,border:'1px solid #E5EBF2',background:'transparent',cursor:'pointer',color:'#8A9AB5',display:'flex',alignItems:'center' }} title="Refresh">
            <RefreshCw size={14} />
          </button>

          {isAdminLike && (
            <Btn onClick={openCreate} style={{ marginLeft: 'auto' }}>
              <UserPlus size={14} /> Add Staff
            </Btn>
          )}
        </div>

        {usersQuery.isLoading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
                  {['Staff Member','Role','Branch','Last Login','Status',''].map((h) => (
                    <th key={h} style={{ padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length:8}).map((_,i)=><SkeletonRow key={i} cols={6}/>)}
              </tbody>
            </table>
          </div>
        ) : (
          <DataTable
            columns={columns} rows={users} rowKey={(u) => u.id} loading={false}
            emptyMessage="No users found."
            pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
          />
        )}
      </Card>

      {/* ── Create / Edit User Modal ─────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editUser ? `Edit Staff: ${editUser.name}` : 'Add New Staff Member'} width={660}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={saveMutation.isPending}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editUser ? 'Save Changes' : 'Create User'}
          </Btn>
        </>}
      >
        <form style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em' }}>Personal Details</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Full Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Babatunde Adeyemi" />
            </FormField>
            <FormField label="Email Address" required error={errors.email?.message}>
              <FormInput register={register('email')} error={errors.email} type="email" placeholder="staff@edlp.ng" />
            </FormField>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Phone" error={errors.phone?.message}>
              <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
            </FormField>
            <FormField label={editUser ? 'New Password (blank = unchanged)' : 'Password'} required={!editUser} error={errors.password?.message}>
              <FormInput register={register('password')} type="password" placeholder="Min 8 characters" />
            </FormField>
          </div>

          <div style={{ height:1,background:'#F0F4F8',margin:'2px 0' }} />
          <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em' }}>Role & Branch</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Role" required error={errors.role?.message}>
              <FormSelect register={register('role')} error={errors.role}>
                {Object.entries(ROLE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Branch Assignment" hint="Blank = all branches (super-admin/CEO)">
              <FormSelect register={register('branch_id')}>
                <option value="">No specific branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
          </div>

          {watch('role') && ROLE_META[watch('role')] && (
            <div style={{ padding:'10px 14px',background:'#F0F8FF',borderRadius:9,fontSize:12,color:'#1A3FA6',display:'flex',gap:8 }}>
              <ShieldCheck size={14} style={{ flexShrink:0,marginTop:1 }} />
              <span><strong>{ROLE_META[watch('role')]?.label}:</strong> {ROLE_META[watch('role')]?.desc}</span>
            </div>
          )}

          <div style={{ height:1,background:'#F0F4F8',margin:'2px 0' }} />
          <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em' }}>POS / PIN Access</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Staff ID" error={errors.staff_id?.message} hint="Required for PIN login">
              <FormInput register={register('staff_id')} placeholder="EMP001" />
            </FormField>
            <FormField label="6-Digit PIN" hint="Leave blank to keep current">
              <FormInput register={register('pin')} type="password" placeholder="••••••" maxLength={6} />
            </FormField>
          </div>
          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#3A4A5C' }}>
            <input type="checkbox" {...register('pin_login_enabled')} style={{ width:14,height:14,accentColor:'var(--edlp-primary)' }} />
            Enable PIN login for this user at POS terminals
          </label>
        </form>
      </Modal>

      {/* ── View Permissions Modal ───────────────────────────── */}
      <Modal open={Boolean(viewUser)} onClose={() => setViewUser(null)}
        title={`Staff Permissions — ${viewUser?.name}`} width={560}
      >
        {viewUser && (
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            <div style={{ display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:'#F6F8FB',borderRadius:12 }}>
              <Avatar name={viewUser.name} size={44} />
              <div>
                <div style={{ fontWeight:700,color:'#1C2B3A',fontSize:14 }}>{viewUser.name}</div>
                <div style={{ fontSize:12,color:'#8A9AB5',marginTop:2 }}>{viewUser.email}</div>
                <div style={{ display:'flex',gap:6,marginTop:6,flexWrap:'wrap' }}>
                  {(viewUser.roles??[]).map((r)=><RolePill key={r} name={r}/>)}
                </div>
              </div>
            </div>

            {viewUserQuery.isLoading ? (
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {Array.from({length:6}).map((_,i)=><Skeleton key={i} height={14}/>)}
              </div>
            ) : (
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12 }}>
                  Granted Permissions ({(viewUserQuery.data?.permissions??[]).length})
                </div>
                {(viewUserQuery.data?.permissions??[]).length === 0 ? (
                  <p style={{ fontSize:13,color:'#8A9AB5' }}>Access determined by role only — no individual overrides.</p>
                ) : (
                  <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                    {(viewUserQuery.data?.permissions??[]).map((p)=>(
                      <span key={p} style={{ fontSize:11,padding:'3px 9px',borderRadius:6,background:'#EAF0FB',color:'#1A3FA6',fontFamily:'monospace',fontWeight:600 }}>{p}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
              {[
                {
                  label: 'Branch',
                  value:
                    viewUser.branch && typeof viewUser.branch === 'object' && viewUser.branch !== null
                      ? (typeof viewUser.branch.name === 'string' ? viewUser.branch.name : 'All Branches')
                      : typeof viewUser.branch === 'string'
                        ? viewUser.branch
                        : 'All Branches'
                },
                { label:'Last Login', value: viewUser.last_login_at ? formatDistanceToNow(new Date(viewUser.last_login_at),{addSuffix:true}) : 'Never' },
                { label:'PIN Login', value: viewUser.pin_login_enabled ? '✓ Enabled' : 'Disabled' },
                { label:'Account Status', value: viewUser.is_active ? 'Active' : 'Inactive' },
              ].map(({label,value})=>(
                <div key={label}>
                  <div style={{ fontSize:11,color:'#8A9AB5',marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13,fontWeight:600,color:'#1C2B3A' }}>
                    {typeof value === 'object' && value !== null
                      ? '' // never render object as child, just empty string or fallback
                      : value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES TAB
// ─────────────────────────────────────────────────────────────────────────────
function RolesTab() {
  const [selectedRole, setSelectedRole] = useState(null)

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => { const res = await api.get('/roles'); return res.data?.data ?? [] },
    staleTime: 60_000,
  })

  const rolePermsQuery = useQuery({
    queryKey: ['roles', selectedRole, 'permissions'],
    enabled: Boolean(selectedRole),
    // Normalise API shape to always return a flat string[] of permissions
    queryFn: async () => {
      const res  = await api.get(`/roles/${selectedRole}/permissions`)
      const data = res.data?.data
      if (!data) return []
      if (Array.isArray(data)) return data
      if (Array.isArray(data.permissions)) return data.permissions
      return []
    },
    staleTime: 30_000,
  })

  const roles = rolesQuery.data ?? []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, minHeight: 500 }}>
      {/* Role list */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding:'14px 18px',borderBottom:'1px solid #F0F4F8',fontSize:12,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em' }}>
          System Roles
        </div>
        {rolesQuery.isLoading ? (
          <div style={{ padding:16,display:'flex',flexDirection:'column',gap:10 }}>
            {Array.from({length:9}).map((_,i)=><Skeleton key={i} height={48} radius={10}/>)}
          </div>
        ) : (
          <div style={{ padding:8 }}>
            {roles.map((r) => {
              const m = roleMeta(r.name)
              return (
                <button key={r.name} onClick={() => setSelectedRole(r.name)}
                  style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,
                    padding:'10px 12px',borderRadius:10,border:'none',cursor:'pointer',textAlign:'left',
                    background: selectedRole === r.name ? m.bg : 'transparent',
                    transition:'background 0.15s',
                    marginBottom:2,
                  }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:m.color,flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:600,color: selectedRole===r.name ? m.color : '#1C2B3A' }}>{m.label}</div>
                    <div style={{ fontSize:11,color:'#8A9AB5' }}>{r.permissions_count} permissions · {r.users_count} users</div>
                  </div>
                  {selectedRole===r.name && <ChevronRight size={14} color={m.color}/>}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Role detail */}
      <Card style={{ padding:0,overflow:'hidden' }}>
        {!selectedRole ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:'#8A9AB5',padding:40 }}>
            <Shield size={40} color="#E5EBF2" />
            <div style={{ fontSize:15,fontWeight:600,color:'#1C2B3A' }}>Select a role to inspect</div>
            <div style={{ fontSize:13,textAlign:'center' }}>Click any role on the left to view its full permission set.</div>
          </div>
        ) : (
          <>
            {(() => {
              const m = roleMeta(selectedRole)
              return (
                <div style={{ padding:'16px 20px',borderBottom:'1px solid #F0F4F8',display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:m.bg,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <Shield size={18} color={m.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight:700,color:'#1C2B3A',fontSize:15 }}>{m.label}</div>
                    <div style={{ fontSize:12,color:'#8A9AB5',marginTop:2 }}>{m.desc}</div>
                  </div>
                </div>
              )
            })()}

            <div style={{ padding:20,overflowY:'auto',maxHeight:480 }}>
              {rolePermsQuery.isLoading ? (
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {Array.from({length:10}).map((_,i)=><Skeleton key={i} height={14}/>)}
                </div>
              ) : (
                <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
                  {Object.entries(
                    (rolePermsQuery.data ?? []).reduce((acc, p) => {
                      const mod = p.split('.')[0]
                      ;(acc[mod] = acc[mod] ?? []).push(p)
                      return acc
                    }, {})
                  ).sort(([a],[b])=>a.localeCompare(b)).map(([module, perms]) => (
                    <div key={module}>
                      <div style={{ fontSize:11,fontWeight:700,color:'#8A9AB5',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8 }}>
                        {MODULE_LABELS[module] ?? module}
                      </div>
                      <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                        {perms.map((p) => (
                          <span key={p} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'#EAF5EE',color:'#1A6E3A',fontFamily:'monospace',fontWeight:600,display:'flex',alignItems:'center',gap:4 }}>
                            <CheckCircle2 size={11}/> {p.split('.')[1]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(rolePermsQuery.data ?? []).length === 0 && (
                    <p style={{ fontSize:13,color:'#8A9AB5' }}>No specific permissions — this role has minimal access.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS TAB  (super-admin only — can toggle per role)
// ─────────────────────────────────────────────────────────────────────────────
function PermissionsTab({ isSuperAdmin }) {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(null)
  const [localPerms, setLocalPerms] = useState(null) // null = not editing
  const [dirty, setDirty] = useState(false)

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => { const res = await api.get('/roles'); return res.data?.data ?? [] },
    staleTime: 60_000,
  })

  const permsQuery = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: async () => { const res = await api.get('/permissions'); return res.data?.data ?? {} },
    staleTime: 300_000,
  })

  const rolePermsQuery = useQuery({
    queryKey: ['roles', selectedRole, 'permissions'],
    enabled: Boolean(selectedRole),
    queryFn: async () => {
      const res = await api.get(`/roles/${selectedRole}/permissions`)
      return new Set(res.data?.data?.permissions ?? [])
    },
    staleTime: 30_000,
    onSuccess: (data) => { setLocalPerms(new Set(data)); setDirty(false) },
  })

  // On role selection, init localPerms from fetched data
  const handleRoleSelect = useCallback((roleName) => {
    setSelectedRole(roleName)
    setLocalPerms(null)
    setDirty(false)
  }, [])

  const syncMutation = useMutation({
    mutationFn: ({ role, permissions }) => api.put(`/roles/${role}/permissions`, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', selectedRole, 'permissions'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role permissions saved')
      setDirty(false)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Save failed'),
  })

  function togglePerm(perm) {
    if (!isSuperAdmin) return
    setLocalPerms((prev) => {
      const next = new Set(prev)
      next.has(perm) ? next.delete(perm) : next.add(perm)
      return next
    })
    setDirty(true)
  }

  const roles    = rolesQuery.data ?? []
  // Support both { grouped: {module: string[]} } and {module: string[]} API shapes
  const rawPermGroups = permsQuery.data ?? {}
  const grouped       = rawPermGroups.grouped && typeof rawPermGroups.grouped === 'object'
    ? rawPermGroups.grouped
    : rawPermGroups
  const isLocked = selectedRole === 'super-admin'

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
      {!isSuperAdmin && (
        <div style={{ padding:'12px 16px',background:'#FEF0E6',borderRadius:10,fontSize:13,color:'#C45A00',display:'flex',gap:8 }}>
          <AlertTriangle size={15} style={{ flexShrink:0 }} />
          Only Super Admin can modify role permissions. You can view but not edit.
        </div>
      )}

      {/* Role selector */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
        {roles.map((r) => {
          const m = roleMeta(r.name)
          return (
            <button key={r.name} onClick={() => handleRoleSelect(r.name)} style={{
              padding:'8px 16px',borderRadius:20,border:`2px solid ${selectedRole===r.name?m.color:'#E5EBF2'}`,
              cursor:'pointer',fontSize:12,fontWeight:700,
              background: selectedRole===r.name ? m.bg : '#fff',
              color: selectedRole===r.name ? m.color : '#6B7A8D',
              transition:'all 0.15s',
            }}>
              {m.label}
            </button>
          )
        })}
      </div>

      {selectedRole && (
        <Card style={{ padding:0,overflow:'hidden' }}>
          {/* Header */}
          <div style={{ padding:'14px 20px',borderBottom:'1px solid #F0F4F8',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              {(() => { const m=roleMeta(selectedRole); return (
                <span style={{ padding:'3px 12px',borderRadius:20,background:m.bg,color:m.color,fontSize:12,fontWeight:700 }}>{m.label}</span>
              )})()}
              <span style={{ fontSize:12,color:'#8A9AB5' }}>
                {rolePermsQuery.isLoading ? '…' : `${localPerms?.size ?? 0} permissions selected`}
              </span>
              {isLocked && <span style={{ fontSize:11,color:'#C45A00',fontWeight:600 }}>⚑ Super Admin has all permissions (read-only)</span>}
            </div>
            {isSuperAdmin && !isLocked && dirty && (
              <Btn onClick={() => syncMutation.mutate({ role: selectedRole, permissions: [...(localPerms??[])] })} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? <><Spinner size={12}/> Saving…</> : 'Save Changes'}
              </Btn>
            )}
          </div>

          {/* Permission matrix */}
          <div style={{ padding:20,overflowY:'auto',maxHeight:600 }}>
            {rolePermsQuery.isLoading || !localPerms ? (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {Array.from({length:12}).map((_,i)=><Skeleton key={i} height={16}/>)}
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:24 }}>
                {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([module, perms]) => (
                  <div key={module}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:'#1C2B3A',textTransform:'uppercase',letterSpacing:'0.06em' }}>
                        {MODULE_LABELS[module] ?? module}
                      </div>
                      {isSuperAdmin && !isLocked && (
                        <button onClick={() => {
                          const allGranted = perms.every((p) => localPerms.has(p))
                          setLocalPerms((prev) => {
                            const next = new Set(prev)
                            perms.forEach((p) => allGranted ? next.delete(p) : next.add(p))
                            return next
                          })
                          setDirty(true)
                        }} style={{ fontSize:11,color:'#1A3FA6',background:'none',border:'none',cursor:'pointer',fontWeight:600,padding:'2px 6px' }}>
                          {perms.every((p) => localPerms.has(p)) ? 'Revoke all' : 'Grant all'}
                        </button>
                      )}
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8 }}>
                      {perms.map((perm) => {
                        const granted = isLocked || localPerms.has(perm)
                        const action  = perm.split('.').slice(1).join('.')
                        return (
                          <button key={perm} onClick={() => togglePerm(perm)}
                            disabled={!isSuperAdmin || isLocked}
                            style={{
                              display:'flex',alignItems:'center',gap:8,
                              padding:'9px 12px',borderRadius:9,border:`1px solid ${granted?'#C3E6CC':'#E5EBF2'}`,
                              background: granted?'#EAF5EE':'#FAFBFD',
                              cursor: isSuperAdmin && !isLocked ? 'pointer' : 'default',
                              textAlign:'left',transition:'all 0.15s',
                            }}>
                            {granted
                              ? <CheckCircle2 size={14} color="#1A6E3A" style={{flexShrink:0}}/>
                              : <XCircle size={14} color="#D5DFE9" style={{flexShrink:0}}/>
                            }
                            <div>
                              <div style={{ fontSize:11,fontFamily:'monospace',fontWeight:700,color:granted?'#1A6E3A':'#8A9AB5' }}>{action}</div>
                              <div style={{ fontSize:10,color:'#B0BEC5',marginTop:1 }}>{perm}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {!selectedRole && (
        <Card style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,gap:12,color:'#8A9AB5' }}>
          <Lock size={40} color="#E5EBF2" />
          <div style={{ fontSize:15,fontWeight:600,color:'#1C2B3A' }}>Select a role to view permissions</div>
          <div style={{ fontSize:13,textAlign:'center' }}>Click any role button above to inspect and edit its permission matrix.</div>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main UsersPage
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'users',       label: 'Users',       icon: Users },
  { key: 'roles',       label: 'Roles',       icon: Shield },
  { key: 'permissions', label: 'Permissions', icon: Lock },
]

const TAB_META = {
  users:       { title: 'Staff Accounts',        subtitle: 'Manage staff accounts, branch assignments and login credentials.' },
  roles:       { title: 'Roles & Access Levels', subtitle: 'View each system role and the permission set it grants.' },
  permissions: { title: 'Permission Matrix',     subtitle: 'Grant or revoke individual permissions per role. Super Admin only.' },
}

export function UsersPage() {
  const currentUser  = useAuthStore((s) => s.user)
  const isAdminLike  = useAuthStore((s) => s.isAdminLike())
  const isSuperAdmin = useAuthStore((s) => s.hasRole('super-admin'))
  const [activeTab, setActiveTab] = useState('users')

  const { title, subtitle } = TAB_META[activeTab] ?? TAB_META.users

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ShimmerStyle />

      {/* Page header — dynamic per active tab */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:'#1C2B3A' }}>{title}</h1>
          <p style={{ margin:'4px 0 0',fontSize:13,color:'#8A9AB5' }}>{subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'users'       && <UsersTab currentUser={currentUser} isAdminLike={isAdminLike} isSuperAdmin={isSuperAdmin} />}
      {activeTab === 'roles'       && <RolesTab />}
      {activeTab === 'permissions' && <PermissionsTab isSuperAdmin={isSuperAdmin} />}
    </div>
  )
}
