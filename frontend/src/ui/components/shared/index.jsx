/**
 * EDLP POS — Shared Component Library
 * Matches the design language from the reference images:
 * dark navy sidebar, gold accents, colored role badges, clean tables
 */
import { useState } from 'react'
import { X, AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react'

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, accent = '#E8A020', dark = false }) {
  const bg   = dark ? '#19273A' : '#fff'
  const lbl  = dark ? 'rgba(255,255,255,0.5)' : '#8A9AB5'
  const val  = dark ? '#fff'                  : '#1C2B3A'
  const subC = dark ? 'rgba(255,255,255,0.4)' : '#8A9AB5'

  return (
    <div style={{
      background: bg,
      border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E5EBF2',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: lbl, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {Icon && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={accent} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: val, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subC }}>{sub}</div>}
    </div>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
const ROLE_MAP = {
  'super-admin':     { label: 'Super Admin',     bg: '#EAF0FB', color: '#1A3FA6' },
  'admin':           { label: 'Admin',           bg: '#E6F5F5', color: '#0F6E6E' },
  'branch-manager':  { label: 'Branch Manager',  bg: '#F0ECFB', color: '#5B3FA6' },
  'cashier':         { label: 'Cashier',         bg: '#FEF0E6', color: '#C45A00' },
}

export function RoleBadge({ role }) {
  const r = ROLE_MAP[role] ?? { label: role, bg: '#F0F4F8', color: '#6B7A8D' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: r.bg,
      color: r.color,
      whiteSpace: 'nowrap',
    }}>
      {r.label}
    </span>
  )
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
export function StatusDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#1A6E3A' : '#8A9AB5' }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: active ? '#1A6E3A' : '#D5DFE9',
        display: 'inline-block',
        flexShrink: 0,
      }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Badge (generic) ───────────────────────────────────────────────────────────
export function Badge({ children, color = 'default' }) {
  const COLORS = {
    default: { bg: '#F0F4F8', color: '#6B7A8D' },
    success: { bg: '#EAF5EE', color: '#1A6E3A' },
    danger:  { bg: '#FDECEA', color: '#C0392B' },
    warning: { bg: '#FEF0E6', color: '#C45A00' },
    info:    { bg: '#EAF0FB', color: '#1A3FA6' },
    gold:    { bg: 'rgba(232,160,32,0.12)', color: '#C98516' },
  }
  const c = COLORS[color] ?? COLORS.default
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.color,
    }}>
      {children}
    </span>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, breadcrumb, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
      <div>
        {breadcrumb && (
          <div style={{ fontSize: 11, color: '#8A9AB5', marginBottom: 4, fontWeight: 500 }}>{breadcrumb}</div>
        )}
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1C2B3A', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8A9AB5' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', icon: Icon, style: extraStyle = {} }) {
  const sizes = { sm: '6px 12px', md: '8px 16px', lg: '11px 22px' }
  const fonts = { sm: 11, md: 13, lg: 14 }

  const variants = {
    primary:  { background: 'var(--edlp-primary)', color: 'var(--edlp-navy)', border: 'none' },
    secondary:{ background: '#fff', color: '#3A4A5C', border: '1px solid #D5DFE9' },
    danger:   { background: '#FDECEA', color: '#C0392B', border: '1px solid #FACAC5' },
    ghost:    { background: 'transparent', color: '#6B7A8D', border: '1px solid #E5EBF2' },
    dark:     { background: '#1C2B3A', color: '#fff', border: 'none' },
  }
  const v = variants[variant] ?? variants.primary

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v,
        padding: sizes[size],
        fontSize: fonts[size],
        fontWeight: 600,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'filter 0.1s',
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.94)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = '' }}
    >
      {Icon && <Icon size={fonts[size]} />}
      {children}
    </button>
  )
}

// ── SearchInput ───────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', style: s = {} }) {
  return (
    <div style={{ position: 'relative', ...s }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A9AB5' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
          fontSize: 13, border: '1px solid #D5DFE9', borderRadius: 8, outline: 'none',
          color: '#3A4A5C', boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--edlp-primary)'}
        onBlur={e => e.target.style.borderColor = '#D5DFE9'}
      />
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style: s = {}, padding = 20 }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5EBF2',
      borderRadius: 14,
      padding,
      ...s,
    }}>
      {children}
    </div>
  )
}

// ── DataTable ─────────────────────────────────────────────────────────────────
export function DataTable({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = 'No records found.',
  onRowClick,
  pagination,
  stickyHeader,
}) {
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>
        <div className="animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!rows?.length) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#8A9AB5', fontSize: 13 }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F6F8FB', borderBottom: '1px solid #E5EBF2' }}>
              {columns.map((col) => (
                <th key={col.key} style={{
                  padding: '10px 14px',
                  textAlign: col.align ?? 'left',
                  fontWeight: 600,
                  color: '#6B7A8D',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={rowKey ? (typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? idx)) : idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: '1px solid #F0F4F8',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = '#FAFCFF' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{
                    padding: '12px 14px',
                    color: col.muted ? '#8A9AB5' : '#3A4A5C',
                    verticalAlign: 'middle',
                    textAlign: col.align ?? 'left',
                    whiteSpace: col.nowrap ? 'nowrap' : undefined,
                  }}>
                    {col.cell ? col.cell(row) : (typeof row[col.key] === 'object' ? '—' : row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderTop: '1px solid #F0F4F8',
          fontSize: 12, color: '#8A9AB5',
        }}>
          <span>
            Page {pagination.current} of {pagination.last} · {pagination.total} records
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" size="sm" icon={ChevronLeft}
              disabled={pagination.current <= 1}
              onClick={() => pagination.onPage(pagination.current - 1)}
            />
            <Btn variant="ghost" size="sm" icon={ChevronRight}
              disabled={pagination.current >= pagination.last}
              onClick={() => pagination.onPage(pagination.current + 1)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520, footer }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10,22,40,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: width,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #F0F4F8',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1C2B3A' }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8A9AB5', padding: 4, borderRadius: 6, display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #F0F4F8',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm} disabled={loading}>{loading ? 'Processing…' : confirmLabel}</Btn>
      </>}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <AlertTriangle size={20} color="#C0392B" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 14, color: '#3A4A5C', lineHeight: 1.6 }}>{message}</p>
      </div>
    </Modal>
  )
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, error, hint, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: '#3A4A5C' }}>
          {label} {required && <span style={{ color: '#C0392B' }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: '#8A9AB5' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: '#C0392B' }}>{error}</span>}
    </div>
  )
}

// ── FormInput ─────────────────────────────────────────────────────────────────
export function FormInput({ register, error, type = 'text', placeholder, ...rest }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      {...(register || {})}
      {...rest}
      style={{
        width: '100%', padding: '9px 12px', fontSize: 13,
        border: `1px solid ${error ? '#C0392B' : '#D5DFE9'}`,
        borderRadius: 8, outline: 'none', boxSizing: 'border-box',
        color: '#3A4A5C',
      }}
      onFocus={e => { e.target.style.borderColor = error ? '#C0392B' : 'var(--edlp-primary)' }}
      onBlur={e => { e.target.style.borderColor = error ? '#C0392B' : '#D5DFE9' }}
    />
  )
}

// ── FormSelect ────────────────────────────────────────────────────────────────
export function FormSelect({ register, error, children, ...rest }) {
  return (
    <select
      {...(register || {})}
      {...rest}
      style={{
        width: '100%', padding: '9px 12px', fontSize: 13,
        border: `1px solid ${error ? '#C0392B' : '#D5DFE9'}`,
        borderRadius: 8, outline: 'none', boxSizing: 'border-box',
        color: '#3A4A5C', cursor: 'pointer', background: '#fff',
      }}
    >
      {children}
    </select>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {Icon && (
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <Icon size={22} color="#8A9AB5" />
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#3A4A5C' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: '#8A9AB5' }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
