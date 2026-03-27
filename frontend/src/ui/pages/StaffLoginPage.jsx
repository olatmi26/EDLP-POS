import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../components/Spinner'
import { AuthHeaderBar } from '../components/auth/AuthHeaderBar'
import { AuthModeTabs } from '../components/auth/AuthModeTabs'
import { NumericKeypad } from '../components/auth/NumericKeypad'
import { AuthHeroPanel, AuthSplitShell } from '../components/auth/AuthSplitShell'

const emailSchema = z.object({ email: z.string().email(), password: z.string().min(6) })
const pinSchema = z.object({ staff_id: z.string().min(3), pin: z.string().min(4).max(6) })

function shuffledDigits() {
  const arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function StaffLoginPage({ initialMode = 'pin' }) {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const [mode, setMode] = useState(initialMode) // 'email' | 'pin'
  const [randomDigits, setRandomDigits] = useState(() => shuffledDigits())
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  })

  const pinForm = useForm({
    resolver: zodResolver(pinSchema),
    defaultValues: { staff_id: '', pin: '' },
  })

  const pin = useWatch({ control: pinForm.control, name: 'pin' }) ?? ''

  async function submitEmail(values) {
    try {
      const res = await api.post('/auth/login', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Welcome back')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Login failed')
    }
  }

  async function submitPin(values) {
    try {
      const res = await api.post('/auth/login-pin', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Logged in')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'PIN login failed')
    }
  }

  function addDigit(d) {
    const next = `${pin}${d}`.slice(0, 6)
    pinForm.setValue('pin', next, { shouldValidate: true })
  }

  function backspace() {
    const current = pin ?? ''
    pinForm.setValue('pin', current.slice(0, -1), { shouldValidate: true })
  }

  function clearPin() {
    pinForm.setValue('pin', '', { shouldValidate: true })
  }

  const isEmailMode = mode === 'email'

  function switchMode(nextMode) {
    setMode(nextMode)
    setShowRecovery(false)
    setRecoveryEmail('')
    if (nextMode === 'pin') {
      setRandomDigits(shuffledDigits())
    }
  }

  async function submitRecoveryEmail() {
    const email = recoveryEmail.trim()
    if (!email) {
      toast.error('Enter your email address')
      return
    }
    setRecoveryLoading(true)
    try {
      await api.post('/auth/forgot-password', { email, mode })
    } catch {
      // Keep generic success message for security and compatibility.
    } finally {
      setRecoveryLoading(false)
      toast.success('If your account exists, reset instructions will be sent to your email.')
      setShowRecovery(false)
      setRecoveryEmail('')
    }
  }

  return (
    <AuthSplitShell>
      <AuthHeaderBar />
      <div className="grid h-full min-h-0 grid-cols-1 gap-0 md:grid-cols-[1.25fr_0.75fr]">
        <AuthHeroPanel />

        <div className="flex h-full min-h-0 items-center px-6 py-4 md:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="text-center text-2xl font-semibold text-white">
              Staff Login
            </div>

            <AuthModeTabs mode={mode} onModeChange={switchMode} />

            <div className="mt-4 space-y-3">
              <div className="relative min-h-[430px]">
                <form
                  onSubmit={emailForm.handleSubmit(submitEmail)}
                  className={[
                    'absolute inset-0 space-y-4 transition-all duration-200',
                    isEmailMode
                      ? 'pointer-events-auto translate-x-0 opacity-100'
                      : 'pointer-events-none translate-x-2 opacity-0',
                  ].join(' ')}
                >
                  <input
                    {...emailForm.register('email')}
                    placeholder="Email address"
                    className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm outline-none focus:border-[var(--edlp-primary)]"
                  />
                  <input
                    {...emailForm.register('password')}
                    type="password"
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm outline-none focus:border-[var(--edlp-primary)]"
                  />
                  <button
                    disabled={emailForm.formState.isSubmitting || !isEmailMode}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--edlp-primary)] to-[#c98516] py-3 text-sm font-semibold text-[var(--edlp-navy)] shadow hover:brightness-95 disabled:opacity-60"
                  >
                    {emailForm.formState.isSubmitting && <Spinner className="text-[var(--edlp-navy)]" />}
                    {emailForm.formState.isSubmitting ? 'Signing in…' : 'Log In'}
                  </button>
                </form>

                <form
                  onSubmit={pinForm.handleSubmit(submitPin)}
                  className={[
                    'absolute inset-0 space-y-4 transition-all duration-200',
                    !isEmailMode
                      ? 'pointer-events-auto translate-x-0 opacity-100'
                      : 'pointer-events-none -translate-x-2 opacity-0',
                  ].join(' ')}
                >
                  <input
                    {...pinForm.register('staff_id')}
                    placeholder="Staff ID / Employee ID"
                    className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm outline-none focus:border-[var(--edlp-primary)]"
                  />
                  <input
                    {...pinForm.register('pin')}
                    value={pin}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6)
                      pinForm.setValue('pin', digitsOnly, { shouldValidate: true })
                    }}
                    inputMode="numeric"
                    type="password"
                    placeholder="4–6 Digit PIN"
                    className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-3 text-sm outline-none focus:border-[var(--edlp-primary)]"
                  />

                  <NumericKeypad
                    onDigit={addDigit}
                    onBackspace={backspace}
                    onClear={clearPin}
                    valueLength={pin.length}
                    maxLength={6}
                    digits={randomDigits}
                  />

                  <button
                    disabled={pinForm.formState.isSubmitting || isEmailMode}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--edlp-primary)] to-[#c98516] py-3 text-sm font-semibold text-[var(--edlp-navy)] shadow hover:brightness-95 disabled:opacity-60"
                  >
                    {pinForm.formState.isSubmitting && <Spinner className="text-[var(--edlp-navy)]" />}
                    {pinForm.formState.isSubmitting ? 'Logging in…' : 'Log In'}
                  </button>
                </form>
              </div>

              <div className="pt-1 text-center text-xs text-white/70">
                <button
                  type="button"
                  onClick={() => setShowRecovery((v) => !v)}
                  className="cursor-pointer underline decoration-[var(--edlp-primary)] decoration-2 underline-offset-4 hover:text-white"
                >
                  {isEmailMode ? 'Forgot Password?' : 'Forgot PIN?'}
                </button>
              </div>

              {showRecovery && (
                <div className="rounded-xl border border-white/12 bg-white/5 p-3">
                  <div className="mb-2 text-xs text-white/70">
                    Enter your account email to start reset process.
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg border border-white/10 bg-white/95 px-3 py-2 text-sm outline-none focus:border-[var(--edlp-primary)]"
                    />
                    <button
                      type="button"
                      onClick={submitRecoveryEmail}
                      disabled={recoveryLoading}
                      className="flex min-w-[96px] items-center justify-center rounded-lg bg-gradient-to-b from-[var(--edlp-primary)] to-[#c98516] px-3 py-2 text-sm font-semibold text-[var(--edlp-navy)] disabled:opacity-60"
                    >
                      {recoveryLoading ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1 text-xs text-white/60">
                <span>Sync Status:</span>
                <span className="text-white/80">Online</span>
                <span className="h-2 w-2 rounded-full bg-[var(--edlp-success)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthSplitShell>
  )
}

