function PillTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition',
        active
          ? 'border-[color:var(--edlp-primary)]/50 bg-gradient-to-b from-[var(--edlp-primary)] to-[#c98516] text-[var(--edlp-navy)] shadow'
          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function AuthModeTabs({ mode, onModeChange }) {
  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <PillTab active={mode === 'email'} onClick={() => onModeChange('email')}>
        Email &amp; Password
      </PillTab>
      <PillTab active={mode === 'pin'} onClick={() => onModeChange('pin')}>
        Staff ID &amp; PIN
      </PillTab>
    </div>
  )
}

