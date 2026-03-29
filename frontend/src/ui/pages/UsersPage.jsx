/**
 * UsersPage v2 — User & Role Management
 * Matches design Image 8: table with colored role badges, search bar,
 * "+ Add New User" gold button, Branch Scope header.
 *
 * All roles from the PermissionSeeder are supported:
 * super-admin, ceo, admin, accountant, receivable-accountant,
 * quality-control, b2b-sales-rep, branch-manager, cashier
 *
 * Adds: permissions panel per user, last login display, avatar URL, invite info.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { UserPlus, Pencil, RotateCcw, Trash2, Building2, Eye, ShieldCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Badge, Modal, ConfirmDialog, FormField, FormInput,
  FormSelect, Spinner, StatCard,
} from '../components/shared'

// ── All roles from PermissionSeeder ──────────────────────────────────────────
const ALL_ROLES = [
  { value: 'super-admin',           label: 'Super Admin',           bg: '#EAF0FB', color: '#1A3FA6' },
  { value: 'ceo',                   label: 'CEO / Executive',        bg: '#F0ECFB', color: '#5B3FA6' },
  { value: 'admin',                 label: 'Admin',                  bg: '#E6F5F5', color: '#0F6E6E' },
  { value: 'accountant',            label: 'Accountant',             bg: '#EAF5EE', color: '#1A6E3A' },
  { value: 'receivable-accountant', label: 'Receivable Accountant',  bg: '#EAF5EE', color: '#145E32' },
  { value: 'quality-control',       label: 'Quality Control',        bg: '#FEF0E6', color: '#8B3E00' },
  { value: 'b2b-sales-rep',         label: 'B2B Sales Rep',          bg: '#EAF0FB', color: '#153D96' },
  { value: 'branch-manager',        label: 'Branch Manager',         bg: '#F0ECFB', color: '#5B3FA6' },
  { value: 'cashier',               label: 'Cashier',                bg: '#FEF0E6', color: '#C45A00' },
]

const ROLE_MAP = Object.fromEntries(ALL_ROLES.map(r => [r.value, r]))

function RoleBadge({ role }) {
  const r = ROLE_MAP[role] ?? { label: role, bg: '#F0F4F8', color: '#6B7A8D' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.bg, color: r.color, whiteSpace: 'nowrap' }}>
      {r.label}
    </span>
  )
}

function StatusDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#1A6E3A' : '#8A9AB5' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#1A6E3A' : '#D5DFE9', display: 'inline-block' }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Utility: normalize roles array ─────────────────────────────
// Receives: user.roles can be [string] or array of role objects.
// Ensures get array of role names (string).
function getRoleNames(roles) {
  if (!Array.isArray(roles)) return []
  if (roles.length === 0) return []
  if (typeof roles[0] === 'string')
    return roles
  // Role objects from backend: {id, name, guard_name,...}
  return roles.map((r) => r.name ?? (typeof r === 'string' ? r : 'unknown'))
}

// ── Schema ────────────────────────────────────────────────────────────────────
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

export function UsersPage() {
  const queryClient  = useQueryClient()
  const currentUser  = useAuthStore((s) => s.user)
  const isAdminLike  = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [viewUser, setViewUser]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── Data ───────────────────────────────────────────────────
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

  const viewUserQuery = useQuery({
    queryKey: ['users', viewUser?.id, 'permissions'],
    enabled: Boolean(viewUser?.id),
    queryFn: async () => {
      const res = await api.get(`/users/${viewUser.id}`)
      return res.data?.data
    },
    staleTime: 30_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const users    = usersQuery.data?.data ?? []
  const meta     = usersQuery.data?.meta
  const branches = branchesQuery.data ?? []

  // ── Form ──────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(userSchema),
  })

  function openCreate() {
    setEditUser(null)
    reset({ name: '', email: '', phone: '', password: '', role: 'cashier', branch_id: null, staff_id: '', pin: '', pin_login_enabled: false })
    setModalOpen(true)
  }

  function openEdit(u) {
    setEditUser(u)
    const roleNames = getRoleNames(u.roles)
    reset({
      name: u.name, email: u.email, phone: u.phone ?? '', password: '',
      role: roleNames?.[0] ?? 'cashier', branch_id: u.branch_id ?? null,
      staff_id: u.staff_id ?? '', pin: '', pin_login_enabled: u.pin_login_enabled ?? false,
    })
    setModalOpen(true)
  }

  // ── Mutations ─────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data }
      if (!payload.password) delete payload.password
      if (!payload.pin)      delete payload.pin
      if (!payload.branch_id) payload.branch_id = null
      return editUser ? api.put(`/users/${editUser.id}`, payload) : api.post('/users', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(editUser ? 'User updated' : 'User created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User status updated') },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); setDeleteTarget(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Table columns ─────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: u.is_active ? 'var(--edlp-primary)' : '#E5EBF2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: u.is_active ? 'var(--edlp-navy)' : '#8A9AB5',
            fontSize: 11, fontWeight: 700, overflow: 'hidden',
          }}>
            {u.avatar_url
              ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : u.name.split(' ').slice(0,2).map(w => w[0]).join('')
            }
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{u.name}</div>
            {u.staff_id && <div style={{ fontSize: 11, color: '#8A9AB5' }}>ID: {u.staff_id}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (u) => <span style={{ color: '#6B7A8D', fontSize: 12 }}>{u.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => {
        // Defensive: get normalized array of role names
        const roleNames = getRoleNames(u.roles)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {roleNames.map(r => <RoleBadge key={r} role={r} />)}
          </div>
        )
      },
    },
    {
      key: 'branch',
      header: 'Branch',
      cell: (u) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          {u.branch ? <><Building2 size={11} />{u.branch.name}</> : <span style={{ color: '#D5DFE9' }}>—</span>}
        </span>
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      cell: (u) => u.last_login_at
        ? <span style={{ fontSize: 11, color: '#8A9AB5' }}>{formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true })}</span>
        : <span style={{ fontSize: 11, color: '#D5DFE9' }}>Never</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => <StatusDot active={u.is_active} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (u) => (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <button title="View permissions" onClick={(e) => { e.stopPropagation(); setViewUser(u) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
            onMouseEnter={e=>e.currentTarget.style.color='#5B3FA6'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
          ><ShieldCheck size={14}/></button>
          {isAdminLike && (
            <>
              <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(u) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='#3A4A5C'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Pencil size={14}/></button>
              <button title={u.is_active ? 'Deactivate' : 'Activate'}
                onClick={(e) => { e.stopPropagation(); if (u.id !== currentUser?.id) toggleMutation.mutate(u.id) }}
                disabled={u.id === currentUser?.id}
                style={{ background:'none',border:'none',cursor:u.id===currentUser?.id?'not-allowed':'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex',opacity:u.id===currentUser?.id?0.3:1 }}
                onMouseEnter={e=>{ if(u.id!==currentUser?.id) e.currentTarget.style.color='#C45A00' }} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><RotateCcw size={14}/></button>
              <button title="Remove user"
                onClick={(e) => { e.stopPropagation(); if (u.id !== currentUser?.id) setDeleteTarget(u) }}
                disabled={u.id === currentUser?.id}
                style={{ background:'none',border:'none',cursor:u.id===currentUser?.id?'not-allowed':'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex',opacity:u.id===currentUser?.id?0.3:1 }}
                onMouseEnter={e=>{ if(u.id!==currentUser?.id) e.currentTarget.style.color='#C0392B' }} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Trash2 size={14}/></button>
            </>
          )}
        </div>
      ),
    },
  ], [currentUser?.id, isAdminLike, toggleMutation])

  // ── Summary counts ─────────────────────────────────────────
  const activeCount = users.filter(u => u.is_active).length
  const pinCount    = users.filter(u => u.pin_login_enabled).length

  return (
    <div>
      <PageHeader
        title="User & Role Management"
        breadcrumb={`Branch Scope: ${currentUser?.branch?.name ?? 'All Branches'}`}
        subtitle="Manage staff accounts, roles, permissions, and branch assignments."
        actions={isAdminLike && <Btn icon={UserPlus} onClick={openCreate}>+ Add New User</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Users" value={meta?.total ?? users.length} icon={UserPlus} />
        <StatCard label="Active" value={activeCount} icon={UserPlus} accent="#1A6E3A" />
        <StatCard label="PIN Login Enabled" value={pinCount} icon={ShieldCheck} accent="#5B3FA6" />
      </div>

      <Card>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search by name, email, or role…"
            style={{ flex: 1, minWidth: 240 }}
          />
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', color: '#3A4A5C', cursor: 'pointer', background: '#fff' }}>
            <option value="">All Roles</option>
            {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={users}
          rowKey={(u) => u.id}
          loading={usersQuery.isLoading}
          emptyMessage="No users found."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* ── Create / Edit Modal ─────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editUser ? `Edit User — ${editUser.name}` : 'Add New User'} width={580}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editUser ? 'Save Changes' : 'Create User'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Full Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Babatunde Adekunle" />
            </FormField>
            <FormField label="Email Address" required error={errors.email?.message}>
              <FormInput register={register('email')} error={errors.email} type="email" placeholder="user@edlp.ng" />
            </FormField>
          </div>

          {/* Phone + Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Phone" error={errors.phone?.message}>
              <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
            </FormField>
            <FormField label={editUser ? 'New Password (leave blank)' : 'Password'} required={!editUser} error={errors.password?.message}>
              <FormInput register={register('password')} type="password" placeholder="Min 8 characters" />
            </FormField>
          </div>

          {/* Role + Branch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Role" required error={errors.role?.message}>
              <FormSelect register={register('role')} error={errors.role}>
                {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Branch Assignment" error={errors.branch_id?.message}>
              <FormSelect register={register('branch_id')} error={errors.branch_id}>
                <option value="">No branch / All branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </FormSelect>
            </FormField>
          </div>

          {/* Role permissions preview */}
          {watch('role') && (
            <div style={{ padding: '10px 12px', background: '#F6F8FB', borderRadius: 8, fontSize: 11, color: '#6B7A8D', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: '#3A4A5C' }}>Permissions for {watch('role')}: </span>
              {watch('role') === 'super-admin' && 'Full system access — all permissions.'}
              {watch('role') === 'admin' && 'Products, inventory, sales, customers, reports, users, branches, expenses, purchase orders, settings.'}
              {watch('role') === 'branch-manager' && 'Products, inventory (adjust/transfer), sales (void/refund), customers, reports, expenses, purchase orders.'}
              {watch('role') === 'cashier' && 'View products & inventory, create sales only.'}
              {watch('role') === 'accountant' && 'Expenses, purchase orders, reports (finance), accounting ledger.'}
              {watch('role') === 'quality-control' && 'View products & inventory, stock-take, quality checks and reports.'}
              {watch('role') === 'ceo' && 'All reports, analytics, view across all branches, approve expenses and purchase orders.'}
              {watch('role') === 'b2b-sales-rep' && 'B2B customer management, wholesale orders, lead management.'}
              {watch('role') === 'receivable-accountant' && 'Sales view, B2B customers, receivables and payment processing.'}
            </div>
          )}

          <div style={{ height: 1, background: '#F0F4F8' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            PIN / Cashier Login
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Staff ID" error={errors.staff_id?.message} hint="Required for PIN login at POS">
              <FormInput register={register('staff_id')} placeholder="EMP001" />
            </FormField>
            <FormField label="4-Digit PIN" error={errors.pin?.message} hint="Leave blank to keep current">
              <FormInput register={register('pin')} type="password" placeholder="••••" maxLength={4} />
            </FormField>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
            <input type="checkbox" {...register('pin_login_enabled')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
            Enable PIN login for this user at POS terminals
          </label>
        </form>
      </Modal>

      {/* ── View Permissions Modal ──────────────────────────── */}
      <Modal open={Boolean(viewUser)} onClose={() => setViewUser(null)}
        title={`Permissions — ${viewUser?.name}`} width={560}
      >
        {viewUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* User header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F6F8FB', borderRadius: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--edlp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--edlp-navy)', fontWeight: 700, fontSize: 14 }}>
                {viewUser.name.split(' ').slice(0,2).map(w=>w[0]).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#1C2B3A' }}>{viewUser.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {getRoleNames(viewUser.roles).map(r => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
            </div>

            {/* Permissions grid */}
            {viewUserQuery.isLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#8A9AB5' }}><Spinner size={18} /></div>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Granted Permissions ({(viewUserQuery.data?.permissions ?? []).length})
                </div>
                {(viewUserQuery.data?.permissions ?? []).length === 0 ? (
                  <div style={{ color: '#8A9AB5', fontSize: 13 }}>No explicit permissions — access is determined by role.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(viewUserQuery.data?.permissions ?? []).map(p => (
                      <span key={p} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#EAF0FB', color: '#1A3FA6', fontFamily: 'monospace', fontWeight: 600 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Account details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Branch</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{viewUser.branch?.name ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Last Login</div>
                <div style={{ fontSize: 13 }}>{viewUser.last_login_at ? formatDistanceToNow(new Date(viewUser.last_login_at), { addSuffix: true }) : 'Never'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>PIN Login</div>
                <div style={{ fontSize: 13 }}>{viewUser.pin_login_enabled ? <Badge color="success">Enabled</Badge> : <Badge color="default">Disabled</Badge>}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 2 }}>Status</div>
                <div style={{ fontSize: 13 }}>{viewUser.is_active ? <Badge color="success">Active</Badge> : <Badge color="danger">Inactive</Badge>}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ──────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Deactivate User"
        message={`Deactivate ${deleteTarget?.name}? Their active sessions will be revoked immediately. You can re-activate them at any time.`}
        confirmLabel="Deactivate User"
      />
    </div>
  )
}
