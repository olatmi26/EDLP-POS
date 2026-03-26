# EDLP POS — Claude Session Context

> **First thing every session:** Read this file completely before touching any code.
> On mobile sessions, tell Claude: "Read edlp_CLAUDE.md from the repo then continue."

---

## Project Identity

| Field          | Value                                      |
|----------------|--------------------------------------------|
| App name       | EDLP POS                                   |
| Tagline        | Hybrid Point-of-Sale System for EDLP Nigeria Limited |
| Stage          | Sprint 1 (Foundation & Architecture)       |
| Last updated   | 2026-03-25                                 |

---

## Repositories

| Repo          | URL                                      | Branch  |
|---------------|------------------------------------------|---------|
| Full project  | github.com/olatmi26/EDLP-POS             | main    |

---

## Local Paths

| Environment     | Path                                      |
|-----------------|-------------------------------------------|
| Windows — Root  | C:\mydocs\edlp-pos                        |
| Windows — React | C:\mydocs\edlp-pos\frontend               |
| WSL             | ~/edlp-pos                                |
| Claude session  | /home/claude/project (always)             |

---

## Tech Stack (FINAL — updated from proposal)

**Backend (Laravel 12 Pure REST API)**
- Laravel 12 (routes/api.php only)
- Sanctum + Spatie Permissions (branch-scoped)
- MySQL 8 + Redis + Horizon
- Pure API — no Inertia, no Blade for frontend

**Frontend (React 18 SPA)**
- Vite 6 + React Router v7 + TanStack Query v5
- Zustand + React Hook Form + Zod
- Tailwind CSS v4
- Recharts + Lucide React

**Desktop (Sprint 5+)**
- C++ Win32 + WebView2 + SQLite3 (C API)

---

## QA Rules — Non-Negotiable (checked by edlp_qa_check.sh)

**PHP / Laravel**
- ❌ NEVER use `Model::all()` without `->limit()` or `->paginate()`
- ❌ NEVER hardcode business logic (use Services + DTOs)
- ❌ All API routes must be in `routes/api.php`
- ✅ ALWAYS use Service-Repository pattern for new features
- ✅ Branch-scoped queries must use Eloquent middleware or scope

**React / TypeScript**
- ❌ NEVER use `console.log` in production code
- ❌ NEVER hardcode colors — use Tailwind CSS variables
- ✅ ALWAYS use TanStack Query for data fetching
- ✅ Always wrap protected routes with `ProtectedRoute` component

---

## File Conventions

**PHP**
```php
<?php
declare(strict_types=1);
namespace App\Services;   // or App\Http\Controllers\Api, App\Repositories, etc.
**Raw file URL pattern:**







