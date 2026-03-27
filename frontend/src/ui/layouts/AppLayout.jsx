import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'block rounded px-3 py-2 text-sm',
          isActive
            ? 'bg-[var(--edlp-primary)] text-[var(--edlp-navy)]'
            : 'text-[var(--edlp-text)] hover:bg-black/5',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

export function AppLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdminLike = useAuthStore((s) => s.isAdminLike())
  const setUser = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)

  const branchesQuery = useQuery({
    queryKey: ['branches', 'all'],
    enabled: Boolean(isAdminLike),
    queryFn: async () => {
      const res = await api.get('/branches', { params: { all: true } })
      return res.data?.data ?? []
    },
    staleTime: 30_000,
  })

  const switchBranchMutation = useMutation({
    mutationFn: async (branchId) => {
      const res = await api.post('/auth/switch-branch', { branch_id: branchId })
      return res.data?.data
    },
    onSuccess: async (userData) => {
      if (userData) setUser(userData)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Branch switched')
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message ?? 'Branch switch failed')
    },
  })

  async function logout() {
    try {
      await api.delete('/auth/logout')
    } catch {
      // ignore network/logout failures; token will be cleared locally
    } finally {
      clearSession()
      toast.success('Logged out')
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-full bg-[var(--edlp-bg)]">
      <header className="border-b border-white/10 bg-[var(--edlp-navy)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <div className="text-sm font-semibold text-white">
              EDLP POS <span className="text-[var(--edlp-primary)]">•</span>
            </div>
            <div className="text-xs text-white/60">
              {user?.branch?.name ? `Branch: ${user.branch.name}` : '—'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdminLike && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-white/70">Branch</div>
                <select
                  value={user?.branch?.id ?? ''}
                  onChange={(e) => switchBranchMutation.mutate(Number(e.target.value))}
                  disabled={branchesQuery.isLoading || switchBranchMutation.isPending}
                  className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-[var(--edlp-primary)] disabled:opacity-60"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {(branchesQuery.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-xs text-white/80">{user?.name ?? user?.email ?? '—'}</div>
            <button
              onClick={logout}
              className="rounded bg-[var(--edlp-primary)] px-3 py-2 text-xs font-semibold text-[var(--edlp-navy)] hover:brightness-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        <aside className="col-span-12 md:col-span-3">
          <nav className="rounded border border-black/10 bg-[var(--edlp-surface)] p-2">
            <NavItem to="/">Dashboard</NavItem>
            <NavItem to="/products">Products</NavItem>
            <NavItem to="/inventory">Inventory</NavItem>
            <NavItem to="/suppliers">Suppliers</NavItem>
            <NavItem to="/purchase-orders">Purchase Orders</NavItem>
          </nav>
        </aside>

        <main className="col-span-12 md:col-span-9">
          <div className="rounded border border-black/10 bg-[var(--edlp-surface)] p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

