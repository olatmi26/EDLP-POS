import { useState, useCallback } from 'react'

/* ─── PIN dot indicator ──────────────────────────────────────────────────── */
export function PinDots({ length = 0, maxLength = 6 }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-1">
      {Array.from({ length: maxLength }).map((_, i) => {
        const filled = i < length
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: filled ? '10px' : '8px',
              height: filled ? '10px' : '8px',
              borderRadius: '50%',
              background: filled ? 'var(--edlp-primary)' : 'transparent',
              border: filled
                ? '2px solid var(--edlp-primary)'
                : '2px solid rgba(255,255,255,0.25)',
              transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: filled ? 'scale(1)' : 'scale(0.85)',
              boxShadow: filled ? '0 0 8px rgba(232,160,32,0.45)' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

/* ─── Single key ─────────────────────────────────────────────────────────── */
function Key({ label, sublabel, onClick, variant = 'num', disabled = false }) {
  const [pressed, setPressed] = useState(false)
  const [ripples, setRipples] = useState([])

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled) return
      setPressed(true)
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const id = Date.now() + Math.random()
      setRipples((r) => [...r, { id, x, y }])
      setTimeout(() => setRipples((r) => r.filter((rr) => rr.id !== id)), 600)
    },
    [disabled],
  )
  const handlePointerUp = useCallback(() => setPressed(false), [])

  let bg, activeBg, border, textCol, rippleColor
  if (variant === 'num') {
    bg = 'rgba(255,255,255,0.055)'
    activeBg = 'rgba(255,255,255,0.13)'
    border = 'rgba(255,255,255,0.09)'
    textCol = '#FFFFFF'
    rippleColor = 'rgba(255,255,255,0.14)'
  } else if (variant === 'backspace') {
    bg = 'rgba(232,160,32,0.07)'
    activeBg = 'rgba(232,160,32,0.18)'
    border = 'rgba(232,160,32,0.22)'
    textCol = 'var(--edlp-primary)'
    rippleColor = 'rgba(232,160,32,0.2)'
  } else if (variant === 'danger') {
    bg = 'rgba(192,57,43,0.07)'
    activeBg = 'rgba(192,57,43,0.18)'
    border = 'rgba(192,57,43,0.22)'
    textCol = '#e05a4a'
    rippleColor = 'rgba(192,57,43,0.2)'
  } else {
    bg = 'rgba(255,255,255,0.04)'
    activeBg = 'rgba(255,255,255,0.09)'
    border = 'rgba(255,255,255,0.07)'
    textCol = 'rgba(255,255,255,0.65)'
    rippleColor = 'rgba(255,255,255,0.1)'
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '40px',
        borderRadius: '9px',
        border: `1px solid ${border}`,
        background: pressed ? activeBg : bg,
        color: textCol,
        fontSize: variant === 'num' ? '15px' : '10px',
        fontWeight: variant === 'num' ? '600' : '500',
        letterSpacing: variant === 'num' ? '0.01em' : '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transform: pressed ? 'scale(0.91)' : 'scale(1)',
        transition:
          'transform 0.1s cubic-bezier(0.34,1.56,0.64,1), background 0.1s ease, opacity 0.15s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        lineHeight: 1,
      }}
    >
      {ripples.map(({ id, x, y }) => (
        <span
          key={id}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: '72px',
            height: '72px',
            marginLeft: '-36px',
            marginTop: '-36px',
            borderRadius: '50%',
            background: rippleColor,
            transform: 'scale(0)',
            animation: 'edlp-ripple 0.55s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      ))}
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
      {sublabel && (
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: '6.5px',
            letterSpacing: '0.13em',
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 400,
            textTransform: 'uppercase',
          }}
        >
          {sublabel}
        </span>
      )}
    </button>
  )
}

/* ─── T9-style sublabels ─────────────────────────────────────────────────── */
const SUB = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
  '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
}

/* ─── Backspace SVG icon ─────────────────────────────────────────────────── */
function BackspaceIcon() {
  return (
    <svg
      width="15"
      height="11"
      viewBox="0 0 15 11"
      fill="none"
      style={{ display: 'block' }}
    >
      <path
        d="M5.5 1L1 5.5L5.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="1"
        y1="5.5"
        x2="14"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 3L12.5 8M12.5 3L8.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ─── NumericKeypad ──────────────────────────────────────────────────────── */
export function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  maxLength = 6,
  valueLength = 0,
  digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
}) {
  const safeDigits =
    Array.isArray(digits) && digits.length === 10
      ? digits
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

  const full = valueLength >= maxLength

  return (
    <>
      <style>{`@keyframes edlp-ripple { to { transform: scale(2.8); opacity: 0; } }`}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '5px',
          width: '100%',
        }}
      >
        {/* Row 1 */}
        <Key label={safeDigits[0]} sublabel={SUB[safeDigits[0]]} onClick={() => onDigit(safeDigits[0])} disabled={full} />
        <Key label={safeDigits[1]} sublabel={SUB[safeDigits[1]]} onClick={() => onDigit(safeDigits[1])} disabled={full} />
        <Key label={safeDigits[2]} sublabel={SUB[safeDigits[2]]} onClick={() => onDigit(safeDigits[2])} disabled={full} />
        <Key label={<BackspaceIcon />} variant="backspace" onClick={onBackspace} disabled={valueLength === 0} />

        {/* Row 2 */}
        <Key label={safeDigits[3]} sublabel={SUB[safeDigits[3]]} onClick={() => onDigit(safeDigits[3])} disabled={full} />
        <Key label={safeDigits[4]} sublabel={SUB[safeDigits[4]]} onClick={() => onDigit(safeDigits[4])} disabled={full} />
        <Key label={safeDigits[5]} sublabel={SUB[safeDigits[5]]} onClick={() => onDigit(safeDigits[5])} disabled={full} />
        <Key label="CLR" variant="danger" onClick={onClear} disabled={valueLength === 0} />

        {/* Row 3 */}
        <Key label={safeDigits[6]} sublabel={SUB[safeDigits[6]]} onClick={() => onDigit(safeDigits[6])} disabled={full} />
        <Key label={safeDigits[7]} sublabel={SUB[safeDigits[7]]} onClick={() => onDigit(safeDigits[7])} disabled={full} />
        <Key label={safeDigits[8]} sublabel={SUB[safeDigits[8]]} onClick={() => onDigit(safeDigits[8])} disabled={full} />
        <div />

        {/* Row 4 */}
        <div />
        <Key label={safeDigits[9]} onClick={() => onDigit(safeDigits[9])} disabled={full} />
        <div />
        <div />
      </div>
    </>
  )
}

