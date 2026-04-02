/**
 * UnitsPage — Units of Measure Management
 *
 * GET    /api/units         — list all units
 * POST   /api/units         — create custom unit
 * PUT    /api/units/:id     — update
 * DELETE /api/units/:id     — delete (guard: no products using this unit)
 *
 * Default units are seeded by migration:
 * pcs, kg, g, L, ml, carton, pack, doz, crate, bag, btl, can, roll, sachet, m
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Modal, ConfirmDialog, FormField, FormInput,
  Spinner, StatCard,
} from '../components/shared'

const schema = z.object({
  name:        z.string().min(2, 'Full name required'),
  short_code:  z.string().min(1, 'Short code required').max(20, 'Max 20 chars'),
  description: z.string().optional().or(z.literal('')),
  sort_order:  z.coerce.number().min(0).optional(),
  is_active:   z.boolean().optional(),
})

export function UnitsPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [search, setSearch]       = useState('')
  const [dSearch]                 = useDebounce(search, 300)
  const [page, setPage]           = useState(1)
  const [createModal, setCreate]  = useState(false)
  const [editTarget, setEdit]     = useState(null)
  const [deleteTarget, setDelete] = useState(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const unitsQ = useQuery({
    queryKey: ['units', { q: dSearch, page }],
    queryFn: async () => {
      const res = await api.get('/units', { params: { search: dSearch || undefined, page, per_page: 30 } })
      return res.data
    },
    staleTime: 60_000,
  })

  // ── Create ─────────────────────────────────────────────────────────────────
  const createForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', short_code: '', description: '', sort_order: 0, is_active: true },
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/units', d),
    onSuccess: () => {
      toast.success('Unit created')
      queryClient.invalidateQueries({ queryKey: ['units'] })
      createForm.reset(); setCreate(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to create'),
  })

  // ── Edit ───────────────────────────────────────────────────────────────────
  const editForm = useForm({ resolver: zodResolver(schema) })

  function openEdit(unit) {
    editForm.reset({
      name:        unit.name,
      short_code:  unit.short_code,
      description: unit.description ?? '',
      sort_order:  unit.sort_order ?? 0,
      is_active:   unit.is_active,
    })
    setEdit(unit)
  }

  const editMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/units/${id}`, data),
    onSuccess: () => {
      toast.success('Unit updated')
      queryClient.invalidateQueries({ queryKey: ['units'] })
      setEdit(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  })

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/units/${id}`),
    onSuccess: () => {
      toast.success('Unit deleted')
      queryClient.invalidateQueries({ queryKey: ['units'] })
      setDelete(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Cannot delete — unit is in use'),
  })

  // ── Table ──────────────────────────────────────────────────────────────────
  const units = unitsQ.data?.data ?? []
  const meta  = unitsQ.data?.meta

  const columns = [
    {
      key: 'unit',
      header: 'Unit',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EAF0FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1A3FA6', fontFamily: 'monospace' }}>
              {r.short_code}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.name}</div>
            {r.description && (
              <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>
                {r.description.slice(0, 55)}{r.description.length > 55 ? '…' : ''}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'short_code',
      header: 'Code',
      render: r => (
        <code style={{ fontSize: 12, fontWeight: 700, background: '#F0F4F8', padding: '3px 8px', borderRadius: 5, color: '#3A4A5C' }}>
          {r.short_code}
        </code>
      ),
    },
    {
      key: 'products',
      header: 'Products Using',
      render: r => (
        <span style={{ fontWeight: 700, color: r.products_count > 0 ? '#1A3FA6' : '#C8D4E0' }}>
          {r.products_count ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: r.is_active ? '#EAF5EE' : '#F0F4F8',
          color: r.is_active ? '#1A6E3A' : '#8A9AB5',
        }}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => isAdminLike ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil size={12} />
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => setDelete(r)} disabled={(r.products_count ?? 0) > 0}>
            <Trash2 size={12} />
          </Btn>
        </div>
      ) : null,
    },
  ]

  function UnitFormFields({ form }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Full Name *" error={form.formState.errors.name?.message}>
            <FormInput register={form.register('name')} placeholder="e.g. Kilogram" autoFocus />
          </FormField>
          <FormField label="Short Code *" error={form.formState.errors.short_code?.message}>
            <FormInput register={form.register('short_code')} placeholder="e.g. kg" />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea
            {...form.register('description')}
            rows={2}
            placeholder="Optional description…"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, fontSize: 13, color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Sort Order">
            <FormInput register={form.register('sort_order')} type="number" min={0} placeholder="0" />
          </FormField>
          <FormField label="Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <input type="checkbox" id="unit_active" {...form.register('is_active')} />
              <label htmlFor="unit_active" style={{ fontSize: 13, color: '#3A4A5C', cursor: 'pointer' }}>Active</label>
            </div>
          </FormField>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Units of Measure"
        subtitle="Define units used for products — kg, pcs, litres, cartons. 15 default EDLP units are pre-configured."
        actions={isAdminLike ? <Btn onClick={() => setCreate(true)}><Plus size={14} /> New Unit</Btn> : undefined}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <StatCard label="Total Units"    value={meta?.total ?? '—'}                       accent="#1A3FA6" />
        <StatCard label="Active Units"   value={units.filter(u => u.is_active).length}    accent="#1A6E3A" />
        <StatCard label="In Use"         value={units.filter(u => (u.products_count ?? 0) > 0).length} accent="#5B3FA6" />
        <StatCard label="Custom (yours)" value={units.filter(u => (u.id ?? 0) > 15).length} accent="#0F6E6E" />
      </div>

      {/* Info box about defaults */}
      <div style={{ background: '#EAF0FB', border: '1px solid #B8CFF5', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#1A3FA6' }}>
        <strong>15 default units</strong> are pre-seeded (pcs, kg, g, L, ml, carton, pack, dozen, crate, bag, bottle, can, roll, sachet, metre).
        Add custom units for your specific product range. Units with assigned products cannot be deleted.
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }}
        placeholder="Search units…"
      />

      {/* Table */}
      <Card style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          rows={units}
          rowKey="id"
          loading={unitsQ.isLoading}
          emptyMessage="No units found."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => { setCreate(false); createForm.reset() }}
        title="New Unit of Measure" width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setCreate(false); createForm.reset() }}>Cancel</Btn>
            <Btn onClick={createForm.handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Creating…</> : 'Create Unit'}
            </Btn>
          </div>
        }
      >
        <UnitFormFields form={createForm} />
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editTarget)} onClose={() => setEdit(null)}
        title={`Edit Unit — ${editTarget?.name ?? ''}`} width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <Btn onClick={editForm.handleSubmit(d => editMut.mutate({ id: editTarget.id, data: d }))} disabled={editMut.isPending}>
              {editMut.isPending ? <><Spinner size={12} /> Saving…</> : 'Save Changes'}
            </Btn>
          </div>
        }
      >
        {editTarget && <UnitFormFields form={editForm} />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Unit"
        message={`Delete "${deleteTarget?.name} (${deleteTarget?.short_code})"? Units currently assigned to products cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDelete(null)}
      />
    </div>
  )
}
