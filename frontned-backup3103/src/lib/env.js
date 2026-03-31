export const env = {
  // Use same-origin in dev; Vite proxies /api to Laravel.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
}