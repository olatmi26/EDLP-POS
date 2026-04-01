import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { Spinner } from './ui/components/shared'

// Layout
import { AppLayout } from './ui/layouts/AppLayout'
import { SessionBootstrap } from './ui/SessionBootstrap'

// Auth
import { StaffLoginPage } from './ui/pages/StaffLoginPage'

// App pages
import { DashboardPage }      from './ui/pages/DashboardPage'
import { ProductsPage }        from './ui/pages/ProductsPage'
import { InventoryPage }       from './ui/pages/InventoryPage'
import { CustomersPage }       from './ui/pages/CustomersPage'
import { SuppliersPage }       from './ui/pages/SuppliersPage'
import { PurchaseOrdersPage }  from './ui/pages/PurchaseOrdersPage'
import { UsersPage }           from './ui/pages/UsersPage'
import { BranchesPage }        from './ui/pages/BranchesPage'
import { ApprovalsPage }       from './ui/pages/ApprovalsPage'
import { WorkflowConfigPage }  from './ui/pages/WorkflowConfigPage'
import { AccountingPage }      from './ui/pages/AccountingPage'
import { ExpensesPage }        from './ui/pages/ExpensesPage'
import { WholesalePage }       from './ui/pages/WholesalePage'
import { IAMPage }             from './ui/pages/IAM'

function ComingSoon({ title, sprint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: '#8A9AB5', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1C2B3A' }}>{title}</div>
      <div style={{ fontSize: 13 }}>Coming in {sprint ?? 'Sprint 4'}. Backend APIs are ready.</div>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function Protected({ children }) {
  const token       = useAuthStore((s) => s.token)
  const user        = useAuthStore((s) => s.user)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)

  if (!token) return <Navigate to="/login" replace />

  if (!bootstrapped || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 10, color: '#8A9AB5', fontSize: 14 }}>
        <Spinner size={18} color="#E8A020" /> Loading session…
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionBootstrap />
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<StaffLoginPage initialMode="email" />} />
          <Route path="/pin"   element={<StaffLoginPage initialMode="pin" />} />

          {/* Main app — protected */}
          <Route path="/" element={<Protected><AppLayout /></Protected>}>
            <Route index element={<DashboardPage />} />

            {/* POS — Sprint 4 */}
            <Route path="pos"   element={<ComingSoon title="POS Checkout" sprint="Sprint 4" />} />
            <Route path="sales" element={<ComingSoon title="Sales Reports" sprint="Sprint 5" />} />

            {/* Operations */}
            <Route path="products"       element={<ProductsPage />} />
            <Route path="inventory"      element={<InventoryPage />} />
            <Route path="customers"      element={<CustomersPage />} />
            <Route path="expenses"       element={<ExpensesPage />} />
            <Route path="wholesale"      element={<WholesalePage />} />

            {/* Purchasing */}
            <Route path="suppliers"       element={<SuppliersPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />

            {/* Administration */}
            <Route path="approvals"       element={<ApprovalsPage />} />
            <Route path="users"           element={<IAMPage />} />
            <Route path="settings/iam"    element={<IAMPage />} />
            <Route path="branches"        element={<BranchesPage />} />
            <Route path="accounting"      element={<AccountingPage />} />
            <Route path="workflow-config" element={<WorkflowConfigPage />} />
            <Route path="settings"        element={<ComingSoon title="System Settings" sprint="Sprint 7" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: 13, borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
          success: { iconTheme: { primary: '#1A6E3A', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#C0392B', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
