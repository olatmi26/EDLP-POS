#!/usr/bin/env bash
# =============================================================================
# EDLP POS — QA Gate
# scripts/qa_check.sh [path/to/app]
#
# Runs before every deploy. Blocks deploy if any [ERROR] found.
# Exit 0 = all clear. Exit 1 = errors found.
#
# Usage:
#   ./scripts/qa_check.sh              # checks ./app (default)
#   ./scripts/qa_check.sh /path/to/app
# =============================================================================

set -euo pipefail

APP="${1:-$(pwd)/app}"
ERRORS=0
WARNINGS=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

log_error()   { echo -e "  ${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS+1)); }
log_warn()    { echo -e "  ${YELLOW}[WARN]${NC}  $1"; WARNINGS=$((WARNINGS+1)); }
log_ok()      { echo -e "  ${GREEN}[OK]${NC}    $1"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

echo "=============================================="
echo "  EDLP POS — QA Gate"
echo "  Checking: $APP"
echo "=============================================="

# ── 1. PHP Syntax ─────────────────────────────────────────────────────────────
log_section "PHP Syntax Check"
SYNTAX_ERRORS=0
while IFS= read -r f; do
    if ! php -l "$f" > /dev/null 2>&1; then
        log_error "Syntax error: $f"
        php -l "$f" 2>&1 | tail -1
        SYNTAX_ERRORS=$((SYNTAX_ERRORS+1))
    fi
done < <(find "$APP" -name "*.php" 2>/dev/null | grep -v vendor)

if [ "$SYNTAX_ERRORS" -eq 0 ]; then
    PHP_COUNT=$(find "$APP" -name "*.php" 2>/dev/null | grep -v vendor | wc -l | tr -d ' ')
    log_ok "$PHP_COUNT PHP files — all clean"
fi

# ── 2. No Model::all() without limit ──────────────────────────────────────────
log_section "Unguarded ::all() Check"
ALL_HITS=$(grep -rn "::all()" "$APP" 2>/dev/null \
    | grep -v "//.*::all()\|vendor\|Test\|Seeder\|Factory" \
    | grep -v "^\s*\*" || true)
if [ -n "$ALL_HITS" ]; then
    while IFS= read -r line; do
        log_error "::all() without limit — use paginate() or limit(): $line"
    done <<< "$ALL_HITS"
else
    log_ok "No unguarded ::all() calls"
fi

# ── 3. No dd() / dump() debug helpers ─────────────────────────────────────────
log_section "Debug Helper Check (dd/dump/ray)"
DEBUG_HITS=$(grep -rn "\bdd(\|\bdump(\|\bdumpe(\|\bray(" "$APP" 2>/dev/null \
    | grep -v "//\|#\|\*\|vendor\|Test\|Spec" || true)
if [ -n "$DEBUG_HITS" ]; then
    while IFS= read -r line; do
        log_error "Debug helper found — remove before deploy: $line"
    done <<< "$DEBUG_HITS"
else
    log_ok "No dd()/dump() debug helpers"
fi

# ── 4. No hardcoded prices or tax rates in service files ──────────────────────
log_section "Hardcoded Values Check"
# Tax rate should come from product.vat_rate, not be hardcoded as 0.075 etc.
HARDCODE_HITS=$(grep -rn "\* 0\.075\b\|\* 0\.1\b\|\* 0\.15\b" \
    "$APP/Services" 2>/dev/null \
    | grep -v "//\|#\|private const\|fallback\|default\|Test" \
    | grep -v "^\s*\*" || true)
if [ -n "$HARDCODE_HITS" ]; then
    while IFS= read -r line; do
        log_warn "Possible hardcoded tax/rate — verify it uses product->vat_rate: $line"
    done <<< "$HARDCODE_HITS"
else
    log_ok "No hardcoded tax rates in Services"
fi

# ── 5. All Controllers extend correct base ─────────────────────────────────────
log_section "Controller Base Class Check"
CTRL_DIR="$APP/Http/Controllers"
if [ -d "$CTRL_DIR" ]; then
    BAD_CTRL=0
    while IFS= read -r f; do
        # Skip the base Controller itself
        if [[ "$f" == *"/Controller.php" ]]; then continue; fi
        if ! grep -q "extends Controller\|extends BaseController" "$f" 2>/dev/null; then
            log_warn "Controller may not extend base Controller: $(basename $f)"
            BAD_CTRL=$((BAD_CTRL+1))
        fi
    done < <(find "$CTRL_DIR" -name "*.php" 2>/dev/null | grep -v vendor)
    if [ "$BAD_CTRL" -eq 0 ]; then
        CTRL_COUNT=$(find "$CTRL_DIR" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
        log_ok "$CTRL_COUNT controllers — all extend base"
    fi
else
    log_warn "No Controllers directory found yet"
fi

# ── 6. ApiResponse used consistently in API controllers ───────────────────────
log_section "ApiResponse Consistency Check"
API_CTRL_DIR="$APP/Http/Controllers/Api"
if [ -d "$API_CTRL_DIR" ]; then
    RAW_JSON=0
    while IFS= read -r f; do
        # Check for raw response()->json() without ApiResponse
        if grep -q "response()->json(" "$f" 2>/dev/null; then
            if ! grep -q "use App\\\\Http\\\\Responses\\\\ApiResponse\|ApiResponse::" "$f" 2>/dev/null; then
                log_warn "Raw response()->json() found — use ApiResponse:: instead: $(basename $f)"
                RAW_JSON=$((RAW_JSON+1))
            fi
        fi
    done < <(find "$API_CTRL_DIR" -name "*.php" 2>/dev/null)
    if [ "$RAW_JSON" -eq 0 ]; then
        API_COUNT=$(find "$API_CTRL_DIR" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
        log_ok "$API_COUNT API controllers — consistent ApiResponse usage"
    fi
else
    log_warn "No Api/Controllers directory found yet (OK at start)"
fi

# ── 7. No direct DB::table() raw queries (should use Eloquent) ────────────────
log_section "Raw Query Check"
RAW_DB_HITS=$(grep -rn "DB::table(" "$APP" 2>/dev/null \
    | grep -v "//\|#\|\*\|vendor\|Test\|Migration\|Seeder\|Repository" || true)
if [ -n "$RAW_DB_HITS" ]; then
    while IFS= read -r line; do
        log_warn "DB::table() raw query found — prefer Eloquent models: $line"
    done <<< "$RAW_DB_HITS"
else
    log_ok "No raw DB::table() calls outside migrations"
fi

# ── 8. Branch scope — no queries missing branch filter in branch-scoped models ─
log_section "Auth Middleware on API Routes Check"
ROUTES_FILE="$(dirname $APP)/routes/api.php"
if [ -f "$ROUTES_FILE" ]; then
    # Check that auth:sanctum wraps main routes
    if grep -q "auth:sanctum" "$ROUTES_FILE"; then
        log_ok "auth:sanctum middleware present in routes/api.php"
    else
        log_error "auth:sanctum not found in routes/api.php — all routes may be unprotected"
    fi
else
    log_warn "routes/api.php not found"
fi

# ── 9. No console.log or console.error in JSX/JS files ────────────────────────
FRONTEND_DIR="$(dirname $APP)/frontend/src"
if [ -d "$FRONTEND_DIR" ]; then
    log_section "Frontend console.* Check"
    CONSOLE_HITS=$(grep -rn "console\.log\|console\.error\|console\.warn" "$FRONTEND_DIR" 2>/dev/null \
        | grep -E "\.(js|jsx|ts|tsx)$" \
        | grep -v "//.*console\|/\*.*console" || true)
    if [ -n "$CONSOLE_HITS" ]; then
        while IFS= read -r line; do
            log_warn "console.* found in frontend — remove for production: $line"
        done <<< "$CONSOLE_HITS"
    else
        log_ok "No console.* in frontend src/"
    fi
fi

# ── 10. Migration files have both up() and down() ─────────────────────────────
log_section "Migration up()/down() Check"
MIGRATION_DIR="$(dirname $APP)/database/migrations"
MISSING_DOWN=0
if [ -d "$MIGRATION_DIR" ]; then
    while IFS= read -r f; do
        if ! grep -q "function down()" "$f" 2>/dev/null; then
            log_warn "Migration missing down(): $(basename $f)"
            MISSING_DOWN=$((MISSING_DOWN+1))
        fi
    done < <(find "$MIGRATION_DIR" -name "*.php" 2>/dev/null | grep -v vendor)
    if [ "$MISSING_DOWN" -eq 0 ]; then
        MIG_COUNT=$(find "$MIGRATION_DIR" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
        log_ok "$MIG_COUNT migrations — all have down()"
    fi
fi

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  QA SUMMARY"
if [ "$ERRORS" -eq 0 ]; then
    echo -e "  ${GREEN}ALL GATES PASSED${NC} — $ERRORS errors, $WARNINGS warnings"
    echo "  Safe to deploy."
    echo "=============================================="
    exit 0
else
    echo -e "  ${RED}DEPLOY BLOCKED${NC} — $ERRORS errors, $WARNINGS warnings"
    echo "  Fix all [ERROR] items before running deploy.sh"
    echo "=============================================="
    exit 1
fi
