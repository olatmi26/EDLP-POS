import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../components/Spinner'
import { AuthModeTabs } from '../components/auth/AuthModeTabs'
import { NumericKeypad, PinDots } from '../components/auth/NumericKeypad'

import superMarketImg from '../../assets/super-market2.jpg'

/* ── Schemas ────────────────────────────────────────────────────────────── */
const emailSchema = z.object({ email: z.string().email(), password: z.string().min(6) })
const pinSchema   = z.object({ staff_id: z.string().min(3), pin: z.string().min(4).max(6) })

function shuffledDigits() {
  const arr = ['0','1','2','3','4','5','6','7','8','9']
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/* ── Glassy input ────────────────────────────────────────────────────────── */
function GlassInput({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%',
        background: focused
          ? 'rgba(255,255,255,0.15)'
          : 'rgba(255,255,255,0.08)',
        border: `1px solid ${focused ? 'rgba(232,160,32,0.7)' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: '10px',
        padding: '11px 16px',
        fontSize: '13px',
        color: '#ffffff',
        outline: 'none',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        caretColor: '#E8A020',
        ...style,
      }}
    />
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export function GlassyLoginPage({ initialMode = 'pin' }) {
  const navigate   = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const [mode, setMode]               = useState(initialMode)
  const [randomDigits, setRandomDigits] = useState(() => shuffledDigits())
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const emailForm = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '', password: '' } })
  const pinForm   = useForm({ resolver: zodResolver(pinSchema),   defaultValues: { staff_id: '', pin: '' } })
  const pin = useWatch({ control: pinForm.control, name: 'pin' }) ?? ''

  async function submitEmail(values) {
    try {
      const res = await api.post('/auth/login', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Welcome back')
      navigate('/', { replace: true })
    } catch (e) { toast.error(e?.response?.data?.message ?? 'Login failed') }
  }

  async function submitPin(values) {
    try {
      const res = await api.post('/auth/login-pin', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Logged in')
      navigate('/', { replace: true })
    } catch (e) { toast.error(e?.response?.data?.message ?? 'PIN login failed') }
  }

  function addDigit(d) { pinForm.setValue('pin', `${pin}${d}`.slice(0, 6), { shouldValidate: true }) }
  function backspace()  { pinForm.setValue('pin', (pin ?? '').slice(0, -1),  { shouldValidate: true }) }
  function clearPin()   { pinForm.setValue('pin', '',                        { shouldValidate: true }) }

  const isEmailMode = mode === 'email'

  function switchMode(m) {
    setMode(m); setShowRecovery(false); setRecoveryEmail('')
    if (m === 'pin') setRandomDigits(shuffledDigits())
  }

  async function submitRecoveryEmail() {
    const email = recoveryEmail.trim()
    if (!email) { toast.error('Enter your email address'); return }
    setRecoveryLoading(true)
    try { await api.post('/auth/forgot-password', { email, mode }) } catch {}
    finally {
      setRecoveryLoading(false)
      toast.success('If your account exists, reset instructions will be sent.')
      setShowRecovery(false); setRecoveryEmail('')
    }
  }

  return (
    /* ── Full-screen background ── */
    <div style={{
      position: 'fixed', inset: 0,
      backgroundImage: `url(${superMarketImg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>

      {/* ── Layered overlays for depth ── */}
      {/* Dark base scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,10,20,0.62)' }} />
      {/* Gold radial accent — top left */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 55% 45% at 15% 10%, rgba(232,160,32,0.18) 0%, transparent 65%)',
      }} />
      {/* Blue-navy vignette — bottom right */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 85% 95%, rgba(5,15,35,0.75) 0%, transparent 60%)',
      }} />

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(10,22,40,0.35)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Cart icon */}
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg,#E8A020,#c98516)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px',
          }}>🛒</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', letterSpacing: '0.04em' }}>
              EDLP Nig Ltd
            </div>
            <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Point of Sale System
            </div>
          </div>
        </div>

        {/* Sync pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px', padding: '4px 12px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1A6E3A', display: 'inline-block' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Online</span>
        </div>
      </div>

      {/* ── Centred glass card ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 5,
        padding: '80px 16px 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(10,18,35,0.55)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: '18px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
          overflow: 'hidden',
        }}>

          {/* Card header strip */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(232,160,32,0.12) 0%, rgba(232,160,32,0.04) 100%)',
            borderBottom: '1px solid rgba(232,160,32,0.15)',
            padding: '20px 24px 16px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>
              Staff Login
            </div>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '11px', marginTop: '3px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Secure Access Portal
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: '20px 24px 24px' }}>

            {/* Mode tabs — reuse existing component */}
            <AuthModeTabs mode={mode} onModeChange={switchMode} />

            {/* Forms container */}
            <div style={{ marginTop: '16px', position: 'relative', minHeight: isEmailMode ? '200px' : '370px', transition: 'min-height 0.25s ease' }}>

              {/* ── Email form ── */}
              <form
                onSubmit={emailForm.handleSubmit(submitEmail)}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px',
                  opacity: isEmailMode ? 1 : 0,
                  transform: isEmailMode ? 'translateX(0)' : 'translateX(16px)',
                  pointerEvents: isEmailMode ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
              >
               
                <p style={{ textAlign: 'center', fontSize: '10px', fontWeight: 500, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.28)', textTransform: 'capitalize', margin: 0 }}>
                Welcome back, Login to your account to continue.
              </p>
                <GlassInput
                  {...emailForm.register('email')}
                  placeholder="Email address"
                  autoComplete="email"
                />
                <GlassInput
                  {...emailForm.register('password')}
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={emailForm.formState.isSubmitting || !isEmailMode}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%',
                    background: 'linear-gradient(135deg, #E8A020 0%, #c98516 100%)',
                    border: 'none', borderRadius: '10px',
                    padding: '12px', fontSize: '13px', fontWeight: 700,
                    color: '#0A1628', cursor: 'pointer',
                    letterSpacing: '0.04em',
                    boxShadow: '0 4px 16px rgba(232,160,32,0.35)',
                    opacity: emailForm.formState.isSubmitting ? 0.7 : 1,
                    transition: 'opacity 0.15s, transform 0.1s',
                  }}
                >
                  {emailForm.formState.isSubmitting && <Spinner className="text-[var(--edlp-navy)]" />}
                  {emailForm.formState.isSubmitting ? 'Signing in…' : 'Log In'}
                </button>
              </form>

              {/* ── PIN form ── */}
              <form
                onSubmit={pinForm.handleSubmit(submitPin)}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px',
                  opacity: !isEmailMode ? 1 : 0,
                  transform: !isEmailMode ? 'translateX(0)' : 'translateX(-16px)',
                  pointerEvents: !isEmailMode ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
              >
                <GlassInput
                  {...pinForm.register('staff_id')}
                  placeholder="Staff ID / Employee ID"
                />

                {/* Hidden PIN field */}
                <input
                  {...pinForm.register('pin')}
                  value={pin}
                  onChange={(e) => {
                    // Allow only digit 0-9
                    const d = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                    pinForm.setValue('pin', d, { shouldValidate: true })
                  }}
                  inputMode="none" type="password"
                  className="sr-only" aria-hidden="true" tabIndex={-1}
                />

                {/* PIN dots */}
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', padding: '8px 12px',
                }}>
                  <PinDots length={pin.length} maxLength={6} />
                </div>

                <NumericKeypad
                  onDigit={addDigit}
                  onBackspace={backspace}
                  onClear={clearPin}
                  valueLength={pin.length}
                  maxLength={6}
                  digits={randomDigits}
                />

                <button
                  type="submit"
                  disabled={pinForm.formState.isSubmitting || isEmailMode}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%',
                    background: 'linear-gradient(135deg, #E8A020 0%, #c98516 100%)',
                    border: 'none', borderRadius: '10px',
                    padding: '12px', fontSize: '13px', fontWeight: 700,
                    color: '#0A1628', cursor: 'pointer',
                    letterSpacing: '0.04em',
                    boxShadow: '0 4px 16px rgba(232,160,32,0.35)',
                    opacity: pinForm.formState.isSubmitting ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {pinForm.formState.isSubmitting && <Spinner className="text-[var(--edlp-navy)]" />}
                  {pinForm.formState.isSubmitting ? 'Logging in…' : 'Log In'}
                </button>
              </form>
            </div>

            {/* ── Divider ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              margin: '18px 0 14px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* ── Forgot link ── */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowRecovery(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(232,160,32,0.6)',
                  textDecorationThickness: '1.5px',
                  textUnderlineOffset: '3px',
                  transition: 'color 0.15s',
                  padding: 0,
                }}
                onMouseEnter={e => e.target.style.color = '#fff'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
              >
                {isEmailMode ? 'Forgot Password?' : 'Forgot PIN?'}
              </button>
            </div>

            {/* ── Recovery panel ── */}
            {showRecovery && (
              <div style={{
                marginTop: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '14px',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                  Enter your account email to start reset process.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <GlassInput
                    type="email"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{ fontSize: '12px', padding: '9px 12px' }}
                  />
                  <button
                    type="button"
                    onClick={submitRecoveryEmail}
                    disabled={recoveryLoading}
                    style={{
                      minWidth: '64px', flexShrink: 0,
                      background: 'linear-gradient(135deg,#E8A020,#c98516)',
                      border: 'none', borderRadius: '9px',
                      fontSize: '12px', fontWeight: 700, color: '#0A1628',
                      cursor: 'pointer', padding: '9px 12px',
                      opacity: recoveryLoading ? 0.6 : 1,
                    }}
                  >
                    {recoveryLoading ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card footer */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              EDLP Nigeria Limited
            </span>
            
          </div>
        </div>
      </div>

      {/* ── Bottom branch tags ── */}
      <div style={{
        position: 'absolute', bottom: '18px', left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: '8px',
        flexWrap: 'wrap', padding: '0 24px',
        zIndex: 5,
      }}>
        {['HQ · Lekki Phase 1', 'Lekki', 'Victoria Island', 'Ikeja', 'Surulere', 'Yaba', 'Ajah'].map(b => (
          <span key={b} style={{
            fontSize: '9.5px', color: 'rgba(255,255,255,0.28)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px', padding: '3px 9px',
            letterSpacing: '0.04em',
          }}>{b}</span>
        ))}
      </div>
    </div>
  )
}
