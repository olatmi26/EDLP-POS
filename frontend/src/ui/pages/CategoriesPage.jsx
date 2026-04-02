/**
 * CategoriesPage — Product Category Management
 *
 * GET    /api/categories?nested=true    — tree structure
 * POST   /api/categories                — create
 * PUT    /api/categories/:id            — update
 * DELETE /api/categories/:id            — delete (guard: no products/children)
 * PATCH  /api/categories/:id/toggle     — activate / deactivate
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronRight, FolderOpen, Folder } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import {
  PageHeader, Btn, SearchInput, Card, Badge,
  Modal, ConfirmDialog, FormField, FormInput, FormSelect,
  Spinner, StatCard,
} from '../components/shared'

const schema = z.object({
  name:        z.string().min(2, 'Name required (min 2 chars)'),
  description: z.string().optional().or(z.literal('')),
  parent_id:   z.coerce.number().nullable().optional(),
  sort_order:  z.coerce.number().min(0).optional(),
  is_active:   z.boolean().optional(),
})

function CategoryRow({ cat, depth = 0, onEdit, onDelete, onToggle, isAdminLike }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = cat.children?.length > 0
  const indent = depth * 20

  return (
    <>
      <tr style={{ borderBottom: '0.5px solid #F0F4F8' }}>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: indent }}>
            {hasChildren ? (
              <button
                onClick={() => setExpanded(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9AB5', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {expanded
                  ? <FolderOpen size={15} color="#E8A020" />
                  : <Folder size={15} color="#8A9AB5" />
                }
              </button>
            ) : (
              <span style={{ width: 15, display: 'inline-block' }}>
                {depth > 0 ? <ChevronRight size={11} color="#C8D4E0" /> : null}
              </span>
            )}
            <span style={{ fontWeight: depth === 0 ? 700 : 500, color: '#1C2B3A', fontSize: 13 }}>
              {cat.name}
            </span>
            {cat.slug && (
              <code style={{ fontSize: 10, color: '#8A9AB5', background: '#F4F6FA', padding: '1px 5px', borderRadius: 3 }}>
                {cat.slug}
              </code>
            )}
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6B7A8D' }}>
          {cat.description || <span style={{ color: '#C8D4E0' }}>—</span>}
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
          <span style={{ fontWeight: 700, color: '#1A3FA6', fontSize: 13 }}>{cat.products_count ?? 0}</span>
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: cat.is_active ? '#EAF5EE' : '#F0F4F8',
            color: cat.is_active ? '#1A6E3A' : '#8A9AB5',
          }}>
            {cat.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        {isAdminLike && (
          <td style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Btn size="sm" variant="ghost" onClick={() => onToggle(cat)}>
                {cat.is_active ? 'Deactivate' : 'Activate'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => onEdit(cat)}>
                <Pencil size={12} />
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => onDelete(cat)}>
                <Trash2 size={12} />
              </Btn>
            </div>
          </td>
        )}
      </tr>
      {hasChildren && expanded && cat.children.map(child => (
        <CategoryRow
          key={child.id}
          cat={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          isAdminLike={isAdminLike}
        />
      ))}
    </>
  )
}

export function CategoriesPage() {
  const queryClient  = useQueryClient()
  const isAdminLike  = useAuthStore(s => s.isAdminLike())

  const [search, setSearch]       = useState('')
  const [dSearch]                 = useDebounce(search, 300)
  const [createModal, setCreate]  = useState(false)
  const [editTarget, setEdit]     = useState(null)
  const [deleteTarget, setDelete] = useState(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const catQ = useQuery({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { nested: true, all: true } })
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  // Flat list of active parent categories for the "parent" select
  const flatQ = useQuery({
    queryKey: ['categories-flat'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { all: true, top_level: true } })
      return res.data?.data ?? []
    },
    staleTime: 60_000,
    enabled: createModal || Boolean(editTarget),
  })

  // ── Create form ────────────────────────────────────────────────────────────
  const createForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', parent_id: null, sort_order: 0, is_active: true },
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/categories', { ...d, parent_id: d.parent_id || null }),
    onSuccess: () => {
      toast.success('Category created')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      queryClient.invalidateQueries({ queryKey: ['categories-flat'] })
      createForm.reset(); setCreate(false)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to create'),
  })

  // ── Edit form ──────────────────────────────────────────────────────────────
  const editForm = useForm({ resolver: zodResolver(schema) })

  function openEdit(cat) {
    editForm.reset({
      name:        cat.name,
      description: cat.description ?? '',
      parent_id:   cat.parent_id ?? null,
      sort_order:  cat.sort_order ?? 0,
      is_active:   cat.is_active,
    })
    setEdit(cat)
  }

  const editMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/categories/${id}`, { ...data, parent_id: data.parent_id || null }),
    onSuccess: () => {
      toast.success('Category updated')
      queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      queryClient.invalidateQueries({ queryKey: ['categories-flat'] })
      setEdit(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  })

  // ── Delete & toggle ────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted')
      queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      setDelete(null)
    },
    onError: e => toast.error(e?.response?.data?.message ?? 'Cannot delete'),
  })

  const toggleMut = useMutation({
    mutationFn: id => api.patch(`/categories/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories-tree'] }),
    onError: e => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const tree = catQ.data ?? []

  const filteredTree = dSearch
    ? tree.filter(cat =>
        cat.name.toLowerCase().includes(dSearch.toLowerCase()) ||
        cat.children?.some(c => c.name.toLowerCase().includes(dSearch.toLowerCase()))
      )
    : tree

  const totalCats    = tree.reduce((s, c) => s + 1 + (c.children?.length ?? 0), 0)
  const activeCats   = tree.reduce((s, c) => s + (c.is_active ? 1 : 0) + (c.children?.filter(ch => ch.is_active).length ?? 0), 0)
  const totalProducts = tree.reduce((s, c) => s + (c.products_count ?? 0) + (c.children?.reduce((ss, ch) => ss + (ch.products_count ?? 0), 0) ?? 0), 0)

  const parentOptions = flatQ.data ?? []

  function FormFields({ form, isEdit = false }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Category Name *" error={form.formState.errors.name?.message}>
          <FormInput register={form.register('name')} placeholder="e.g. Food & Beverages" autoFocus />
        </FormField>
        <FormField label="Description">
          <textarea
            {...form.register('description')}
            rows={2}
            placeholder="Optional description…"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D5DFE9', borderRadius: 8, fontSize: 13, color: '#3A4A5C', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Parent Category (optional)">
            <FormSelect register={form.register('parent_id')}>
              <option value="">None — top level</option>
              {parentOptions
                .filter(p => !isEdit || p.id !== editTarget?.id)
                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              }
            </FormSelect>
          </FormField>
          <FormField label="Sort Order">
            <FormInput register={form.register('sort_order')} type="number" min={0} placeholder="0" />
          </FormField>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="cat_active" {...form.register('is_active')} defaultChecked />
          <label htmlFor="cat_active" style={{ fontSize: 13, color: '#3A4A5C', cursor: 'pointer' }}>Active</label>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Product Categories"
        subtitle="Organise your product catalogue with hierarchical categories. Sub-categories nest under parent categories."
        actions={isAdminLike ? <Btn onClick={() => setCreate(true)}><Plus size={14} /> New Category</Btn> : undefined}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <StatCard label="Total Categories"  value={catQ.isLoading ? '…' : totalCats}    accent="#1A3FA6" />
        <StatCard label="Active"             value={catQ.isLoading ? '…' : activeCats}   accent="#1A6E3A" />
        <StatCard label="Parent Categories"  value={catQ.isLoading ? '…' : tree.length}  accent="#5B3FA6" />
        <StatCard label="Products Assigned"  value={catQ.isLoading ? '…' : totalProducts} accent="#0F6E6E" />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10 }}>
        <SearchInput
          value={search}
          onChange={e => setSearch(typeof e === 'string' ? e : e?.target?.value ?? '')}
          placeholder="Search categories…"
        />
      </div>

      {/* Tree table */}
      <Card style={{ padding: 0 }}>
        {catQ.isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner size={24} /></div>
        ) : filteredTree.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>
            {search ? 'No categories match your search.' : 'No categories yet. Create one to get started.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F0F4F8' }}>
                {['Category', 'Description', 'Products', 'Status', ...(isAdminLike ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Products' ? 'center' : h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A9AB5', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTree.map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  depth={0}
                  onEdit={openEdit}
                  onDelete={setDelete}
                  onToggle={c => toggleMut.mutate(c.id)}
                  isAdminLike={isAdminLike}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => { setCreate(false); createForm.reset() }}
        title="New Category" width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setCreate(false); createForm.reset() }}>Cancel</Btn>
            <Btn onClick={createForm.handleSubmit(d => createMut.mutate(d))} disabled={createMut.isPending}>
              {createMut.isPending ? <><Spinner size={12} /> Creating…</> : 'Create Category'}
            </Btn>
          </div>
        }
      >
        <FormFields form={createForm} />
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editTarget)} onClose={() => setEdit(null)}
        title={`Edit — ${editTarget?.name ?? ''}`} width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <Btn onClick={editForm.handleSubmit(d => editMut.mutate({ id: editTarget.id, data: d }))} disabled={editMut.isPending}>
              {editMut.isPending ? <><Spinner size={12} /> Saving…</> : 'Save Changes'}
            </Btn>
          </div>
        }
      >
        {editTarget && <FormFields form={editForm} isEdit />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Categories with products or sub-categories cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDelete(null)}
      />
    </div>
  )
}
