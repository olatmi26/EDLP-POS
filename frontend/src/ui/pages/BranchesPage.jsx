/**
 * BranchesPage v2 — Branch Management
 * Full CRUD: create, edit, delete (guarded).
 * Shows: branch table with location, phone, manager, user count, status.
 * Stats: total, active, head office count.
 * Nigeria states selector.
 * Stat cards at top + full DataTable.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, Users, Crown } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Badge, Modal, ConfirmDialog, FormField, FormInput,
  FormSelect, Spinner, StatCard,
} from '../components/shared'

const NIGERIA_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]

const branchSchema = z.object({
  name:           z.string().min(2, 'Name required'),
  code:           z.string().min(1, 'Code required').max(10, 'Max 10 chars'),
  address:        z.string().optional().or(z.literal('')),
  city:           z.string().optional().or(z.literal('')),
  state:          z.string().optional().or(z.literal('')),
  phone:          z.string().optional().or(z.literal('')),
  email:          z.string().email().optional().or(z.literal('')),
  manager_id:     z.coerce.number().optional().nullable(),
  is_active:      z.boolean().optional(),
  is_head_office: z.boolean().optional(),
})

function StatusDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#1A6E3A' : '#8A9AB5' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#1A6E3A' : '#D5DFE9', display: 'inline-block' }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function BranchesPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [statsTarget, setStatsTarget]   = useState(null) // branch stats view

  // ── Data ───────────────────────────────────────────────────
  const branchesQuery = useQuery({
    queryKey: ['branches', { q: debouncedSearch, page }],
    queryFn: async () => {
      const res = await api.get('/branches', {
        params: { search: debouncedSearch || undefined, page, per_page: 15 },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const managersQuery = useQuery({
    queryKey: ['users', 'managers'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { role: 'branch-manager', per_page: 100, active_only: true } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
  })

  const branchStatsQuery = useQuery({
    queryKey: ['branch-stats', statsTarget?.id],
    enabled: Boolean(statsTarget?.id),
    queryFn: async () => {
      const res = await api.get(`/branches/${statsTarget.id}/stats`)
      return res.data?.data
    },
    staleTime: 30_000,
  })

  const branches = branchesQuery.data?.data ?? []
  const meta     = branchesQuery.data?.meta
  const managers = managersQuery.data ?? []

  // ── Form ──────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(branchSchema),
  })

  function openCreate() {
    setEditBranch(null)
    reset({ name: '', code: '', address: '', city: '', state: '', phone: '', email: '', manager_id: null, is_active: true, is_head_office: false })
    setModalOpen(true)
  }

  function openEdit(b) {
    setEditBranch(b)
    reset({
      name: b.name, code: b.code, address: b.address ?? '', city: b.city ?? '',
      state: b.state ?? '', phone: b.phone ?? '', email: b.email ?? '',
      manager_id: b.manager_id ?? null, is_active: b.is_active, is_head_office: b.is_head_office,
    })
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
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Cannot delete — may have active users'),
  })

  // ── Table columns ──────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Branch',
      cell: (b) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: b.is_head_office ? 'rgba(232,160,32,0.12)' : '#F0F4F8',
            border: b.is_head_office ? '1px solid rgba(232,160,32,0.3)' : '1px solid #E5EBF2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {b.is_head_office
              ? <Crown size={14} color="#C98516" />
              : <Building2 size={14} color="#8A9AB5" />
            }
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>
              {b.name}
              {b.is_head_office && (
                <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(232,160,32,0.12)', color: '#C98516', fontWeight: 700 }}>HQ</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#8A9AB5', fontFamily: 'monospace' }}>{b.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (b) => (
        <div>
          {(b.city || b.state) ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
              <MapPin size={11} />{[b.city, b.state].filter(Boolean).join(', ')}
            </span>
          ) : <span style={{ color: '#D5DFE9', fontSize: 12 }}>—</span>}
          {b.address && <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>{b.address}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (b) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {b.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}><Phone size={10} />{b.phone}</span>}
          {b.email && <span style={{ fontSize: 11, color: '#8A9AB5' }}>{b.email}</span>}
          {!b.phone && !b.email && <span style={{ color: '#D5DFE9', fontSize: 12 }}>—</span>}
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      cell: (b) => b.manager
        ? <span style={{ fontSize: 12, color: '#3A4A5C', fontWeight: 500 }}>{b.manager.name}</span>
        : <span style={{ color: '#D5DFE9', fontSize: 12 }}>Unassigned</span>,
    },
    {
      key: 'users',
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
        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <button title="View today's stats" onClick={(e) => { e.stopPropagation(); setStatsTarget(b) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex',fontSize:11,fontWeight:600,gap:3,alignItems:'center' }}
            onMouseEnter={e=>e.currentTarget.style.color='#1A3FA6'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
          >Stats</button>
          {isAdminLike && (
            <>
              <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(b) }}
                style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='#3A4A5C'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
              ><Pencil size={14}/></button>
              {!b.is_head_office && (
                <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(b) }}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
                  onMouseEnter={e=>e.currentTarget.style.color='#C0392B'} onMouseLeave={e=>e.currentTarget.style.color='#8A9AB5'}
                ><Trash2 size={14}/></button>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [isAdminLike])

  const activeCount = branches.filter(b => b.is_active).length
  const hqCount     = branches.filter(b => b.is_head_office).length

  return (
    <div>
      <PageHeader
        title="Branch Management"
        subtitle="Manage all EDLP store locations and head office."
        actions={isAdminLike && <Btn icon={Plus} onClick={openCreate}>Add Branch</Btn>}
      />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Branches" value={meta?.total ?? branches.length} icon={Building2} />
        <StatCard label="Active" value={activeCount} icon={Building2} accent="#1A6E3A" />
        <StatCard label="Head Office" value={hqCount} icon={Crown} accent="#C98516" />
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search branch name or code…" style={{ maxWidth: 360 }} />
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

      {/* ── Branch Stats Modal ──────────────────────────────── */}
      <Modal open={Boolean(statsTarget)} onClose={() => setStatsTarget(null)}
        title={`Today's Stats — ${statsTarget?.name}`} width={440}
      >
        {statsTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {branchStatsQuery.isLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spinner size={24} color="#E8A020" /></div>
            ) : branchStatsQuery.data ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatCard label="Today's Revenue" value={`₦${Number(branchStatsQuery.data.today_sales ?? 0).toLocaleString()}`} icon={Building2} />
                <StatCard label="Transactions" value={branchStatsQuery.data.today_transactions ?? 0} icon={Building2} accent="#1A3FA6" />
                <StatCard label="Active Cashiers" value={branchStatsQuery.data.active_cashiers ?? 0} icon={Users} accent="#0F6E6E" />
                <StatCard label="Low Stock Items" value={branchStatsQuery.data.low_stock_count ?? 0} icon={Building2} accent="#C45A00" />
              </div>
            ) : (
              <div style={{ color: '#8A9AB5', fontSize: 13, textAlign: 'center', padding: 20 }}>No stats available.</div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Create / Edit Modal ─────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editBranch ? `Edit Branch — ${editBranch.name}` : 'Add New Branch'} width={580}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Saving…</> : editBranch ? 'Save Changes' : 'Create Branch'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FormField label="Branch Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Ajah Lagos Branch" />
            </FormField>
            <FormField label="Branch Code" required error={errors.code?.message} hint="e.g. LAG01">
              <FormInput register={register('code')} error={errors.code} placeholder="LAG01" />
            </FormField>
          </div>

          <FormField label="Street Address" error={errors.address?.message}>
            <FormInput register={register('address')} placeholder="123 Lekki-Epe Expressway, Ajah" />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="City" error={errors.city?.message}>
              <FormInput register={register('city')} placeholder="Lagos" />
            </FormField>
            <FormField label="State" error={errors.state?.message}>
              <FormSelect register={register('state')}>
                <option value="">Select state…</option>
                {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Phone" error={errors.phone?.message}>
              <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              <FormInput register={register('email')} type="email" placeholder="ajah@edlp.ng" />
            </FormField>
          </div>

          <FormField label="Branch Manager" hint="Assign an existing branch-manager role user">
            <FormSelect register={register('manager_id')}>
              <option value="">No manager assigned</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </FormSelect>
          </FormField>

          <div style={{ display: 'flex', gap: 20, paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_active')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
              Active branch
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
              <input type="checkbox" {...register('is_head_office')} style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
              This is the Head Office
            </label>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ──────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Delete Branch"
        message={`Delete branch "${deleteTarget?.name}"? Branches with active users cannot be deleted. This action is permanent.`}
        confirmLabel="Delete Branch"
      />
    </div>
  )
}
