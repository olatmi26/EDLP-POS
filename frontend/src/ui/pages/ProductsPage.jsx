import { useMemo, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../components/Card'
import { Field } from '../components/Field'
import { Table } from '../components/Table'
import { money } from '../../lib/format'
import { StatusPill } from '../components/StatusPill'
import { useAuthStore } from '../../stores/authStore'

export function ProductsPage() {
  const [tab, setTab] = useState('list') // list | pos
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounce(search, 350)
  const [page, setPage] = useState(1)

  const productsQuery = useQuery({
    queryKey: ['products', { q: debouncedSearch, page }],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { search: debouncedSearch || undefined, page },
      })
      return res.data
    },
    enabled: tab === 'list',
    staleTime: 10_000,
  })

  const products = productsQuery.data?.data ?? []
  const meta = productsQuery.data?.meta

  const [posQuery, setPosQuery] = useState('')
  const [debouncedPosQuery] = useDebounce(posQuery, 250)

  const posSearchQuery = useQuery({
    queryKey: ['products-pos-search', { q: debouncedPosQuery }],
    queryFn: async () => {
      const res = await api.get('/products/search', { params: { q: debouncedPosQuery } })
      return res.data
    },
    enabled: tab === 'pos' && debouncedPosQuery.trim().length > 0,
    staleTime: 0,
  })

  const posResults = posSearchQuery.data?.data ?? []

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name', cell: (p) => <div className="font-medium">{p.name}</div> },
      { key: 'sku', header: 'SKU' },
      { key: 'selling_price', header: 'Price', cell: (p) => money(p.selling_price) },
      { key: 'is_active', header: 'Active', cell: (p) => (p.is_active ? 'Yes' : 'No') },
    ],
    [],
  )

  const posColumns = useMemo(
    () => [
      { key: 'name', header: 'Name', cell: (p) => <div className="font-medium">{p.name}</div> },
      { key: 'sku', header: 'SKU' },
      { key: 'barcode', header: 'Barcode' },
      { key: 'selling_price', header: 'Price', cell: (p) => money(p.selling_price) },
      { key: 'stock', header: 'Stock', cell: (p) => p.stock ?? 0 },
      { key: 'stock_status', header: 'Status', cell: (p) => <StatusPill status={p.stock_status} /> },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">Products</div>
          <div className="text-xs text-slate-600">List, search, and POS stock lookup.</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('list')}
            className={[
              'rounded px-3 py-2 text-xs font-medium',
              tab === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border',
            ].join(' ')}
          >
            Product list
          </button>
          <button
            onClick={() => setTab('pos')}
            className={[
              'rounded px-3 py-2 text-xs font-medium',
              tab === 'pos' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border',
            ].join(' ')}
          >
            POS search
          </button>

          {!isAdminLike && (
            <div className="text-[11px] text-slate-500">Create/Edit is admin/manager only.</div>
          )}
        </div>
      </div>

      {tab === 'list' && (
        <Card
          title="Product list"
          subtitle="Uses GET /api/products (paginated)."
          right={
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-500">
                Page {meta?.current_page ?? 1} / {meta?.last_page ?? 1}
              </div>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={(meta?.current_page ?? 1) <= 1}
                className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1)}
                className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field label="Search">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="Search by name, sku, barcode…"
              />
            </Field>

            {productsQuery.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
            {productsQuery.isError && (
              <div className="text-sm text-rose-700">
                {productsQuery.error?.response?.data?.message ?? 'Failed to load products'}
              </div>
            )}

            {!productsQuery.isLoading && !productsQuery.isError && (
              <Table columns={columns} rows={products} rowKey={(p) => p.id} />
            )}
          </div>
        </Card>
      )}

      {tab === 'pos' && (
        <Card title="POS product search" subtitle="Uses GET /api/products/search?q=... (includes branch stock).">
          <div className="space-y-3">
            <Field label="Query" hint="Type name, SKU, or barcode (e.g., Indomie).">
              <input
                value={posQuery}
                onChange={(e) => setPosQuery(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="Indomie"
              />
            </Field>

            {posSearchQuery.isFetching && <div className="text-sm text-slate-600">Searching…</div>}
            {posSearchQuery.isError && (
              <div className="text-sm text-rose-700">
                {posSearchQuery.error?.response?.data?.message ?? 'Search failed'}
              </div>
            )}

            <Table columns={posColumns} rows={posResults} rowKey={(p) => p.id} />
          </div>
        </Card>
      )}
    </div>
  )
}

