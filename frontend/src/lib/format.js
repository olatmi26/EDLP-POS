export function money(amount) {
  const n = Number(amount ?? 0)
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(n)
}

