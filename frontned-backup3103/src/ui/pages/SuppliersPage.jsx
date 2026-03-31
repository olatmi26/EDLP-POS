import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Truck, Plus, Pencil, Trash2, Phone, Mail, Globe } from 'lucide-react'

import { api } from '../../lib/api'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, StatusDot,
  Modal, ConfirmDialog, FormField, FormInput, Spinner, Badge,
} from '../components/shared'

const supplierSchema = z.object({
  name:             z.string().min(2, 'Name required'),
  contact_person:   z.string().optional().or(z.literal('')),
  email:            z.string().email().optional().or(z.literal('')),
  phone:            z.string().optional().or(z.literal('')),
  address:          z.string().optional().or(z.literal('')),
  website:          z.string().optional().or(z.literal('')),
  payment_terms:    z.string().optional().or(z.literal('')),
  credit_limit:     z.coerce.number().optional().nullable(),
  notes:            z.string().optional().or(z.literal('')),
  is_active:        z.boolean().optional(),
})

export function SuppliersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]             = useState('')
  const [debouncedSearch]               = useDebounce(search, 300)
  const [page, setPage]                 = useState(1)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', { q: debouncedSearch, page }],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { search: debouncedSearch || undefined, page, per_page: 15 } })
      return res.data
    },
    staleTime: 15_000,
  })

  const suppliers = suppliersQuery.data?.data ?? []
  const meta      = suppliersQuery.data?.meta

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(supplierSchema),
  })

  function openCreate() {
    setEditSupplier(null)
    reset({ name: '', contact_person: '', email: '', phone: '', address: '', website: '', payment_terms: '', credit_limit: null, notes: '', is_active: true })
    setModalOpen(true)
  }

  function openEdit(s) {
    setEditSupplier(s)
    reset({ name: s.name, contact_person: s.contact_person ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', website: s.website ?? '', payment_terms: s.payment_terms ?? '', credit_limit: s.credit_limit ?? null, notes: s.notes ?? '', is_active: s.is_active })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => editSupplier
      ? api.put(`/suppliers/${editSupplier.id}`, data)
      : api.post('/suppliers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(editSupplier ? 'Supplier updated' : 'Supplier created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Cannot delete this supplier'),
  })

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Supplier',
      cell: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{s.name}</div>
          {s.contact_person && <div style={{ fontSize: 11, color: '#8A9AB5' }}>{s.contact_person}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {s.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}><Phone size={10} />{s.phone}</span>}
          {s.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}><Mail size={10} />{s.email}</span>}
          {s.website && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1A3FA6' }}><Globe size={10} />{s.website}</span>}
        </div>
      ),
    },
    {
      key: 'payment_terms',
      header: 'Payment Terms',
      cell: (s) => s.payment_terms
        ? <Badge color="info">{s.payment_terms}</Badge>
        : <span style={{ color: '#8A9AB5', fontSize: 12 }}>—</span>,
    },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      cell: (s) => s.credit_limit
        ? <span style={{ fontWeight: 600, fontSize: 13, color: '#1C2B3A' }}>₦{Number(s.credit_limit).toLocaleString()}</span>
        : '—',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => <StatusDot active={s.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(s) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#3A4A5C'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Pencil size={14} /></button>
          <button title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C0392B'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Trash2 size={14} /></button>
        </div>
      ),
    },
  ], [])

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Manage your product suppliers and vendor relationships."
        actions={<Btn icon={Plus} onClick={openCreate}>Add Supplier</Btn>}
      />

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search suppliers…" style={{ maxWidth: 340 }} />
        </div>

        <DataTable
          columns={columns}
          rows={suppliers}
          rowKey={(s) => s.id}
          loading={suppliersQuery.isLoading}
          emptyMessage="No suppliers found. Add your first supplier to begin creating purchase orders."
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        width={560}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12} /> Saving…</> : editSupplier ? 'Save Changes' : 'Add Supplier'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Supplier Name" required error={errors.name?.message}>
              <FormInput register={register('name')} error={errors.name} placeholder="Green Foods Ltd" />
            </FormField>
            <FormField label="Contact Person" error={errors.contact_person?.message}>
              <FormInput register={register('contact_person')} placeholder="Mr. Adeyemi" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Email" error={errors.email?.message}>
              <FormInput register={register('email')} type="email" placeholder="sales@supplier.ng" />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
            </FormField>
          </div>
          <FormField label="Address" error={errors.address?.message}>
            <FormInput register={register('address')} placeholder="Supplier head office address" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Website" error={errors.website?.message}>
              <FormInput register={register('website')} placeholder="https://supplier.ng" />
            </FormField>
            <FormField label="Payment Terms" error={errors.payment_terms?.message} hint="e.g. Net-30, COD, Prepaid">
              <FormInput register={register('payment_terms')} placeholder="Net-30" />
            </FormField>
          </div>
          <FormField label="Credit Limit (₦)" error={errors.credit_limit?.message}>
            <FormInput register={register('credit_limit')} type="number" placeholder="500000" />
          </FormField>
          <FormField label="Notes">
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Additional notes about this supplier…"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = 'var(--edlp-primary)'}
              onBlur={e => e.target.style.borderColor = '#D5DFE9'}
            />
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#3A4A5C' }}>
            <input type="checkbox" {...register('is_active')} defaultChecked style={{ width: 14, height: 14, accentColor: 'var(--edlp-primary)' }} />
            Active supplier
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        title="Delete Supplier"
        message={`Delete "${deleteTarget?.name}"? Any associated purchase orders will remain but the supplier will be unlinked.`}
        confirmLabel="Delete Supplier"
      />
    </div>
  )
}
