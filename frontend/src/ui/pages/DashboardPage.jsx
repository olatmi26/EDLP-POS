import { useAuthStore } from '../../stores/authStore'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  return (
    <div className="space-y-2">
      <div className="text-base font-semibold text-slate-900">Dashboard</div>
      <div className="text-sm text-slate-600">
        Welcome{user?.name ? `, ${user.name}` : ''}.
      </div>
      <div className="rounded bg-slate-50 p-3 text-xs text-slate-700">
        Next: we’ll wire real widgets (today’s sales, low stock, pending POs) to backend APIs.
      </div>
    </div>
  )
}

