const styles = {
  ok: 'bg-[var(--edlp-success-bg)] text-[var(--edlp-success)] border-[color:var(--edlp-success)]/20',
  low: 'bg-[var(--edlp-warning-bg)] text-[var(--edlp-warning)] border-[color:var(--edlp-warning)]/20',
  out: 'bg-[var(--edlp-danger-bg)] text-[var(--edlp-danger)] border-[color:var(--edlp-danger)]/20',
  unknown: 'bg-slate-50 text-[var(--edlp-text)] border-slate-200',
}

export function StatusPill({ status }) {
  const s = status ?? 'unknown'
  const cls = styles[s] ?? styles.unknown
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {s}
    </span>
  )
}

