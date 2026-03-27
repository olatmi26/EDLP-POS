import { useMemo, useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, UserRound, UsersRound, Menu } from 'lucide-react'

import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import superMarketImg from '../../assets/super-market2.jpg'

// Loader Spinner Component
function Spinner({ color = "#172041", size = 20 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        marginRight: 8,
        marginTop: '-2px',
        width: size,
        height: size,
      }}
      className="animate-spin"
    >
      <svg
        style={{ display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          opacity="0.2"
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="4"
        />
        <path
          d="M22 12a10 10 0 00-10-10"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

// SCHEMAS
const emailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const pinSchema = z.object({
  staff_id: z.string().min(3),
  pin: z.string().min(4).max(6),
})

// COMPONENTS
function PillTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-4 py-2 text-sm font-semibold transition tracking-wide border',
        active
          ? 'bg-gradient-to-b from-[#ffbb30] to-[#c98516] text-[#18223d] border-[#ffbb3066] shadow-md'
          : 'bg-[#232c3b] text-white/80 hover:bg-[#2a384f] border-[#ffffff15]',
      ].join(' ')}
      tabIndex={active ? -1 : 0}
      style={{ minWidth: 125 }}
    >
      {children}
    </button>
  )
}

function Key({ label, onClick, variant = 'num', disabled }) {
  const base =
    'h-12 rounded-lg border text-base font-semibold transition active:scale-[0.98]'
  const cls =
    variant === 'action'
      ? 'border-[#ffbb30] bg-[#18223d] text-[#ffbb30] hover:bg-[#2a3950]'
      : 'border-[#33415c] bg-[#1a2234] text-white hover:bg-[#29375a]'
  return (
    <button
      type="button"
      className={`${base} ${cls}`}
      onMouseDown={(e) => {
        e.preventDefault()
        if (onClick && !disabled) onClick()
      }}
      tabIndex={-1}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export function StaffLoginPage({ initialMode = 'pin' }) {
  const navigate = useNavigate ? useNavigate() : () => {}
  const setSession = useAuthStore ? useAuthStore((s) => s.setSession) : () => {}
  const [mode, setMode] = useState(initialMode)
  const emailFormRef = useRef()
  const pinFormRef = useRef()

  // Loader state for button
  const [loading, setLoading] = useState(false)

  // Always start with blank forms, no "remembered values" upon mounting or switching
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })
  emailFormRef.current = emailForm
  const pinForm = useForm({
    resolver: zodResolver(pinSchema),
    defaultValues: { staff_id: '', pin: '' },
    mode: 'onTouched',
  })
  pinFormRef.current = pinForm

  // --- FIXED: Watch PIN "raw" value as below to enable keypad interaction even if autofilled! ---
  const pin = pinForm.watch('pin') ?? ''

  // Ref to PIN input so we can focus it after key press
  const pinInputRef = useRef(null)

  // Effect to clear all form fields (reset) when mode changes -- this will clear "remembered" values
  useEffect(() => {
    emailForm.reset({ email: '', password: '' })
    pinForm.reset({ staff_id: '', pin: '' })
    setLoading(false)
  }, [mode])

  async function submitEmail(values) {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Welcome back')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function submitPin(values) {
    setLoading(true)
    try {
      const res = await api.post('/auth/login-pin', values)
      setSession({ token: res.data?.data?.token, user: res.data?.data?.user })
      toast.success('Logged in')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'PIN login failed')
    } finally {
      setLoading(false)
    }
  }

  // --- KEY: Always allow keypad input unless pin is at max length ---
  function addDigit(d) {
    let current = pinForm.getValues("pin") ?? ""
    // After autofill/click, make sure we still allow input up to maxlength
    if (typeof current !== "string") current = ""
    if (current.length >= 6) return
    const next = `${current}${d}`.slice(0, 6)
    pinForm.setValue('pin', next, { shouldValidate: true })
    if (pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }

  function backspace() {
    let current = pinForm.getValues("pin") ?? ""
    if (typeof current !== "string") current = ""
    pinForm.setValue('pin', current.slice(0, -1), { shouldValidate: true })
    if (pinInputRef.current) pinInputRef.current.focus()
  }

  function clearPin() {
    pinForm.setValue('pin', '', { shouldValidate: true })
    if (pinInputRef.current) pinInputRef.current.focus()
  }

  const keypad = useMemo(
    () => [
      ['1', '2', '3', { label: <span>&larr;</span>, action: backspace }],
      ['4', '5', '6', { label: 'Clear', action: clearPin }],
      ['7', '8', '9', { label: '', action: () => {} }],
      ['',   '0', '',   { label: '', action: () => {} }],
    ],
    []
  )

  try {
    return (
      <div className="fixed inset-0 z-10 flex items-stretch justify-center bg-[#101627] p-0 md:p-5 overflow-auto select-none font-sans">
        <div className="relative min-h-[95vh] max-h-[880px] w-full max-w-7xl flex rounded-2xl overflow-hidden shadow-2xl border border-[#20233b] bg-[#131d31]">
          {/* Top App Bar / Window Mimic for desktop */}
          <div className="absolute top-0 right-0 left-0 h-12 flex items-center justify-between bg-[#191c2a] border-b border-[#20233b] px-6 z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl" role="img" aria-label="cart">🛒</span>
                <span className="text-lg font-bold tracking-wide text-[#ffbb30] leading-tight">
                  EDLP Nig Ltd.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/70">
              <button type="button" title="Search" className="hover:text-[#ffbb30]"><Search size={18} /></button>
              <button type="button" title="User" className="hover:text-[#ffbb30]"><UserRound size={18} /></button>
              <button type="button" title="Users" className="hover:text-[#ffbb30]"><UsersRound size={18} /></button>
              <button type="button" title="Menu" className="hover:text-[#ffbb30]"><Menu size={18} /></button>
            </div>
          </div>
          {/* Main Content */}
          <div className="flex-1 flex flex-col md:flex-row">
            {/* LEFT Image + welcome */}
            <div className="hidden md:flex flex-col justify-between items-start bg-[#161f2d] relative z-0 transition-all duration-200 basis-5/12 min-w-[260px] max-w-[42%]">
              <div className="relative flex-1 w-full">
                <img
                  src={superMarketImg}
                  alt="Supermarket"
                  className="absolute inset-0 w-full h-full object-cover object-left-bottom"
                  style={{ filter: "brightness(0.94)", minHeight: 320 }}
                />
                <div className="absolute inset-0 bg-[#131d31d2] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#131d31f2] via-transparent to-[#213053c6] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#ffbb3050] via-transparent to-[#2a465088] pointer-events-none" />
                {/* Image content */}
                <div className="absolute left-0 top-0 flex flex-col pl-7 pt-12 h-full w-full z-10">
                  <div className="mb-auto" />
                  <div className="mb-10">
                    <div className="text-[2rem] font-bold text-white leading-tight drop-shadow" style={{textShadow:'0 2px 10px #181f2b55'}}>
                      Welcome to <span className="text-[#ffbb30] drop-shadow">Smarter Retail</span>
                    </div>
                    <div className="text-base text-white/80 mt-2">
                      Your unified platform for all EDLP branches.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-6 py-3 w-full border-t border-[#232946] bg-gradient-to-r from-[#151b28f2] to-transparent">
                <span className="text-[#ffbb30] text-lg">🛒</span>
                <span className="text-sm text-white/70 font-medium">6 Branches &amp; Head Office</span>
              </div>
            </div>

            {/* RIGHT LOGIN FORM */}
            {/* Center the login form more, adding more horizontal inner space */}
            <div className="flex flex-col justify-center items-center bg-[#131d31] w-full md:basis-7/12 md:max-w-[630px] min-h-[480px]">
              <div
                className="w-full max-w-lg pt-10 pb-4 px-6 md:px-16"
                style={{ marginTop: 0 }}
              >
                <div className="flex flex-col items-center w-full">
                  <div className="text-xl font-bold text-white text-center tracking-tight mb-5" style={{letterSpacing:'-0.03em', minHeight: 30}}>
                    Sign In To Your Account
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <PillTab
                      active={mode === 'email'}
                      onClick={() => setMode('email')}
                    >
                      Email &amp; Password
                    </PillTab>
                    <PillTab
                      active={mode === 'pin'}
                      onClick={() => setMode('pin')}
                    >
                      PIN Login
                    </PillTab>
                  </div>
                  <div
                    className="relative rounded-xl bg-[#161e2df5] shadow-lg p-6 transition-all duration-200 mb-2 w-full"
                    style={{
                      minHeight: 282,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    {/* The contents below stay further away from the left edge */}
                    <div className="min-h-[232px] flex flex-col justify-center w-full">
                      {mode === 'email' && (
                        <form
                          key="email"
                          onSubmit={emailForm.handleSubmit(submitEmail)}
                          className="flex flex-col gap-4 animate-fadein w-full"
                          autoComplete="off"
                        >
                          <label className="text-xs font-medium text-white/85 mb-0.5 mt-1">Email Address</label>
                          <input
                            {...emailForm.register('email')}
                            placeholder="Enter your email"
                            autoFocus
                            className="w-full rounded-md border border-[#ffbb30cc] bg-[#181f2b] px-3 py-2 text-base text-white outline-none focus:border-[#ffbb30] focus:ring-2 focus:ring-[#ffbb3077] font-semibold transition"
                            autoComplete="username"
                            style={{letterSpacing: '0.02em'}}
                          />
                          <label className="text-xs font-medium text-white/85 mb-0.5 mt-1">Password</label>
                          <input
                            {...emailForm.register('password')}
                            type="password"
                            placeholder="Password"
                            className="w-full rounded-md border border-[#27345a] bg-[#181f2b] px-3 py-2 text-base text-white outline-none focus:border-[#ffbb30] focus:ring-2 focus:ring-[#ffbb3077] font-semibold transition"
                            autoComplete="current-password"
                            style={{letterSpacing: '0.1em'}}
                          />
                          <div className="flex items-center justify-between mt-1 text-xs py-1">
                            <label className="flex items-center gap-1">
                              <input type="checkbox"
                                className="accent-[#ffbb30] w-3.5 h-3.5 rounded" tabIndex={-1}
                                style={{ marginTop: 1}} />
                              <span className="text-white/60 font-normal">Forgot Password?</span>
                            </label>
                          </div>
                          <button
                            disabled={loading || emailForm.formState.isSubmitting}
                            className="w-full mt-2 rounded-lg bg-gradient-to-b from-[#ffd463] to-[#fdad13] py-2 text-base font-bold text-[#172041] shadow hover:brightness-95 disabled:opacity-60 transition flex items-center justify-center"
                            style={{letterSpacing: '0.04em', boxShadow:'0 1.5px 7px #2a283088'}}
                            tabIndex={0}
                          >
                            {loading || emailForm.formState.isSubmitting ? (
                              <>
                                <Spinner color="#172041" size={20} />
                                {emailForm.formState.isSubmitting ? 'Signing in…' : 'Logging in…'}
                              </>
                            ) : (
                              'Log In'
                            )}
                          </button>
                          <div className="flex items-center justify-center my-1">
                            <span className="w-8 border-t border-[#313c58]" />
                            <span className="text-white/35 px-2 text-xs font-mono">or quick login with PIN</span>
                            <span className="w-8 border-t border-[#313c58]" />
                          </div>
                        </form>
                      )}
                      {mode === 'pin' && (
                        <form
                          key="pin"
                          onSubmit={pinForm.handleSubmit(submitPin)}
                          className="flex flex-col gap-4 animate-fadein w-full"
                          autoComplete="off"
                        >
                          <label className="text-xs font-medium text-white/85 mb-0.5 mt-1">Staff ID / Employee ID</label>
                          <input
                            {...pinForm.register('staff_id')}
                            placeholder="Enter staff ID"
                            autoFocus
                            className="w-full rounded-md border border-[#27345a] bg-[#181f2b] px-3 py-2 text-base text-white outline-none focus:border-[#ffbb30] focus:ring-2 focus:ring-[#ffbb3077] font-semibold transition"
                            autoComplete="off"
                          />
                          <label className="text-xs font-medium text-white/85 mb-0.5 mt-1">PIN</label>
                          <input
                            {...pinForm.register('pin')}
                            ref={pinInputRef}
                            value={pin}
                            onChange={(e) => {
                              // Always keep only digit chars, max length 6
                              const digitsOnly = (e.target.value || '').replace(/\D/g, '').slice(0, 6)
                              pinForm.setValue('pin', digitsOnly, { shouldValidate: true })
                            }}
                            inputMode="numeric"
                            type="password"
                            maxLength={6}
                            placeholder="4–6 Digit PIN"
                            className="w-full rounded-md border border-[#ffbb30cc] bg-[#181f2b] px-3 py-2 text-base text-white outline-none focus:border-[#ffbb30] focus:ring-2 focus:ring-[#ffbb3077] font-semibold tracking-wider transition"
                            autoComplete="off"
                            style={{letterSpacing: '0.28em'}}
                          />
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {keypad.flat().map((k, idx) => {
                              if (typeof k === 'string') {
                                // If pin is at max length, disable only digit keys; always allow after autofill/previous click
                                const isDigit = k !== '' && !isNaN(Number(k))
                                return k
                                  ? <Key key={idx} label={k} onClick={() => addDigit(k)} disabled={isDigit && pin.length >= 6} />
                                  : <div key={idx} /> // empty cell for gap
                              }
                              if (!k.label) return <div key={idx}></div>
                              return (
                                <Key
                                  key={idx}
                                  label={k.label}
                                  variant="action"
                                  onClick={k.action}
                                />
                              )
                            })}
                          </div>
                          <button
                            disabled={loading || pinForm.formState.isSubmitting}
                            className="mt-3 w-full rounded-lg bg-gradient-to-b from-[#ffd463] to-[#fdad13] py-2 text-base font-bold text-[#172041] shadow hover:brightness-95 disabled:opacity-60 transition flex items-center justify-center"
                            style={{letterSpacing: '0.04em', boxShadow:'0 1.5px 7px #2a283088'}}
                            tabIndex={0}
                          >
                            {loading || pinForm.formState.isSubmitting ? (
                              <>
                                <Spinner color="#172041" size={20} />
                                {pinForm.formState.isSubmitting ? 'Logging in…' : 'Logging in…'}
                              </>
                            ) : (
                              'Log In'
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 w-full">
                    <div className="flex-1 text-xs text-white/60" />
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span>Sync Status:</span>
                      <span className="text-[#a0ff95] font-bold">Online</span>
                      <span className="h-2 w-2 rounded-full bg-[color:var(--edlp-success,#32de49)] shadow-[0_0_3px_#32de49c2]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* END RIGHT LOGIN FORM */}
          </div>
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div
        style={{
          color: "#fff",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif"
        }}
      >
        <div>
          <h2 style={{ color: "#ffbb30" }}>Error Loading Staff Login Page</h2>
          <div style={{ marginTop: 12 }}>Contact IT support.<br />Details: {String(err.message || err)}</div>
        </div>
      </div>
    )
  }
}
