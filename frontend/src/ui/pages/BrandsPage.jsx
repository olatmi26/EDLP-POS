/**
 * BrandsPage — Product Brand Management
 *
 * GET    /api/brands       — paginated list
 * POST   /api/brands       — create
 * PUT    /api/brands/:id   — update
 * DELETE /api/brands/:id   — delete (guard: no products)
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Globe, Tag } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable,
  Modal, ConfirmDialog, FormField, FormInput,
  Spinner, StatCard,
} from '../components/shared'

const schema = z.object({
  name:        z.string().min(2, 'Brand name required'),
  description: z.string().optional().or(z.literal('')),
  website:     z.string().url('Enter a valid URL (https://…)').optional().or(z.literal('')),
  sort_order:  z.coerce.number().min(0).optional(),
  is_active:   z.boolean().optional(),
})

export function BrandsPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore(s => s.isAdminLike())

  const [search, setSearch]       = useState('')
  const [dSearch]                 = useDebounce(search, 300)
  const [page, setPage]           = useState(1)
  const [createModal, setCreate]  = useState(false)
  const [editTarget, setEdit]     = useState(null)
  const [deleteTarget, setDelete] = useState(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const brandsQ = useQuery({
    queryKey: ['brands', { q: dSearch, page }],
    queryFn: async () => {
      const res = await api.get('/brands', { params: { search: dSearch || undefined, page, per_page: 20 } })
      return res.data
    },
    staleTime: 20_000,
  })

  // ── Create ─────────────────────────────────────────────────────────────────
  const createForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', website: '', sort_order: 0, is_active: true },
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/brands', d),
    onSuccess: () => {
      toast.success('Brand created')
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      createForm.reset(); setCreate(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to create brand'),
  })

  // ── Edit ───────────────────────────────────────────────────────────────────
  const editForm = useForm({ resolver: zodResolver(schema) })

  function openEdit(brand) {
    editForm.reset({
      name:        brand.name,
      description: brand.description ?? '',
      website:     brand.website ?? '',
      sort_order:  brand.sort_order ?? 0,
      is_active:   brand.is_active,
    })
    setEdit(brand)
  }

  const editMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/brands/${id}`, data),
    onSuccess: () => {
      toast.success('Brand updated')
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setEdit(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  })

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/brands/${id}`),
    onSuccess: () => {
      toast.success('Brand deleted')
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setDelete(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Cannot delete'),
  })

  // ── Table ──────────────────────────────────────────────────────────────────
  const brands = brandsQ.data?.data ?? []
  const meta   = brandsQ.data?.meta

  const columns = [
    {
      key: 'name',
      header: 'Brand',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F4F6FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={14} color="#8A9AB5" />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{r.name}</div>
            {r.description && <div style={{ fontSize: 11, color: '#8A9AB5', marginTop: 1 }}>{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'website',
      header: 'Website',
      render: r => r.website
        ? <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1A3FA6', textDecoration: 'none' }}>
            <Globe size={11} /> {r.website.replace(/^https?:\/\//, '').slice(0, 30)}
          </a>
        : <span style={{ color: '#C8D4E0', fontSize: 12 }}>—</span>,
    },
    {
      key: 'products',
      header: 'Products',
      render: r => <span style={{ fontWeight: 700, color: '#1A3FA6' }}>{r.products_count ?? 0}</span>,
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
          <Btn size="sm" variant="danger" onClick={() => setDelete(r)}>
            <Trash2 size={12} />
          </Btn>
        </div>
      ) : null,
    },
  ]

  // ── Shared form fields ─────────────────────────────────────────────────────
  function BrandFormFields({ form }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Brand Name *" error={form.formState.errors.name?.message}>
          <FormInput register={form.register('name')} placeholder="e.g. Dangote, Nestle, Indomie" autoFocus />
        </FormField>
        <FormField label="Description">
          <textarea
            {...form.register('description')}
            rows={2}
            placeholder="Optional brand description…"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, fontSize: 13, color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </FormField>
        <FormField label="Website" error={form.formState.errors.website?.message}>
          <FormInput register={form.register('website')} placeholder="https://brand.com" type="url" />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Sort Order">
            <FormInput register={form.register('sort_order')} type="number" min={0} placeholder="0" />
          </FormField>
          <FormField label="Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <input type="checkbox" id="brand_active" {...form.register('is_active')} />
              <label htmlFor="brand_active" style={{ fontSize: 13, color: '#3A4A5C', cursor: 'pointer' }}>Active</label>
            </div>
          </FormField>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Brands"
        subtitle="Manage product brands. Assign brands to products for better filtering, reporting, and customer experience."
        actions={isAdminLike ? <Btn onClick={() => setCreate(true)}><Plus size={14} /> New Brand</Btn> : undefined}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <StatCard label="Total Brands"   value={meta?.total ?? '—'}                          accent="#1A3FA6" />
        <StatCard label="Active Brands"  value={brands.filter(b => b.is_active).length}       accent="#1A6E3A" />
        <StatCard label="Products Assigned" value={brands.reduce((s, b) => s + (b.products_count ?? 0), 0)} accent="#5B3FA6" />
      </div>

      {/* Search */}
      <div>
        <SearchInput
          value={search}
          onChange={e => { setSearch(typeof e === 'string' ? e : e?.target?.value ?? ''); setPage(1) }}
          placeholder="Search brands…"
        />
      </div>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          rows={brands}
          rowKey="id"
          loading={brandsQ.isLoading}
          emptyMessage="No brands found. Create one to get started."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => { setCreate(false); createForm.reset() }}
        title="New Brand" width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setCreate(false); createForm.reset() }}>Cancel</Btn>
            <Btn onClick={createForm.handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Creating…</> : 'Create Brand'}
            </Btn>
          </div>
        }
      >
        <BrandFormFields form={createForm} />
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editTarget)} onClose={() => setEdit(null)}
        title={`Edit Brand — ${editTarget?.name ?? ''}`} width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <Btn onClick={editForm.handleSubmit(d => editMut.mutate({ id: editTarget.id, data: d }))} disabled={editMut.isPending}>
              {editMut.isPending ? <><Spinner size={12} /> Saving…</> : 'Save Changes'}
            </Btn>
          </div>
        }
      >
        {editTarget && <BrandFormFields form={editForm} />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Brand"
        message={`Delete "${deleteTarget?.name}"? Brands with assigned products cannot be deleted — reassign products first.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDelete(null)}
      />
    </div>
  )
}
