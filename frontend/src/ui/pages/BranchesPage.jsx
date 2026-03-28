import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, Users } from 'lucide-react'

import { api } from '../../lib/api'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, StatusDot,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect,
  Badge, Spinner, StatCard,
} from '../components/shared'

const branchSchema = z.object({
  name:         z.string().min(2, 'Name required'),
  code:         z.string().min(2, 'Code required').max(10),
  address:      z.string().optional().or(z.literal('')),
  city:         z.string().optional().or(z.literal('')),
  state:        z.string().optional().or(z.literal('')),
  phone:        z.string().optional().or(z.literal('')),
  is_active:    z.boolean().optional(),
  is_head_office: z.boolean().optional(),
})

const NIGERIA_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]

export function BranchesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const branchesQuery = useQuery({
    queryKey: ['branches', { q: debouncedSearch, page }],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { search: debouncedSearch || undefined, page, per_page: 15 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const branches = branchesQuery.data?.data ?? []
  const meta     = branchesQuery.data?.meta

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(branchSchema),
  })

  function openCreate() {
    setEditBranch(null)
    reset({ name: '', code: '', address: '', city: '', state: '', phone: '', is_active: true, is_head_office: false })
    setModalOpen(true)
  }

  function openEdit(b) {
    setEditBranch(b)
    reset({ name: b.name, code: b.code, address: b.address ?? '', city: b.city ?? '', state: b.state ?? '', phone: b.phone ?? '', is_active: b.is_active, is_head_office: b.is_head_office })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => editBranch
      ? api.put(`/branches/${editBranch.id}`, data)
      : api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success(editBranch ? 'Branch updated' : 'Branch created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Cannot delete this branch'),
  })

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Branch Name',
      cell: (b) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>
            {b.name}
            {b.is_head_office && (
              <Badge color="info" style={{ marginLeft: 6 }}>HQ</Badge>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#8A9AB5' }}>Code: {b.code}</div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (b) => b.city ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          <MapPin size={11} />{b.city}{b.state ? `, ${b.state}` : ''}
        </span>
      ) : '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (b) => b.phone ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          <Phone size={11} />{b.phone}
        </span>
      ) : '—',
    },
    {
      key: 'users_count',
      header: 'Staff',
      cell: (b) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          <Users size={11} />{b.users_count ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (b) => <StatusDot active={b.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(b) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#3A4A5C'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Pencil size={14} /></button>
          {!b.is_head_office && (
            <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(b) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => e.currentTarget.style.color = '#C0392B'}
              onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
            ><Trash2 size={14} /></button>
          )}
        </div>
      ),
    },
  ], [])

  return (
    <div>
      <PageHeader
        title="Branch Management"
        subtitle={`${branches.length} branches across Nigeria`}
        actions={<Btn icon={Plus} onClick={openCreate}>Add Branch</Btn>}
      />

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Branches" value={meta?.total ?? '—'} icon={Building2} />
        <StatCard label="Active" value={branches.filter(b => b.is_active).length} icon={Building2} accent="#1A6E3A" />
        <StatCard label="Head Office" value={branches.filter(b => b.is_head_office).length} icon={Building2} accent="#1A3FA6" />
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search branches…" style={{ maxWidth: 320 }} />
        </div>

        <DataTable
          columns={columns}
          rows={branches}
          rowKey={(b) => b.id}
          loading={branchesQuery.isLoading}
          emptyMessage="No branches found."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editBranch ? 'Edit Branch' : 'Add New Branch'}
        width={560}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12} /> Saving…</> : editBranch ? 'Save Changes' : 'Create Branch'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Branch Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Ajah Lagos Branch" />
            </FormField>
            <FormField label="Branch Code" required error={errors.code?.message} hint="Short unique code, e.g. LAG01">
              <FormInput register={register('code')} error={errors.code} placeholder="LAG01" />
            </FormField>
          </div>
          <FormField label="Address" error={errors.address?.message}>
            <FormInput register={register('address')} placeholder="123 Lekki-Epe Expressway" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="City" error={errors.city?.message}>
              <FormInput register={register('city')} placeholder="Lagos" />
            </FormField>
            <FormField label="State" error={errors.state?.message}>
              <select {...register('state')} style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', color: '#3A4A5C' }}>
                <option value="">Select state…</option>
                {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Phone" error={errors.phone?.message}>
            <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
          </FormField>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_active')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
              Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_head_office')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
              Head Office
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Delete Branch"
        message={`Delete branch "${deleteTarget?.name}"? This action cannot be undone. Branches with active users cannot be deleted.`}
        confirmLabel="Delete Branch"
      />
    </div>
  )
}
