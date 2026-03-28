import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { UserPlus, Pencil, RotateCcw, Trash2, Building2 } from 'lucide-react'

import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  RoleBadge, StatusDot, Modal, ConfirmDialog,
  FormField, FormInput, FormSelect, Spinner, Badge,
} from '../components/shared'

const ROLES = ['super-admin', 'admin', 'branch-manager', 'cashier']

const userSchema = z.object({
  name:       z.string().min(2, 'Name is required'),
  email:      z.string().email('Valid email required'),
  password:   z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  role:       z.enum(['super-admin', 'admin', 'branch-manager', 'cashier']),
  branch_id:  z.coerce.number().optional().nullable(),
  staff_id:   z.string().optional().nullable(),
  pin:        z.string().length(4, 'PIN must be 4 digits').optional().or(z.literal('')),
  pin_login_enabled: z.boolean().optional(),
})

export function UsersPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]           = useState('')
  const [debouncedSearch]             = useDebounce(search, 300)
  const [roleFilter, setRoleFilter]   = useState('')
  const [page, setPage]               = useState(1)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editUser, setEditUser]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resetTarget, setResetTarget]   = useState(null)

  // ── Fetch users ────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: ['users', { q: debouncedSearch, role: roleFilter, page }],
    queryFn: async () => {
      const res = await api.get('/users', {
        params: {
          search: debouncedSearch || undefined,
          role:   roleFilter || undefined,
          page,
          per_page: 15,
        },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  // ── Fetch branches for selector ───────────────────────────
  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const users = usersQuery.data?.data ?? []
  const meta  = usersQuery.data?.meta

  // ── Form ──────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(userSchema),
  })

  function openCreate() {
    setEditUser(null)
    reset({ name: '', email: '', password: '', role: 'cashier', branch_id: null, staff_id: '', pin: '', pin_login_enabled: false })
    setModalOpen(true)
  }

  function openEdit(user) {
    setEditUser(user)
    reset({
      name:             user.name,
      email:            user.email,
      password:         '',
      role:             user.roles?.[0]?.name ?? 'cashier',
      branch_id:        user.branch_id ?? null,
      staff_id:         user.staff_id ?? '',
      pin:              '',
      pin_login_enabled: user.pin_login_enabled ?? false,
    })
    setModalOpen(true)
  }

  // ── Mutations ─────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data }
      if (!payload.password) delete payload.password
      if (!payload.pin)      delete payload.pin
      if (!payload.branch_id) payload.branch_id = null

      if (editUser) {
        return api.put(`/users/${editUser.id}`, payload)
      } else {
        return api.post('/users', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(editUser ? 'User updated' : 'User created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to save user'),
  })

  const toggleMutation = useMutation({
    mutationFn: (userId) => api.patch(`/users/${userId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User status updated')
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Table columns ─────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{u.name}</div>
          {u.staff_id && <div style={{ fontSize: 11, color: '#8A9AB5' }}>ID: {u.staff_id}</div>}
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
      cell: (u) => <RoleBadge role={u.roles?.[0]?.name ?? '—'} />,
    },
    {
      key: 'branch',
      header: 'Branch',
      cell: (u) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          {u.branch ? <><Building2 size={11} />{u.branch.name}</> : '—'}
        </span>
      ),
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
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); openEdit(u) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#3A4A5C'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          >
            <Pencil size={14} />
          </button>
          <button
            title={u.is_active ? 'Deactivate' : 'Activate'}
            onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(u.id) }}
            disabled={u.id === currentUser?.id}
            style={{ background: 'none', border: 'none', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex', opacity: u.id === currentUser?.id ? 0.4 : 1 }}
            onMouseEnter={e => { if (u.id !== currentUser?.id) e.currentTarget.style.color = '#3A4A5C' }}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          >
            <RotateCcw size={14} />
          </button>
          <button
            title="Remove"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(u) }}
            disabled={u.id === currentUser?.id}
            style={{ background: 'none', border: 'none', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex', opacity: u.id === currentUser?.id ? 0.4 : 1 }}
            onMouseEnter={e => { if (u.id !== currentUser?.id) e.currentTarget.style.color = '#C0392B' }}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ], [currentUser?.id, toggleMutation])

  return (
    <div>
      <PageHeader
        title="User & Role Management"
        breadcrumb={`Branch Scope: ${currentUser?.branch?.name ?? 'All Branches'}`}
        subtitle="Manage staff accounts, roles, and branch assignments."
        actions={
          isAdminLike && (
            <Btn icon={UserPlus} onClick={openCreate}>+ Add New User</Btn>
          )
        }
      />

      <Card>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search by name, email, or role…"
            style={{ flex: 1, minWidth: 240 }}
          />
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
            style={{
              fontSize: 12, padding: '8px 12px', border: '1px solid #D5DFE9',
              borderRadius: 8, outline: 'none', color: '#3A4A5C', cursor: 'pointer',
            }}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(u) => u.id}
          loading={usersQuery.isLoading}
          emptyMessage="No users found."
          pagination={meta ? {
            current: meta.current_page,
            last:    meta.last_page,
            total:   meta.total,
            onPage:  setPage,
          } : undefined}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'Edit User' : 'Add New User'}
        width={560}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {isSubmitting || saveMutation.isPending ? <><Spinner size={12} /> Saving…</> : editUser ? 'Save Changes' : 'Create User'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handleSubmit((d) => saveMutation.mutate(d))}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Full Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Babatunde Adekunle" />
            </FormField>
            <FormField label="Email Address" required error={errors.email?.message}>
              <FormInput register={register('email')} error={errors.email} type="email" placeholder="user@edlp.ng" />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Role" required error={errors.role?.message}>
              <FormSelect register={register('role')} error={errors.role}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Branch" error={errors.branch_id?.message}>
              <FormSelect register={register('branch_id')} error={errors.branch_id}>
                <option value="">Select branch…</option>
                {(branchesQuery.data ?? []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </FormSelect>
            </FormField>
          </div>

          <FormField
            label={editUser ? 'New Password (leave blank to keep current)' : 'Password'}
            required={!editUser}
            error={errors.password?.message}
          >
            <FormInput register={register('password')} error={errors.password} type="password" placeholder="Min 8 characters" />
          </FormField>

          <div style={{ height: 1, background: '#F0F4F8' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            PIN / Cashier Login (Optional)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Staff ID" error={errors.staff_id?.message} hint="Used for PIN login at POS">
              <FormInput register={register('staff_id')} placeholder="e.g. EMP001" />
            </FormField>
            <FormField label="4-Digit PIN" error={errors.pin?.message}>
              <FormInput register={register('pin')} type="password" placeholder="••••" maxLength={4} />
            </FormField>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
            <input type="checkbox" {...register('pin_login_enabled')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
            Enable PIN login for this user
          </label>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Deactivate User"
        message={`Deactivate ${deleteTarget?.name}? Their sessions will be revoked immediately. You can re-activate them later.`}
        confirmLabel="Deactivate"
      />
    </div>
  )
}
