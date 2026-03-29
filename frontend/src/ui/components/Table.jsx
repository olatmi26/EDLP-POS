export function Table({ columns, rows, rowKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="sticky top-0 border-b bg-white px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={rowKey ? rowKey(r) : idx} className="odd:bg-slate-50/50">
              {columns.map((c) => (
                <td key={c.key} className="border-b px-3 py-2 text-sm text-slate-800">
                  {c.cell ? c.cell(r) : (typeof r?.[c.key] === 'object' ? '—' : r?.[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-slate-500">
                No results.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

