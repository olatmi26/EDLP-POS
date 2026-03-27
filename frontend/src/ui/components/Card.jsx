export function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded border bg-white">
      {(title || subtitle || right) && (
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            {title && <div className="text-sm font-semibold text-slate-900">{title}</div>}
            {subtitle && <div className="text-xs text-slate-600">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

