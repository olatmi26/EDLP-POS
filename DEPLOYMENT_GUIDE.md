# EDLP POS — Sprint 3 Deployment Guide

## Package 1: Sprint 3 Core (edlp_sprint3.zip)
Backend: Approval Engine + Promotions + Wholesale + FEFO + Stock Movements

## Package 2: Sprint 3 Extension (edlp_sprint3_ext.zip)
Backend: Post-approval visibility + Accounting ledger + eTax/FIRS compliance
Frontend: ApprovalsPage + WorkflowConfigPage + AccountingPage

---

## BACKEND DEPLOYMENT ORDER

### Step 1 — Run Sprint 3 migrations (in order)
```bash
php artisan migrate
```
Migrations to run (Sprint 3 core):
1. `2026_03_28_100001_create_approval_workflows_table`
2. `2026_03_28_100002_create_approval_requests_table`
3. `2026_03_28_100003_create_promotions_table`
4. `2026_03_28_100004_create_wholesale_tables`
5. `2026_03_28_100005_create_product_batches_table`
6. `2026_03_28_100006_create_stock_movements_table`

Migrations to run (Sprint 3 extension):
7. `2026_03_28_200001_add_post_approval_visibility_to_workflows`
8. `2026_03_28_200002_create_accounting_ledger_tables`
9. `2026_03_28_200003_create_etax_tables`

### Step 2 — Register models in your app
Add to `config/app.php` or ensure autoloading covers:
```
App\Models\ApprovalWorkflow, ApprovalStage, ApprovalThreshold
App\Models\ApprovalRequest, ApprovalDecision
App\Models\Promotion, Coupon, CouponUse
App\Models\B2bCustomer, WholesaleOrder, WholesaleOrderItem, WholesalePriceTier, B2bPayment
App\Models\ProductBatch, ExpiryDisposal
App\Models\StockMovement
App\Models\Account, JournalEntry, JournalLine, AccountBalance
App\Models\EtaxConfig, EtaxSubmission
```

### Step 3 — Register event listener in bootstrap/app.php
```php
->withEvents(events: function (\Illuminate\Events\Dispatcher $events) {
    $events->listen(
        \App\Events\ApprovalFullyApproved::class,
        \App\Listeners\HandleApprovalFullyApproved::class
    );
})
```

### Step 4 — Add new routes to routes/api.php
Add use statements at top:
```php
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\WholesaleController;
use App\Http\Controllers\ExpiryController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\AccountingController;
```
Then append the route blocks from:
- `routes/sprint3_api_routes.php`
- `routes/sprint3_ext_api_routes.php`

### Step 5 — Run seeders
```bash
# Use the UPDATED ApprovalWorkflowSeeder (from sprint3-ext, replaces sprint3 version)
php artisan db:seed --class=ApprovalWorkflowSeeder

# Seed chart of accounts
php artisan db:seed --class=ChartOfAccountsSeeder
```

### Step 6 — Register Horizon queue workers
The HandleApprovalFullyApproved listener implements ShouldQueue.
Ensure queue workers are running:
```bash
php artisan queue:work --queue=default
```

### Step 7 — Add scheduler command for expiry monitoring
In `app/Console/Kernel.php` or `routes/console.php`:
```php
Schedule::call(function () {
    app(\App\Services\ExpiryService::class)->runExpiryMonitor();
})->dailyAt('06:00');

// Escalate timed-out approvals every 2 hours
Schedule::call(function () {
    app(\App\Services\ApprovalWorkflowService::class)->escalateTimedOut();
})->everyTwoHours();
```

---

## FRONTEND DEPLOYMENT

### Files to add to frontend/src/ui/pages/:
- `ApprovalsPage.jsx`
- `WorkflowConfigPage.jsx`
- `AccountingPage.jsx`

### Update App.jsx routes — add:
```jsx
import { ApprovalsPage }      from './ui/pages/ApprovalsPage'
import { WorkflowConfigPage } from './ui/pages/WorkflowConfigPage'
import { AccountingPage }     from './ui/pages/AccountingPage'

// Inside the Route "/" children:
<Route path="approvals"         element={<ApprovalsPage />} />
<Route path="workflow-config"   element={<WorkflowConfigPage />} />
<Route path="accounting"        element={<AccountingPage />} />
```

### Update AppLayout.jsx nav groups:
```jsx
// Add to Administration group:
{ to: '/approvals',       icon: AlertCircle,  label: 'Approvals' },
{ to: '/accounting',      icon: BookOpen,     label: 'Accounting' },
{ to: '/workflow-config', icon: Settings,     label: 'Workflow Config' },
```

---

## eTax Configuration (per branch)
After deployment, configure eTax for each branch:
```
POST /api/accounting/etax/config/{branchId}
{
  "tin": "12345678-0001",
  "taxpayer_name": "EDLP Nigeria Limited",
  "api_environment": "sandbox",  // use "production" when live
  "api_key": "YOUR_FIRS_API_KEY",
  "api_secret": "YOUR_FIRS_SECRET",
  "vat_rate": "7.5",
  "is_enabled": false  // set to true when ready
}
```

---

## Deploy commands
```bash
# Package 1 — Sprint 3 core
./scripts/deploy.sh ~/Downloads/edlp_sprint3.zip \
  "feat: Sprint 3 - Approval Engine, Promotions, Wholesale, FEFO, Stock Movements"

# Package 2 — Sprint 3 extension
./scripts/deploy.sh ~/Downloads/edlp_sprint3_ext.zip \
  "feat: Sprint 3 ext - Post-approval visibility, Accounting ledger, eTax/FIRS compliance"
```
