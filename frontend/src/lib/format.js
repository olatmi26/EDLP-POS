/**
 * EDLP POS — Format utilities
 */

/**
 * Format a number as Nigerian Naira currency.
 * @param {number|string} amount
 * @returns {string} e.g. "₦1,230,000.00"
 */
export function money(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num) || num === null || num === undefined) return '₦0.00'
  return new Intl.NumberFormat('en-NG', {
    style:    'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Format a number with commas.
 */
export function num(value) {
  return new Intl.NumberFormat('en-NG').format(value ?? 0)
}

/**
 * Format a percentage.
 */
export function pct(value, decimals = 1) {
  return `${(+(value ?? 0)).toFixed(decimals)}%`
}

/**
 * Relative time (e.g. "2 hours ago")
 */
export function timeAgo(date) {
  if (!date) return '—'
  const d    = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000

  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
