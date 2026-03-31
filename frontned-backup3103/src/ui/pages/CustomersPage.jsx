import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Users, Plus, Pencil, Eye, Phone, Mail, ShoppingBag } from 'lucide-react'

import { api } from '../../lib/api'
import { money } from '../../lib/format'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, FormField, FormInput, Spinner, StatCard,
} from '../components/shared'

const customerSchema = z.object({
  name:    z.string().min(2, 'Name required'),
  phone:   z.string().min(7, 'Valid phone required'),
  email:   z.string().email().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes:   z.string().optional().or(z.literal('')),
})

export function CustomersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [viewCustomer, setViewCustomer] = useState(null)

  const customersQuery = useQuery({
    queryKey: ['customers', { q: debouncedSearch, page }],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { search: debouncedSearch || undefined, page, per_page: 15 },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const historyQuery = useQuery({
    queryKey: ['customer-history', viewCustomer?.id],
    enabled: Boolean(viewCustomer?.id),
    queryFn: async () => {
      const res = await api.get(`/customers/${viewCustomer.id}/purchase-history`)
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const customers = customersQuery.data?.data ?? []
  const meta      = customersQuery.data?.meta

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(customerSchema),
  })

  function openCreate() {
    setEditCustomer(null)
    reset({ name: '', phone: '', email: '', address: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(c) {
    setEditCustomer(c)
    reset({ name: c.name, phone: c.phone, email: c.email ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => editCustomer
      ? api.put(`/customers/${editCustomer.id}`, data)
      : api.post('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(editCustomer ? 'Customer updated' : 'Customer created')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  })

  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Customer',
      cell: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{c.name}</div>
          <div style={{ fontSize: 11, color: '#8A9AB5', display: 'flex', gap: 8 }}>
            {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{c.phone}</span>}
            {c.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} />{c.email}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'visits',
      header: 'Visits',
      cell: (c) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7A8D' }}>
          <ShoppingBag size={11} />{c.visit_count ?? 0}
        </span>
      ),
    },
    {
      key: 'total_spend',
      header: 'Total Spend',
      cell: (c) => <span style={{ fontWeight: 600, color: '#1C2B3A', fontSize: 13 }}>{money(c.total_spend ?? 0)}</span>,
    },
    {
      key: 'last_visit',
      header: 'Last Visit',
      cell: (c) => c.last_visit_at
        ? <span style={{ fontSize: 12, color: '#8A9AB5' }}>{new Date(c.last_visit_at).toLocaleDateString('en-NG')}</span>
        : '—',
    },
    {
      key: 'tier',
      header: 'Tier',
      cell: (c) => {
        const spend = c.total_spend ?? 0
        if (spend >= 500000) return <Badge color="warning">Gold</Badge>
        if (spend >= 100000) return <Badge color="info">Silver</Badge>
        return <Badge color="default">Standard</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button title="View history" onClick={(e) => { e.stopPropagation(); setViewCustomer(c) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1A3FA6'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Eye size={14} /></button>
          <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(c) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 5, borderRadius: 6, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#3A4A5C'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A9AB5'}
          ><Pencil size={14} /></button>
        </div>
      ),
    },
  ], [])

  return (
    <div>
      <PageHeader
        title="Customer Management"
        subtitle="Track customer profiles, purchase history, and AI insights."
        actions={<Btn icon={Plus} onClick={openCreate}>Add Customer</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Customers" value={meta?.total ?? '—'} icon={Users} />
        <StatCard label="This Month" value="—" icon={Users} accent="#1A3FA6" />
        <StatCard label="Returning" value="—" icon={Users} accent="#1A6E3A" />
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by name, phone, or email…" style={{ maxWidth: 360 }} />
        </div>

        <DataTable
          columns={columns}
          rows={customers}
          rowKey={(c) => c.id}
          loading={customersQuery.isLoading}
          emptyMessage="No customers found. Add your first customer to get started."
          onRowClick={(c) => setViewCustomer(c)}
          pagination={meta ? { current: meta.current_page, last: meta.last_page, total: meta.total, onPage: setPage } : undefined}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editCustomer ? 'Edit Customer' : 'Add New Customer'}
        width={480}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12} /> Saving…</> : editCustomer ? 'Save Changes' : 'Add Customer'}
          </Btn>
        </>}
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Full Name" required error={errors.name?.message}>
            <FormInput register={register('name')} error={errors.name} placeholder="Chioma Okoro" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Phone Number" required error={errors.phone?.message}>
              <FormInput register={register('phone')} type="tel" placeholder="08012345678" />
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              <FormInput register={register('email')} type="email" placeholder="chioma@email.com" />
            </FormField>
          </div>
          <FormField label="Address" error={errors.address?.message}>
            <FormInput register={register('address')} placeholder="Street address…" />
          </FormField>
          <FormField label="Notes" error={errors.notes?.message}>
            <textarea
              {...register('notes')}
              placeholder="Any relevant notes…"
              rows={3}
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#3A4A5C', resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = 'var(--edlp-primary)'}
              onBlur={e => e.target.style.borderColor = '#D5DFE9'}
            />
          </FormField>
        </form>
      </Modal>

      {/* View Customer Detail Modal */}
      <Modal
        open={Boolean(viewCustomer)}
        onClose={() => setViewCustomer(null)}
        title="Customer Profile"
        width={560}
      >
        {viewCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'var(--edlp-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--edlp-navy)', fontWeight: 700, fontSize: 16,
              }}>
                {viewCustomer.name.split(' ').map(w => w[0]).slice(0,2).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1C2B3A' }}>{viewCustomer.name}</div>
                <div style={{ fontSize: 12, color: '#8A9AB5' }}>{viewCustomer.phone} {viewCustomer.email ? `· ${viewCustomer.email}` : ''}</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Visits" value={viewCustomer.visit_count ?? 0} />
              <StatCard label="Total Spend" value={money(viewCustomer.total_spend ?? 0)} />
              <StatCard label="Last Visit" value={viewCustomer.last_visit_at ? new Date(viewCustomer.last_visit_at).toLocaleDateString('en-NG') : '—'} />
            </div>

            {/* Purchase history */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8A9AB5', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                Recent Purchases
              </div>
              {historyQuery.isLoading ? (
                <div style={{ textAlign: 'center', color: '#8A9AB5', fontSize: 13, padding: 20 }}>Loading…</div>
              ) : (historyQuery.data ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8A9AB5', fontSize: 13, padding: 20 }}>No purchase history yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(historyQuery.data ?? []).slice(0, 8).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0F4F8' }}>
                      <span style={{ fontSize: 13, color: '#3A4A5C' }}>{item.product?.name ?? `Product #${item.product_id}`}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2B3A' }}>×{item.frequency}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
