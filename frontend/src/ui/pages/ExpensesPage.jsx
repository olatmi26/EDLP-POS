import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Wallet, Plus, Pencil, Trash2, Paperclip, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, DataTable, Badge,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect,
  Spinner, StatCard,
} from '../components/shared'

const schema = z.object({
  title:               z.string().min(3, 'Title required'),
  expense_category_id: z.coerce.number().min(1, 'Select a category'),
  amount:              z.coerce.number().min(1, 'Amount required'),
  expense_date:        z.string().min(1, 'Date required'),
  description:         z.string().optional().or(z.literal('')),
})

const STATUS_COLOR = { pending:'warning', approved:'success', rejected:'danger' }

export function ExpensesPage() {
  const queryClient = useQueryClient()
  const isAdminLike = useAuthStore((s) => s.isAdminLike())
  const [search, setSearch]         = useState('')
  const [debouncedSearch]           = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]             = useState(1)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editExpense, setEditExpense]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const receiptRef = useRef(null)
  const [receiptFile, setReceiptFile]   = useState(null)

  const expensesQuery = useQuery({
    queryKey: ['expenses', { q: debouncedSearch, status: statusFilter, page }],
    queryFn: async () => {
      const res = await api.get('/expenses', {
        params: { search: debouncedSearch || undefined, status: statusFilter || undefined, page, per_page: 15 },
      })
      return res.data
    },
    staleTime: 15_000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/expense-categories')
      return res.data?.data ?? []
    },
    staleTime: 300_000,
  })

  const expenses   = expensesQuery.data?.data ?? []
  const meta       = expensesQuery.data?.meta
  const categories = categoriesQuery.data ?? []

  // Summary stats
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0)
  const totalPending  = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  function openCreate() {
    setEditExpense(null)
    setReceiptFile(null)
    reset({ title:'', expense_category_id:'', amount:'', expense_date: format(new Date(),'yyyy-MM-dd'), description:'' })
    setModalOpen(true)
  }

  function openEdit(e) {
    setEditExpense(e)
    setReceiptFile(null)
    reset({ title:e.title, expense_category_id:e.expense_category_id, amount:e.amount, expense_date:e.expense_date, description:e.description ?? '' })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => form.append(k, v ?? ''))
      if (receiptFile) form.append('receipt', receiptFile)
      const config = { headers: { 'Content-Type': 'multipart/form-data' } }
      return editExpense
        ? api.post(`/expenses/${editExpense.id}?_method=PUT`, form, config)
        : api.post('/expenses', form, config)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['expenses'] })
      toast.success(editExpense ? 'Expense updated' : 'Expense submitted for approval')
      setModalOpen(false)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:['expenses'] }); toast.success('Expense deleted'); setDeleteTarget(null) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Cannot delete approved expense'),
  })

  const columns = useMemo(() => [
    { key:'title',  header:'Title',    cell:(e) => <div><div style={{ fontWeight:600,color:'#1C2B3A',fontSize:13 }}>{e.title}</div><div style={{ fontSize:11,color:'#8A9AB5' }}>{e.category?.name}</div></div> },
    { key:'amount', header:'Amount',   cell:(e) => <span style={{ fontWeight:700,color:'#1C2B3A' }}>{money(e.amount)}</span> },
    { key:'date',   header:'Date',     cell:(e) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{format(new Date(e.expense_date),'dd MMM yyyy')}</span> },
    { key:'by',     header:'By',       cell:(e) => <span style={{ fontSize:12,color:'#6B7A8D' }}>{e.recorded_by?.name ?? '—'}</span> },
    { key:'status', header:'Status',   cell:(e) => <Badge color={STATUS_COLOR[e.status] ?? 'default'}>{e.status}</Badge> },
    { key:'receipt',header:'Receipt',  cell:(e) => e.receipt_url ? <a href={e.receipt_url} target="_blank" rel="noreferrer" style={{ color:'#1A3FA6',fontSize:11 }}>View</a> : '—' },
    { key:'actions',header:'', align:'right', cell:(e) => (
      <div style={{ display:'flex',gap:4,justifyContent:'flex-end' }}>
        {e.status === 'pending' && isAdminLike && (
          <button onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
            onMouseEnter={ev=>ev.currentTarget.style.color='#3A4A5C'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
          ><Pencil size={14}/></button>
        )}
        {e.status !== 'approved' && (
          <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e) }}
            style={{ background:'none',border:'none',cursor:'pointer',color:'#8A9AB5',padding:5,borderRadius:6,display:'flex' }}
            onMouseEnter={ev=>ev.currentTarget.style.color='#C0392B'} onMouseLeave={ev=>ev.currentTarget.style.color='#8A9AB5'}
          ><Trash2 size={14}/></button>
        )}
      </div>
    )},
  ], [isAdminLike])

  return (
    <div>
      <PageHeader title="Expense Tracking" subtitle="Submit, track and approve branch expenses."
        actions={<Btn icon={Plus} onClick={openCreate}>Add Expense</Btn>}
      />

      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20 }}>
        <StatCard label="Total Expenses" value={meta?.total ?? '—'} icon={Wallet} />
        <StatCard label="Approved (current)" value={money(totalApproved)} icon={TrendingDown} accent="#1A6E3A" />
        <StatCard label="Pending Approval" value={money(totalPending)} icon={Wallet} accent="#C45A00" />
      </div>

      <Card>
        <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search expenses…" style={{ flex:1,minWidth:220 }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ fontSize:12,padding:'8px 12px',border:'1px solid #D5DFE9',borderRadius:8,outline:'none',color:'#3A4A5C',cursor:'pointer',background:'#fff' }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <DataTable columns={columns} rows={expenses} rowKey={(e)=>e.id} loading={expensesQuery.isLoading}
          emptyMessage="No expenses found."
          pagination={meta ? { current:meta.current_page,last:meta.last_page,total:meta.total,onPage:setPage } : undefined}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editExpense ? 'Edit Expense' : 'Submit New Expense'} width={500}
        footer={<>
          <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={isSubmitting}>Cancel</Btn>
          <Btn onClick={handleSubmit((d) => saveMutation.mutate(d))} disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? <><Spinner size={12}/> Submitting…</> : editExpense ? 'Save Changes' : 'Submit for Approval'}
          </Btn>
        </>}
      >
        <form style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <FormField label="Expense Title" required error={errors.title?.message}>
            <FormInput register={register('title')} placeholder="e.g. Office supplies — Ajah branch" />
          </FormField>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Category" required error={errors.expense_category_id?.message}>
              <FormSelect register={register('expense_category_id')} error={errors.expense_category_id}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Amount (₦)" required error={errors.amount?.message}>
              <FormInput register={register('amount')} type="number" step="0.01" placeholder="5000.00" />
            </FormField>
          </div>
          <FormField label="Expense Date" required error={errors.expense_date?.message}>
            <FormInput register={register('expense_date')} type="date" />
          </FormField>
          <FormField label="Description / Notes">
            <textarea {...register('description')} rows={3} placeholder="Details about this expense…"
              style={{ width:'100%',padding:'9px 12px',fontSize:13,border:'1px solid #D5DFE9',borderRadius:8,outline:'none',boxSizing:'border-box',color:'#3A4A5C',resize:'vertical' }}
              onFocus={e=>e.target.style.borderColor='var(--edlp-primary)'} onBlur={e=>e.target.style.borderColor='#D5DFE9'}
            />
          </FormField>
          <FormField label="Receipt / Evidence (optional)">
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <label style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',border:'1px solid #D5DFE9',borderRadius:8,cursor:'pointer',fontSize:12,color:'#6B7A8D' }}>
                <Paperclip size={13}/>{receiptFile ? receiptFile.name : 'Attach file (JPG/PNG/PDF)'}
                <input ref={receiptRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              </label>
              {receiptFile && <button type="button" onClick={() => setReceiptFile(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'#C0392B',fontSize:11 }}>Remove</button>}
            </div>
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)} loading={deleteMutation.isPending}
        title="Delete Expense" message={`Delete expense "${deleteTarget?.title}"?`} confirmLabel="Delete"
      />
    </div>
  )
}
