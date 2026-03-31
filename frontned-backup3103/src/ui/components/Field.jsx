export function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1">
      {label && <div className="text-xs font-medium text-slate-700">{label}</div>}
      {children}
      {hint && !error && <div className="text-[11px] text-slate-500">{hint}</div>}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  )
}

