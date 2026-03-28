# Sprint 2 Frontend Delivery — EDLP POS

## Files to REPLACE in your frontend/ directory:

### src/index.css
- Complete CSS token overhaul matching design images

### src/App.jsx
- All 12 routes registered (was only 5)
- QueryClientProvider moved here
- Spinner loading state

### src/lib/format.js
- Updated with NGN money formatter (₦ symbol)

### src/ui/layouts/AppLayout.jsx
- FULL REBUILD — dark navy sidebar matching design images
- Collapsible sidebar (toggle button)
- Nav groups with section labels
- Branch scope badge
- User info + logout at bottom
- Notification bell in top bar
- Branch switcher in top bar for admins

### src/ui/components/shared/index.jsx  [NEW FILE]
Complete component library:
- StatCard, RoleBadge, StatusDot, Badge
- PageHeader, Btn, SearchInput, Card
- DataTable (with pagination, row click, loading state)
- Modal, ConfirmDialog
- FormField, FormInput, FormSelect
- EmptyState, Spinner

### src/ui/pages/DashboardPage.jsx
- FULL REBUILD — real KPI cards from /api/branches/{id}/stats
- 7-Day Revenue LineChart (Recharts)
- Branch Performance BarChart
- Frequent Customer Leaderboard
- Low Stock Alerts list

### src/ui/pages/UsersPage.jsx  [FULL BUILD — was empty]
- User table with colored RoleBadge, StatusDot
- Create/Edit modal (name, email, password, role, branch, staff_id, PIN)
- Toggle active/inactive
- Delete with confirm dialog
- Role filter + search

### src/ui/pages/BranchesPage.jsx  [FULL BUILD — was missing]
- Branch table (name, code, location, phone, staff count, status)
- Create/Edit modal with Nigeria states selector
- Delete with guard (HQ + active users protected)
- Stat cards (total, active, HQ count)

### src/ui/pages/CustomersPage.jsx  [FULL BUILD — was missing]
- Customer table with visit count, total spend, tier badges
- Create/Edit modal
- View customer modal with purchase history
- Tier auto-calculation (Gold/Silver/Standard)

### src/ui/pages/SuppliersPage.jsx  [FULL REBUILD — was only stub]
- Full CRUD supplier table
- Contact info display (phone, email, website icons)
- Payment terms badges
- Create/Edit modal with all fields

### src/ui/pages/PurchaseOrdersPage.jsx  [FULL REBUILD — was only stub]
- PO list with status badges
- Create PO modal with dynamic line items (add/remove)
- Live subtotal calculation
- View PO detail modal
- Approve with confirm dialog
- Stat summary cards (pending/approved/received)

## Deployment command:
./scripts/deploy.sh ~/Downloads/edlp_sprint2_frontend.zip "feat: Sprint 2 frontend complete - AppLayout, all pages, component library"
