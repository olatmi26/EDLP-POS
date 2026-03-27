import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

const schema = z.object({
  staff_id: z.string().min(3),
  pin: z.string().min(4).max(6),
})

export function PinLoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values) {
    try {
      const res = await api.post('/auth/login-pin', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Logged in')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'PIN login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--edlp-navy)] px-4 py-10">
      <div className="grid w-full max-w-6xl grid-cols-1 items-stretch gap-0 md:grid-cols-2">
        <div className="hidden flex-col justify-between rounded-l-2xl border border-white/10 bg-gradient-to-br from-[var(--edlp-navy)] via-[var(--edlp-navy)] to-[var(--edlp-panel)] p-10 md:flex">
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">
              EDLP POS <span className="text-[var(--edlp-primary)]">•</span>
            </div>
            <div className="mt-3 text-3xl font-semibold leading-tight text-white">
              Fast, secure cashier login.
            </div>
            <div className="mt-3 text-sm text-white/70">
              Your branch is detected automatically from your mapped user profile.
            </div>
          </div>
          <div className="text-xs text-white/60">
            Enterprise-grade POS for supermarkets and mall complexes.
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[var(--edlp-surface)] p-6 md:rounded-l-none md:p-10">
          <div className="mb-6">
            <div className="text-lg font-semibold text-[var(--edlp-text)]">PIN login</div>
            <div className="text-sm text-[var(--edlp-muted)]">Fast login for cashiers.</div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--edlp-text)]">Staff ID</label>
            <input
              {...register('staff_id')}
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--edlp-primary)]"
              placeholder="08044444401"
            />
            {errors.staff_id && (
              <div className="mt-1 text-xs text-red-600">{errors.staff_id.message}</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--edlp-text)]">PIN</label>
            <input
              {...register('pin')}
              type="password"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--edlp-primary)]"
              placeholder="1234 (4–6 digits)"
            />
            {errors.pin && <div className="mt-1 text-xs text-red-600">{errors.pin.message}</div>}
          </div>

          <button
            disabled={isSubmitting}
            className="w-full rounded bg-[var(--edlp-primary)] px-3 py-2 text-sm font-semibold text-[var(--edlp-navy)] hover:brightness-95 disabled:opacity-60"
          >
            {isSubmitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

          <div className="mt-4 text-center text-xs text-[var(--edlp-muted)]">
            Admin/Manager? Use{' '}
            <Link to="/login" className="font-semibold text-[var(--edlp-text)] underline decoration-[var(--edlp-primary)] decoration-2 underline-offset-4">
              email login
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

