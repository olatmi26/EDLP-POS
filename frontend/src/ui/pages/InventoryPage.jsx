import { useMemo, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../components/Card'
import { Field } from '../components/Field'
import { Table } from '../components/Table'
import { StatusPill } from '../components/StatusPill'
import { useAuthStore } from '../../stores/authStore'

export function InventoryPage() {
  const [tab, setTab] = useState('list') // list | low
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounce(search, 350)
  const [status, setStatus] = useState('') // '', 'low', 'out'
  const isAdminLike = useAuthStore((s) => s.isAdminLike())

  const inventoryQuery = useQuery({
    queryKey: ['inventory', { q: debouncedSearch, status }],
    enabled: tab === 'list',
    queryFn: async () => {
      const res = await api.get('/inventory', {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
        },
      })
      return res.data
    },
    staleTime: 10_000,
  })

  const lowStockQuery = useQuery({
    queryKey: ['inventory-low-stock'],
    enabled: tab === 'low',
    queryFn: async () => {
      const res = await api.get('/inventory/low-stock')
      return res.data
    },
    staleTime: 10_000,
  })

  const rows = inventoryQuery.data?.data ?? []
  const lowRows = lowStockQuery.data?.data ?? []

  const columns = useMemo(
    () => [
      {
        key: 'product',
        header: 'Product',
        cell: (r) => <div className="font-medium">{r.product?.name ?? `#${r.product_id}`}</div>,
      },
      { key: 'quantity', header: 'Qty' },
      { key: 'reserved_quantity', header: 'Reserved' },
      { key: 'available_quantity', header: 'Available' },
      { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">Inventory</div>
          <div className="text-xs text-slate-600">Branch-scoped stock. Cashiers are view-only.</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('list')}
            className={[
              'rounded px-3 py-2 text-xs font-medium',
              tab === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border',
            ].join(' ')}
          >
            Inventory list
          </button>
          <button
            onClick={() => setTab('low')}
            className={[
              'rounded px-3 py-2 text-xs font-medium',
              tab === 'low' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border',
            ].join(' ')}
          >
            Low stock
          </button>

          {!isAdminLike && <div className="text-[11px] text-slate-500">Adjust/transfer is admin/manager only.</div>}
        </div>
      </div>

      {tab === 'list' && (
        <Card title="Inventory list" subtitle="Uses GET /api/inventory (paginated).">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Search">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Search product name, sku…"
                />
              </Field>

              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">All</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </Field>
            </div>

            {inventoryQuery.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
            {inventoryQuery.isError && (
              <div className="text-sm text-rose-700">
                {inventoryQuery.error?.response?.data?.message ?? 'Failed to load inventory'}
              </div>
            )}

            {!inventoryQuery.isLoading && !inventoryQuery.isError && (
              <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
            )}
          </div>
        </Card>
      )}

      {tab === 'low' && (
        <Card title="Low stock" subtitle="Uses GET /api/inventory/low-stock.">
          <div className="space-y-3">
            {lowStockQuery.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
            {lowStockQuery.isError && (
              <div className="text-sm text-rose-700">
                {lowStockQuery.error?.response?.data?.message ?? 'Failed to load low stock'}
              </div>
            )}

            {!lowStockQuery.isLoading && !lowStockQuery.isError && (
              <Table columns={columns} rows={lowRows} rowKey={(r) => r.id} />
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

