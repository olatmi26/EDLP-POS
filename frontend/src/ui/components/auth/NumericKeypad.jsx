function Key({ label, onClick, variant = 'num', disabled = false }) {
  const base =
    'h-12 rounded-xl border text-sm font-semibold transition duration-150 active:scale-[0.98] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
  const cls =
    variant === 'action'
      ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls} disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-50`}
    >
      {label}
    </button>
  )
}

export function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  maxLength = 6,
  valueLength = 0,
  digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
}) {
  const safeDigits = Array.isArray(digits) && digits.length === 10 ? digits : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  const rows = [
    [safeDigits[0], safeDigits[1], safeDigits[2], { label: '⌫', action: onBackspace }],
    [safeDigits[3], safeDigits[4], safeDigits[5], { label: 'Clear', action: onClear }],
    [safeDigits[6], safeDigits[7], safeDigits[8], { label: '', action: null }],
    ['', safeDigits[9], '', { label: '', action: null }],
  ]

  return (
    <div className="grid grid-cols-4 gap-3 pt-2">
      {rows.flat().map((k, idx) => {
        if (typeof k === 'string') {
          if (!k) return <div key={idx} />
          const isDigit = /^[0-9]$/.test(k)
          return (
            <Key
              key={idx}
              label={k}
              onClick={() => onDigit(k)}
              disabled={isDigit && valueLength >= maxLength}
            />
          )
        }

        if (!k.label || !k.action) return <div key={idx} />
        return <Key key={idx} label={k.label} variant="action" onClick={k.action} />
      })}
    </div>
  )
}

