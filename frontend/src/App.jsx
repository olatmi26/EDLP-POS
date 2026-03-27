import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { AppLayout } from './ui/layouts/AppLayout'
import { SessionBootstrap } from './ui/SessionBootstrap'
import { StaffLoginPage } from './ui/pages/StaffLoginPage'
import { DashboardPage } from './ui/pages/DashboardPage'
import { ProductsPage } from './ui/pages/ProductsPage'
import { InventoryPage } from './ui/pages/InventoryPage'
import { SuppliersPage } from './ui/pages/SuppliersPage'
import { PurchaseOrdersPage } from './ui/pages/PurchaseOrdersPage'

function Protected({ children }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)

  if (!token) return <Navigate to="/login" replace />
  if (!bootstrapped || !user) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
        <div className="rounded border bg-white px-4 py-3 text-sm text-slate-700">
          Loading session…
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <>
      <BrowserRouter>
        <SessionBootstrap />
        <Routes>
          <Route path="/login" element={<StaffLoginPage initialMode="email" />} />
          <Route path="/pin" element={<StaffLoginPage initialMode="pin" />} />

          <Route
            path="/"
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-right" />
    </>
  )
}
