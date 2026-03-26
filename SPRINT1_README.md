# EDLP POS — Sprint 1 Delivery

**Version:** 1.0  
**Sprint:** 1 of 7 — Project Foundation, Architecture & Database  
**Prepared by:** YUNEXT EXPRESS IT SOLUTIONS ENTERPRISE

---

## What's in this ZIP

| Path | Description |
|------|-------------|
| `app/Models/` | 17 Eloquent models: Branch, User, Product, Inventory, Sale, SaleItem, Customer, CashierSession, Expense, ExpenseCategory, PurchaseOrder, PurchaseOrderItem, PriceHistory, InventoryTransfer, SyncLog, AiPurchaseHistory, SaleHold |
| `app/Http/Controllers/` | AuthController, BranchController, ProductController, InventoryController, CustomerController, UserController |
| `app/Http/Requests/` | All FormRequest validation classes |
| `app/Http/Resources/` | BranchResource, UserResource, ProductResource, InventoryResource, CustomerResource |
| `app/Http/Middleware/BranchScope.php` | Auto-filters queries by user's branch_id |
| `app/Services/` | ProductService, InventoryService, UserService, CustomerService |
| `app/Events/InventoryAdjusted.php` | Event fired on every stock change |
| `app/Providers/AppServiceProvider.php` | Disables JSON resource wrapper |
| `app/Exceptions/Handler.php` | Clean JSON error responses for all exceptions |
| `routes/api.php` | All API routes — public + auth-guarded |
| `config/pos.php` | POS-specific config (VAT, currency, AI cache TTLs) |
| `config/cors.php` | CORS for React SPA + WebView2 desktop |
| `database/seeders/` | DatabaseSeeder, PermissionSeeder, BranchSeeder, UserSeeder, CategorySeeder, ProductSeeder, ExpenseCategorySeeder |
| `.env.example` | All required environment variables documented |
| `scripts/deploy.sh` | Sprint deploy runner |
| `scripts/laravel_qa_check.sh` | Laravel QA gate (20 checks) |
| `scripts/react_qa_check.sh` | React QA gate (18 checks) |
| `scripts/qa.sh` | Fullstack QA orchestrator |

---

## How to deploy this sprint

```bash
# From your WSL project directory:
taiwohassan@ITOP-HASSAN:~/edlp-pos$ ./scripts/deploy.sh \
  ~/Downloads/edlp_sprint1.zip \
  "feat: Sprint 1 — Foundation, all models, services, seeders, API routes"
```

The `deploy.sh` script will:
1. Extract the zip (preserving `.env`, `vendor/`, `.git/`)
2. Run Laravel QA gate (20 checks — blocks on any ERROR)
3. Run `composer install`
4. Run `php artisan migrate --force`
5. `git add -A && git commit && git push origin main`

---

## After deploy — seed the database

```bash
php artisan db:seed
```

Seeded credentials:
| Role | Email | Password | PIN |
|------|-------|----------|-----|
| Super Admin | admin@edlpnigeria.com | Admin@12345 | — |
| Admin | manager@edlpnigeria.com | Manager@12345 | — |
| Branch Manager | emeka@edlpnigeria.com | Branch@12345 | — |
| Cashier (PIN) | phone: 08044444401 | Cashier@12345 | 1234 |

---

## Sprint 1 APIs ready for testing

| Endpoint | Auth |
|----------|------|
| `POST /api/auth/login` | Public |
| `POST /api/auth/login-pin` | Public |
| `GET /api/me` | Token |
| `GET/POST/PUT/DELETE /api/branches` | Token |
| `GET /api/branches/{id}/stats` | Token |
| `GET /api/products` | Token |
| `GET /api/products/search?q=indomie` | Token |
| `POST /api/products/import` | Token |
| `POST /api/products/bulk-price-update` | Token |
| `GET /api/inventory` | Token |
| `POST /api/inventory/adjust` | Token |
| `POST /api/inventory/transfer` | Token |
| `GET /api/customers` | Token |
| `GET /api/customers/{id}/suggestions` | Token |
| `POST /api/customers/merge` | Token |
| `GET/POST/PUT/DELETE /api/users` | Token |

---

## Sprint 2 is next
Authentication UI (login page, PIN pad), Spatie roles enforced on all routes, branch switching for admin, complete user management UI, supplier management + purchase orders.
