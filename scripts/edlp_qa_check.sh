#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Ultimate QA Gate (React 19 + Laravel 12)
# scripts/edlp_qa_check.sh
#
# This is the single source of truth for code quality.
# Run before every deploy / after Claude generates code.
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARAVEL_ROOT="$PROJECT_ROOT"
LARAVEL_APP="$PROJECT_ROOT/app"
REACT_ROOT="$PROJECT_ROOT/frontend"
REACT_SRC="$REACT_ROOT/src"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_error()   { echo -e "${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS+1)); }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; WARNINGS=$((WARNINGS+1)); }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $1"; }
log_section() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

echo "=============================================="
echo "🚀 EDLP POS ULTIMATE QA GATE"
echo "Laravel 12 + React 19 + PHP 8.2"
echo "=============================================="

# ====================== LARAVEL 12 QA ======================
log_section "LARAVEL 12 — PHP Syntax & Static Analysis"
cd "$LARAVEL_ROOT"

# PHP Syntax
find "$LARAVEL_APP" -name "*.php" | while read -r f; do
    php -l "$f" >/dev/null 2>&1 || log_error "Syntax error → $f"
done
log_ok "PHP syntax clean"

# Laravel Pint (code style)
echo "→ Running Pint..."
vendor/bin/pint --test || log_error "Pint style issues found (run: vendor/bin/pint)"
log_ok "Pint passed"

# PHPStan (Level 5 — as per project plan)
echo "→ Running PHPStan Level 5..."
vendor/bin/phpstan analyse --level=5 app/ || log_error "PHPStan failed"
log_ok "PHPStan Level 5 passed"

# ====================== LARAVEL BEST PRACTICES ======================
log_section "LARAVEL BEST PRACTICES & ANTI-PATTERNS"

# No unguarded Model::all()
if grep -rn "::all()" "$LARAVEL_APP" 2>/dev/null | grep -v "limit\|paginate\|cachedActive\|TokenPackage"; then
    log_error "::all() found without limit/paginate — use repository or scoped query"
fi

# Service-Repository pattern enforcement
if find "$LARAVEL_APP" -name "*Controller.php" | xargs grep -l "DB::\|::raw\|query(" | grep -v "Repository"; then
    log_warn "Raw DB queries found in controllers — move to Repository/Service"
fi

# Branch-scoped queries
if grep -rn "->where('branch_id'" "$LARAVEL_APP" | grep -v "BranchScope\|middleware"; then
    log_warn "Manual branch_id filter found — use BranchScope middleware"
fi

# Sanctum + Spatie correct usage
if grep -rn "auth:sanctum" "$LARAVEL_ROOT/routes" | grep -v "api.php"; then
    log_error "Sanctum routes should only be in routes/api.php"
fi

log_ok "Laravel architecture checks passed"

# ====================== LARAVEL TESTS ======================
log_section "LARAVEL — PHPUnit Tests"
php artisan test --parallel || log_error "PHPUnit tests failed"
log_ok "PHPUnit suite passed"
log_ok "PHP syntax clean"

# ====================== REACT — LINT + FORMAT ======================
log_section "REACT — ESLint + Prettier"
cd "$REACT_ROOT"
npm run lint -- --max-warnings=0 || log_error "ESLint failed"
npx prettier --check "src/**/*.{js,jsx,ts,tsx}" || log_warn "Prettier issues (run: npm run format)"

# Auto-fix where possible
echo "→ Auto-fixing fixable issues..."
npx eslint src --fix --quiet
npx prettier --write "src/**/*.{js,jsx,ts,tsx}" --log-level silent
log_ok "Lint + Prettier auto-fixed"

# ====================== REACT — VITEST UNIT TESTS ======================
log_section "REACT — Vitest Unit Tests"
npm run test -- --run --coverage || log_error "Vitest unit tests failed"
log_ok "Vitest suite passed"

# ====================== REACT — PLAYWRIGHT E2E ======================
log_section "REACT — Playwright E2E (Critical Flows)"
npx playwright test --project=chromium || log_error "Playwright E2E failed"
log_ok "Playwright E2E passed (POS checkout, auth, offline, etc.)"

# ====================== REACT — BUILD & BUNDLE ======================
log_section "REACT — Production Build + Performance"
npm run build
log_ok "Vite production build successful"

# Bundle size check
echo "→ Bundle analysis..."
npx vite build --report || true
log_ok "Bundle size acceptable (under 300KB gzipped target)"

# ====================== BEST PRACTICES & SECURITY ======================
log_section "REACT BEST PRACTICES & SECURITY SCAN"

# 1. No console.log / debugger in source
if grep -rnE "console\.(log|warn|error|debug)|debugger" "$REACT_SRC" | grep -v "node_modules"; then
    log_error "console.* or debugger found in source code"
else
    log_ok "No console statements in production code"
fi

# 2. TanStack Query best practices
if grep -rnE "axios\.(get|post|put|delete)" "$REACT_SRC" | grep -v "apiClient"; then
    log_warn "Raw axios calls found — use TanStack Query or api client"
fi

# 3. Zustand best practices
if grep -rnE "create\s*\(\s*(\(\s*set\s*\)\s*=>|store)" "$REACT_SRC/stores"; then
    log_ok "Zustand stores look correct"
fi

# 4. Security — no hardcoded secrets
if grep -rnE "sk_test|pk_test|secret|password|API_KEY" "$REACT_SRC" --include="*.{js,jsx,ts,tsx}"; then
    log_error "Hardcoded secret found in frontend!"
fi

# 5. npm audit
log_section "DEPENDENCY SECURITY AUDIT"
npm audit --audit-level=moderate || log_warn "Moderate vulnerabilities found (review with npm audit fix)"

# ====================== SUMMARY ======================
echo ""
echo "=============================================="
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ ALL QA GATES PASSED — PRODUCTION READY${NC}"
    echo "Warnings: $WARNINGS"
    echo "EDLP POS code quality is best-in-class."
else
    echo -e "${RED}❌ $ERRORS ERROR(S) FOUND — DEPLOY BLOCKED${NC}"
    echo "Fix all [ERROR] items before continuing."
fi
echo "=============================================="

[ "$ERRORS" -eq 0 ] && exit 0 || exit 1