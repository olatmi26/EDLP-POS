import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(values) {
    try {
      const res = await api.post('/auth/login', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Welcome back')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Login failed')
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
              Enterprise retail operations, simplified.
            </div>
            <div className="mt-3 text-sm text-white/70">
              Secure access for Admins and Branch Managers. Your branch context is managed by your account mapping.
            </div>
          </div>
          <div className="text-xs text-white/60">
            Built for high-volume supermarkets, malls, and multi-branch retailers.
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[var(--edlp-surface)] p-6 md:rounded-l-none md:p-10">
          <div className="mb-6">
            <div className="text-lg font-semibold text-[var(--edlp-text)]">Sign in</div>
            <div className="text-sm text-[var(--edlp-muted)]">Use your email and password.</div>
          </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--edlp-text)]">Email</label>
            <input
              {...register('email')}
              type="email"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--edlp-primary)]"
              placeholder="admin@edlpnigeria.com"
            />
            {errors.email && <div className="mt-1 text-xs text-red-600">{errors.email.message}</div>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--edlp-text)]">Password</label>
            <input
              {...register('password')}
              type="password"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--edlp-primary)]"
              placeholder="••••••••"
            />
            {errors.password && <div className="mt-1 text-xs text-red-600">{errors.password.message}</div>}
          </div>

          <button
            disabled={isSubmitting}
            className="w-full rounded bg-[var(--edlp-primary)] px-3 py-2 text-sm font-semibold text-[var(--edlp-navy)] hover:brightness-95 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

          <div className="mt-4 text-center text-xs text-[var(--edlp-muted)]">
            Cashier? Use{' '}
            <Link to="/pin" className="font-semibold text-[var(--edlp-text)] underline decoration-[var(--edlp-primary)] decoration-2 underline-offset-4">
              PIN login
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

