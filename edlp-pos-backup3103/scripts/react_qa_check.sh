#!/usr/bin/env bash
# =============================================================================
# EDLP POS — React QA Gate
# scripts/qa_check.sh [path/to/src] [--fix] [--report]
#
# Acts as a Senior Engineer Agent to enforce code quality, best practices,
# security, performance, and maintainability standards across the codebase.
#
# Exit code 0 = all gates passed — safe to deploy
# Exit code 1 = errors found — DO NOT deploy
#
# Usage:
#   ./scripts/qa_check.sh                          # checks ./src (default)
#   ./scripts/qa_check.sh /path/to/src             # custom src path
#   ./scripts/qa_check.sh /path/to/src --fix       # auto-fix where possible
#   ./scripts/qa_check.sh /path/to/src --report    # write qa-report.md
# =============================================================================

set -euo pipefail

SRC="${1:-$(pwd)/src}"
FIX_MODE=false
REPORT_MODE=false
REPORT_FILE="$(pwd)/qa-report.md"

for arg in "$@"; do
  case "$arg" in
    --fix)    FIX_MODE=true ;;
    --report) REPORT_MODE=true ;;
  esac
done

ERRORS=0
WARNINGS=0
FIXES=0
REPORT_LINES=()

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# ── Logging helpers ───────────────────────────────────────────────────────────
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; ERRORS=$((ERRORS+1));   REPORT_LINES+=("❌ ERROR: $1"); }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; WARNINGS=$((WARNINGS+1)); REPORT_LINES+=("⚠️  WARN:  $1"); }
log_ok()      { echo -e "${GREEN}[OK]${NC}      $1"; REPORT_LINES+=("✅ OK:    $1"); }
log_fix()     { echo -e "${CYAN}[FIXED]${NC}   $1"; FIXES=$((FIXES+1));    REPORT_LINES+=("🔧 FIXED: $1"); }
log_info()    { echo -e "${MAGENTA}[INFO]${NC}    $1"; REPORT_LINES+=("ℹ️  INFO:  $1"); }
log_section() {
  echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}"
  REPORT_LINES+=("" "### $1")
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        EDLP POS — React QA Gate v1.0            ║${NC}"
echo -e "${BOLD}║        Checking: $(basename "$SRC")                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo -e " Source:  ${CYAN}$SRC${NC}"
echo -e " Fix Mode: $([ "$FIX_MODE" = true ] && echo "${GREEN}ON${NC}" || echo "${YELLOW}OFF${NC}")"
echo -e " Report:  $([ "$REPORT_MODE" = true ] && echo "${GREEN}$REPORT_FILE${NC}" || echo "${YELLOW}OFF${NC}")"
echo ""

# Guard: src must exist
if [ ! -d "$SRC" ]; then
  echo -e "${RED}[FATAL]${NC} Source directory not found: $SRC"
  exit 1
fi

# ── Detect package manager ────────────────────────────────────────────────────
PKG_MANAGER="npm"
[ -f "$(pwd)/pnpm-lock.yaml" ] && PKG_MANAGER="pnpm"
[ -f "$(pwd)/yarn.lock" ]      && PKG_MANAGER="yarn"
[ -f "$(pwd)/bun.lockb" ]      && PKG_MANAGER="bun"

# ─────────────────────────────────────────────────────────────────────────────
# GATE 1 — File & Project Structure
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 1 — Project Structure"

REQUIRED_FILES=("package.json" "vite.config.*" ".eslintrc*|eslint.config.*" ".gitignore")
ROOT="$(dirname "$SRC")"

for pattern in "${REQUIRED_FILES[@]}"; do
  # Use glob-style match via find or ls
  found=$(find "$ROOT" -maxdepth 1 -name "$pattern" 2>/dev/null | head -1 || true)
  # Fallback: try shell glob
  if [ -z "$found" ]; then
    for f in $ROOT/$pattern; do
      [ -e "$f" ] && found="$f" && break
    done
  fi
  if [ -n "$found" ]; then
    log_ok "$(basename "$found") present"
  else
    log_warn "Expected file missing: $pattern — consider adding it"
  fi
done

# Check for environment file hygiene
if [ -f "$ROOT/.env" ] && ! grep -q "\.env" "$ROOT/.gitignore" 2>/dev/null; then
  log_error ".env file exists but is NOT in .gitignore — SECURITY RISK"
fi

# Check .env.example exists if .env exists
if [ -f "$ROOT/.env" ] && [ ! -f "$ROOT/.env.example" ]; then
  log_warn ".env exists but .env.example is missing — document env vars for the team"
fi

# Folder conventions
EXPECTED_DIRS=("components" "pages" "hooks" "stores" "services" "utils")
for dir in "${EXPECTED_DIRS[@]}"; do
  if [ ! -d "$SRC/$dir" ]; then
    log_warn "Recommended directory missing: src/$dir/"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# GATE 2 — Component Quality & Conventions
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 2 — Component Quality & Naming"

COMPONENT_ERRORS=0

# 2a. Components must be PascalCase
while IFS= read -r f; do
  filename=$(basename "$f" | sed 's/\(\.tsx\|\.jsx\)$//')
  # Skip index files and non-component files like hooks/utils
  if [[ "$f" == *"/components/"* ]] || [[ "$f" == *"/pages/"* ]]; then
    if [[ ! "$filename" =~ ^[A-Z] && "$filename" != "index" ]]; then
      log_error "Component file not PascalCase: $f"
      COMPONENT_ERRORS=$((COMPONENT_ERRORS+1))
    fi
  fi
done < <(find "$SRC" -name "*.tsx" -o -name "*.jsx" 2>/dev/null)

[ "$COMPONENT_ERRORS" -eq 0 ] && log_ok "All component files follow PascalCase naming"

# 2b. No default export anonymous arrow functions (hard to debug)
ANON_HITS=$(grep -rn "^export default " "$SRC" 2>/dev/null \
  | grep -v "function\|class\|//\|[A-Z][a-zA-Z]*\b" \
  | grep "=>" || true)
if [ -n "$ANON_HITS" ]; then
  while IFS= read -r line; do
    log_warn "Anonymous default export — name your component for better stack traces: $line"
  done <<< "$ANON_HITS"
else
  log_ok "All default exports are named"
fi

# 2c. Components should not exceed 300 lines (God component smell)
LARGE_FILES=0
while IFS= read -r f; do
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt 300 ]; then
    log_warn "Large component ($lines lines) — consider splitting: $f"
    LARGE_FILES=$((LARGE_FILES+1))
  fi
done < <(find "$SRC" -name "*.tsx" -o -name "*.jsx" 2>/dev/null)
[ "$LARGE_FILES" -eq 0 ] && log_ok "All components are under 300 lines"

# 2d. No inline styles (use Tailwind or CSS modules)
INLINE_STYLE_HITS=$(grep -rn 'style={{' "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|keyframes\|animation\|transform\|width.*variable\|height.*variable" \
  | grep -v "^\s*\*" || true)
if [ -n "$INLINE_STYLE_HITS" ]; then
  while IFS= read -r line; do
    log_warn "Inline style found — prefer Tailwind classes: $line"
  done <<< "$INLINE_STYLE_HITS"
else
  log_ok "No inline styles (Tailwind usage enforced)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 3 — React Best Practices
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 3 — React Best Practices"

# 3a. No direct DOM manipulation
DOM_HITS=$(grep -rn "document\.getElementById\|document\.querySelector\|document\.write" \
  "$SRC" 2>/dev/null | grep "\.tsx\|\.ts\|\.jsx\|\.js" \
  | grep -v "//\|Test\|Spec\|vendor" || true)
if [ -n "$DOM_HITS" ]; then
  while IFS= read -r line; do
    log_error "Direct DOM manipulation found — use React refs or state: $line"
  done <<< "$DOM_HITS"
else
  log_ok "No direct DOM manipulation detected"
fi

# 3b. No useEffect with missing dependencies (common source of bugs)
EFFECT_EMPTY=$(grep -rn "useEffect" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" \
  | grep -E "useEffect\(.*\)" | grep -v "\[\]" \
  | grep -v "deps\|dependencies\|dep)" || true)

# 3c. No setState in render (infinite loop risk)
SET_IN_RENDER=$(grep -rn "useState\|setState\|set[A-Z]" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|const \[" \
  | grep "return (" || true)

# 3d. useCallback/useMemo on handlers passed as props
# (informational — check for functions defined inline in JSX)
INLINE_HANDLERS=$(grep -rn "onClick={() =>" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" \
  | wc -l | tr -d ' ')
if [ "$INLINE_HANDLERS" -gt 10 ]; then
  log_warn "$INLINE_HANDLERS inline onClick arrow functions found — consider useCallback for performance-critical lists"
else
  log_ok "Inline handler usage is reasonable ($INLINE_HANDLERS found)"
fi

# 3e. Keys in lists must not be index (performance / reconciliation issue)
KEY_INDEX_HITS=$(grep -rn "key={index}\|key={i}\|key={idx}" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$KEY_INDEX_HITS" ]; then
  while IFS= read -r line; do
    log_error "Array index used as React key — use stable unique IDs: $line"
  done <<< "$KEY_INDEX_HITS"
else
  log_ok "No array index keys found"
fi

# 3f. No mutating state directly
DIRECT_MUTATION=$(grep -rn "\bstate\.\|\.push(\|\.splice(\|\.sort(\|\.reverse(" "$SRC" 2>/dev/null \
  | grep -v "//\|const \|let \|var \|useState\|Test\|Spec\|immer\|produce" \
  | grep "\.tsx\|\.ts\|\.jsx\|\.js" || true)
if [ -n "$DIRECT_MUTATION" ]; then
  while IFS= read -r line; do
    log_warn "Possible direct state mutation — use immer or spread: $line"
  done <<< "$DIRECT_MUTATION"
else
  log_ok "No direct state mutations detected"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 4 — TypeScript Compliance
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 4 — TypeScript Compliance"

# 4a. No :any or as any
ANY_HITS=$(grep -rn ": any\b\|as any\b" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx" \
  | grep -v "//.*any\|/\*.*any\|eslint-disable" || true)
if [ -n "$ANY_HITS" ]; then
  while IFS= read -r line; do
    log_error ":any or as any found — use proper types or unknown: $line"
  done <<< "$ANY_HITS"
else
  log_ok "No untyped :any usage"
fi

# 4b. No @ts-ignore (suppresses type safety)
TS_IGNORE=$(grep -rn "@ts-ignore\|@ts-nocheck" "$SRC" 2>/dev/null \
  | grep -v "eslint-disable" || true)
if [ -n "$TS_IGNORE" ]; then
  while IFS= read -r line; do
    log_warn "@ts-ignore suppresses type safety — add proper type or use @ts-expect-error with reason: $line"
  done <<< "$TS_IGNORE"
else
  log_ok "No @ts-ignore suppressions"
fi

# 4c. Props interfaces should be defined (not inline object types)
INLINE_PROP_TYPES=$(grep -rn "function [A-Z].*({ " "$SRC" 2>/dev/null \
  | grep ": {" | grep -v "//\|Test\|Spec" | head -10 || true)
if [ -n "$INLINE_PROP_TYPES" ]; then
  log_warn "Consider extracting prop types into named interfaces for reusability:"
  echo "$INLINE_PROP_TYPES" | head -5
fi

# 4d. Run tsc if available
if command -v tsc &>/dev/null && [ -f "$(pwd)/tsconfig.json" ]; then
  log_section "Gate 4b — TypeScript Compiler Check"
  TSC_OUT=$(tsc --noEmit 2>&1 || true)
  if [ -n "$TSC_OUT" ]; then
    TSC_ERRORS=$(echo "$TSC_OUT" | grep -c "error TS" || true)
    log_error "TypeScript compiler found $TSC_ERRORS error(s) — run: tsc --noEmit"
    echo "$TSC_OUT" | grep "error TS" | head -10
  else
    log_ok "TypeScript compiler: no errors"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 5 — Security
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 5 — Security"

# 5a. dangerouslySetInnerHTML — XSS risk
DANGEROUS_HTML=$(grep -rn "dangerouslySetInnerHTML" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|DOMPurify\|sanitize" || true)
if [ -n "$DANGEROUS_HTML" ]; then
  while IFS= read -r line; do
    log_error "dangerouslySetInnerHTML without sanitization — XSS risk. Use DOMPurify: $line"
  done <<< "$DANGEROUS_HTML"
else
  log_ok "No unsafe dangerouslySetInnerHTML usage"
fi

# 5b. No hardcoded secrets / API keys / tokens
SECRET_HITS=$(grep -rn \
  "api_key\s*=\s*['\"][a-zA-Z0-9]\{16,\}\|apiKey\s*:\s*['\"][a-zA-Z0-9]\{16,\}\|secret\s*=\s*['\"][a-zA-Z0-9]\{16,\}\|password\s*=\s*['\"][a-zA-Z0-9]\{8,\}\|Bearer [a-zA-Z0-9]\{20,\}" \
  "$SRC" 2>/dev/null | grep -v "//\|Test\|Spec\|process\.env\|import\.meta\.env\|\.example" || true)
if [ -n "$SECRET_HITS" ]; then
  while IFS= read -r line; do
    log_error "Possible hardcoded secret — use import.meta.env: $line"
  done <<< "$SECRET_HITS"
else
  log_ok "No hardcoded secrets or API keys detected"
fi

# 5c. All env vars go through import.meta.env (Vite standard)
PROCESS_ENV=$(grep -rn "process\.env\." "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|node\|__tests__" || true)
if [ -n "$PROCESS_ENV" ]; then
  while IFS= read -r line; do
    log_error "process.env used — Vite requires import.meta.env: $line"
  done <<< "$PROCESS_ENV"
else
  log_ok "All env vars use import.meta.env (Vite standard)"
fi

# 5d. Eval usage
EVAL_HITS=$(grep -rn "\beval(\|\bFunction(\|new Function(" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.js\|\.jsx" | grep -v "//\|Test\|Spec" || true)
if [ -n "$EVAL_HITS" ]; then
  while IFS= read -r line; do
    log_error "eval() or new Function() found — severe security risk: $line"
  done <<< "$EVAL_HITS"
else
  log_ok "No eval() usage"
fi

# 5e. Target _blank without rel="noopener noreferrer"
BLANK_HITS=$(grep -rn 'target="_blank"' "$SRC" 2>/dev/null \
  | grep -v 'noopener\|noreferrer\|//\|Test\|Spec' || true)
if [ -n "$BLANK_HITS" ]; then
  while IFS= read -r line; do
    log_error 'target="_blank" without rel="noopener noreferrer" — tab-napping risk: '"$line"
  done <<< "$BLANK_HITS"
else
  log_ok 'All target="_blank" links have rel="noopener noreferrer"'
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 6 — Performance
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 6 — Performance"

# 6a. No importing entire libraries (tree-shaking killers)
HEAVY_IMPORTS=$(grep -rn \
  "^import \* as\|from 'lodash'\|from 'moment'\|from 'rxjs'\b\|from 'recharts'" \
  "$SRC" 2>/dev/null | grep -v "//\|Test\|Spec" \
  | grep -v "from 'recharts/'" || true)
if [ -n "$HEAVY_IMPORTS" ]; then
  while IFS= read -r line; do
    log_warn "Full library import found — use named imports for better tree-shaking: $line"
  done <<< "$HEAVY_IMPORTS"
else
  log_ok "No full-library imports detected"
fi

# 6b. React.lazy / Suspense usage for route-level code splitting
LAZY_USAGE=$(grep -rn "React\.lazy\|lazy(" "$SRC" 2>/dev/null | wc -l | tr -d ' ')
ROUTE_COUNT=$(grep -rn "<Route\|createBrowserRouter\|createHashRouter" "$SRC" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ROUTE_COUNT" -gt 3 ] && [ "$LAZY_USAGE" -eq 0 ]; then
  log_warn "$ROUTE_COUNT routes found but no React.lazy() — add code splitting for better initial load time"
else
  [ "$LAZY_USAGE" -gt 0 ] && log_ok "Lazy loading in use ($LAZY_USAGE lazy imports)"
fi

# 6c. Images should not be imported directly (use public/ or CDN)
IMG_IMPORTS=$(grep -rn "^import.*\.\(png\|jpg\|jpeg\|gif\|webp\|svg\)" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|\?url\|?raw" \
  | wc -l | tr -d ' ')
if [ "$IMG_IMPORTS" -gt 5 ]; then
  log_warn "$IMG_IMPORTS direct image imports found — consider using public/ folder or a CDN for large assets"
else
  log_ok "Image import usage is minimal ($IMG_IMPORTS found)"
fi

# 6d. Check for React Query usage without staleTime (refetches too aggressively)
QUERY_NO_STALE=$(grep -rn "useQuery\|useMutation\|useInfiniteQuery" "$SRC" 2>/dev/null \
  | grep -v "staleTime\|gcTime\|cacheTime\|//\|Test\|Spec" \
  | grep "useQuery(" | head -5 || true)
if [ -n "$QUERY_NO_STALE" ]; then
  log_warn "useQuery calls without staleTime — consider setting staleTime to avoid excessive refetches:"
  echo "$QUERY_NO_STALE" | head -3
else
  log_ok "React Query calls appear to have cache configuration"
fi

# 6e. Zustand stores — no derived state stored (compute it instead)
ZUSTAND_DERIVED=$(grep -rn "computed\|derived\|selector" "$SRC/stores" 2>/dev/null \
  | wc -l | tr -d ' ')
[ "$ZUSTAND_DERIVED" -eq 0 ] && log_info "No explicit Zustand selectors — ensure derived state is computed, not stored"

# ─────────────────────────────────────────────────────────────────────────────
# GATE 7 — API & Data Layer (Axios + React Query)
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 7 — API & Data Layer"

# 7a. No raw fetch() — enforce Axios usage
FETCH_HITS=$(grep -rn "\bfetch(" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.js\|\.jsx" \
  | grep -v "//\|Test\|Spec\|web-vitals\|prefetch\|onFetch\|_fetch" || true)
if [ -n "$FETCH_HITS" ]; then
  while IFS= read -r line; do
    log_warn "Raw fetch() found — project uses Axios; ensure interceptors/error handling are applied: $line"
  done <<< "$FETCH_HITS"
else
  log_ok "No raw fetch() — Axios is used consistently"
fi

# 7b. Axios calls should go through a service file, not directly in components
AXIOS_IN_COMPONENT=$(grep -rn "axios\." "$SRC/components" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$AXIOS_IN_COMPONENT" ]; then
  while IFS= read -r line; do
    log_error "Direct Axios call in component — move to src/services/: $line"
  done <<< "$AXIOS_IN_COMPONENT"
else
  log_ok "No Axios calls directly in components"
fi

# 7c. Axios calls should go through a service file, not directly in pages
AXIOS_IN_PAGES=$(grep -rn "axios\." "$SRC/pages" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$AXIOS_IN_PAGES" ]; then
  while IFS= read -r line; do
    log_warn "Direct Axios call in page — consider moving to src/services/: $line"
  done <<< "$AXIOS_IN_PAGES"
fi

# 7d. React Query keys should be arrays (typed queryKey standard)
STRING_KEYS=$(grep -rn "queryKey:\s*['\"]" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$STRING_KEYS" ]; then
  while IFS= read -r line; do
    log_warn "queryKey is a string — use arrays for hierarchy: queryKey: ['resource', id]: $line"
  done <<< "$STRING_KEYS"
else
  log_ok "React Query keys are properly structured as arrays"
fi

# 7e. Error boundaries or error handling in queries
ERROR_BOUNDARY=$(grep -rn "ErrorBoundary\|onError\|isError\|error:" "$SRC" 2>/dev/null \
  | wc -l | tr -d ' ')
if [ "$ERROR_BOUNDARY" -lt 3 ]; then
  log_warn "Very few error handling patterns found — ensure queries and routes have error boundaries"
else
  log_ok "Error handling patterns detected ($ERROR_BOUNDARY occurrences)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 8 — Forms (React Hook Form + Zod)
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 8 — Forms (RHF + Zod)"

# 8a. Forms must use react-hook-form — no uncontrolled onChange state
MANUAL_FORM=$(grep -rn "onChange.*e\.target\.value\|e\.preventDefault.*setState\|formData\[" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|useForm\|Controller\|register" \
  | grep "\.tsx\|\.jsx" || true)
if [ -n "$MANUAL_FORM" ]; then
  while IFS= read -r line; do
    log_warn "Manual form state found — project uses react-hook-form; migrate for better perf: $line"
  done <<< "$MANUAL_FORM"
else
  log_ok "No manual form state patterns"
fi

# 8b. Zod schemas should have descriptive error messages
ZOD_NO_MESSAGE=$(grep -rn "\.min(\|\.max(\|\.email(\|\.required(" "$SRC" 2>/dev/null \
  | grep -v "message:\|//\|Test\|Spec" | head -5 || true)
if [ -n "$ZOD_NO_MESSAGE" ]; then
  log_warn "Zod validation without custom error messages — add message: option for better UX:"
  echo "$ZOD_NO_MESSAGE" | head -3
else
  log_ok "Zod schemas have custom error messages"
fi

# 8c. Forms must have loading/disabled state on submit button
# Check if forms have isSubmitting or isPending
FORM_NO_LOADING=$(grep -rn "type=\"submit\"" "$SRC" 2>/dev/null \
  | grep -v "isSubmitting\|isPending\|isLoading\|disabled\|//\|Test\|Spec" | head -5 || true)
if [ -n "$FORM_NO_LOADING" ]; then
  while IFS= read -r line; do
    log_warn "Submit button without loading/disabled state — prevent double-submission: $line"
  done <<< "$FORM_NO_LOADING"
else
  log_ok "Submit buttons have loading/disabled state"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 9 — State Management (Zustand)
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 9 — State Management (Zustand)"

# 9a. Stores must use immer for complex state (already in dependencies)
STORE_FILES=$(find "$SRC/stores" -name "*.ts" -o -name "*.tsx" 2>/dev/null || true)
if [ -n "$STORE_FILES" ]; then
  while IFS= read -r f; do
    if ! grep -q "immer\|produce\|Immer" "$f" 2>/dev/null; then
      lines=$(wc -l < "$f" | tr -d ' ')
      if [ "$lines" -gt 50 ]; then
        log_warn "Large Zustand store without Immer ($lines lines) — consider using immer middleware: $f"
      fi
    fi
  done <<< "$STORE_FILES"
  log_ok "Zustand stores checked"
fi

# 9b. No global state for server data (use React Query instead)
SERVER_IN_STORE=$(grep -rn "fetch\|axios\|useQuery\|http\." "$SRC/stores" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$SERVER_IN_STORE" ]; then
  while IFS= read -r line; do
    log_warn "Server/fetch logic in Zustand store — server state belongs in React Query: $line"
  done <<< "$SERVER_IN_STORE"
else
  log_ok "Zustand stores don't contain server-fetching logic"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 10 — Code Hygiene & Debug Artifacts
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 10 — Code Hygiene"

# 10a. No console.log (console.warn/error allowed)
CONSOLE_LOG=$(grep -rn "\bconsole\.log(" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.js\|\.jsx" \
  | grep -v "//\|Test\|Spec\|logger\|__DEV__\|development" || true)
if [ -n "$CONSOLE_LOG" ]; then
  while IFS= read -r line; do
    log_error "console.log() found — remove or replace with a logger: $line"
  done <<< "$CONSOLE_LOG"
else
  log_ok "No console.log() debug statements"
fi

# 10b. No commented-out code blocks (3+ consecutive comment lines)
COMMENT_BLOCKS=$(grep -rn "^[[:space:]]*//" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.jsx\|\.js" \
  | grep -v "TODO\|FIXME\|HACK\|NOTE\|eslint\|@\|https://\|http://" \
  | wc -l | tr -d ' ')
if [ "$COMMENT_BLOCKS" -gt 20 ]; then
  log_warn "$COMMENT_BLOCKS commented-out lines detected — remove dead code, use git for history"
else
  log_ok "Minimal commented-out code ($COMMENT_BLOCKS lines)"
fi

# 10c. TODO/FIXME audit
TODO_COUNT=$(grep -rn "TODO\|FIXME\|HACK\|XXX" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.jsx\|\.js" \
  | grep -v "vendor" | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  log_warn "$TODO_COUNT TODO/FIXME markers found — ensure they are tracked in issue tracker"
  grep -rn "TODO\|FIXME\|HACK\|XXX" "$SRC" 2>/dev/null \
    | grep "\.ts\|\.tsx\|\.jsx\|\.js" | head -5
fi

# 10d. No magic numbers (constants should be named)
MAGIC_NUMBERS=$(grep -rn "[^a-zA-Z0-9_]\b[2-9][0-9]\{2,\}\b" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx" | grep -v "//\|px\|ms\|rem\|em\|vh\|vw\|%\|Test\|Spec\|zIndex\|0x" \
  | head -10 || true)
if [ -n "$MAGIC_NUMBERS" ]; then
  log_warn "Magic numbers found — extract to named constants:"
  echo "$MAGIC_NUMBERS" | head -3
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 11 — Accessibility (a11y)
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 11 — Accessibility (a11y)"

# 11a. Images must have alt attributes
IMG_NO_ALT=$(grep -rn "<img\b" "$SRC" 2>/dev/null \
  | grep -v "alt=\|//\|Test\|Spec" || true)
if [ -n "$IMG_NO_ALT" ]; then
  while IFS= read -r line; do
    log_error "Image without alt attribute — required for screen readers: $line"
  done <<< "$IMG_NO_ALT"
else
  log_ok "All <img> tags have alt attributes"
fi

# 11b. Buttons must have accessible text
BTN_NO_TEXT=$(grep -rn "<button\b" "$SRC" 2>/dev/null \
  | grep -v "aria-label\|children\|type=\|//\|Test\|Spec" \
  | grep "/>" || true)
if [ -n "$BTN_NO_TEXT" ]; then
  while IFS= read -r line; do
    log_warn "Self-closing <button> without aria-label — add accessible label: $line"
  done <<< "$BTN_NO_TEXT"
else
  log_ok "Button accessibility looks good"
fi

# 11c. Inputs should have associated labels
INPUT_NO_LABEL=$(grep -rn "<input\b" "$SRC" 2>/dev/null \
  | grep -v "htmlFor\|aria-label\|aria-labelledby\|id=\|type=\"hidden\"\|//\|Test\|Spec" \
  | head -5 || true)
if [ -n "$INPUT_NO_LABEL" ]; then
  log_warn "Inputs without associated labels found — use htmlFor or aria-label:"
  echo "$INPUT_NO_LABEL" | head -3
fi

# 11d. No tabIndex > 0 (breaks natural tab order)
TAB_INDEX=$(grep -rn "tabIndex=[{\"'][1-9]" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$TAB_INDEX" ]; then
  while IFS= read -r line; do
    log_warn "tabIndex > 0 found — this breaks natural tab order: $line"
  done <<< "$TAB_INDEX"
else
  log_ok "No positive tabIndex values"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 12 — Import & Dependency Hygiene
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 12 — Import Hygiene"

# 12a. No relative imports going up more than 2 levels (use path aliases)
DEEP_RELATIVE=$(grep -rn "from '\.\./\.\./\.\." "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.jsx\|\.js" \
  | grep -v "//\|Test\|Spec" | head -10 || true)
if [ -n "$DEEP_RELATIVE" ]; then
  while IFS= read -r line; do
    log_warn "Deep relative import found — configure path aliases in vite.config.ts: $line"
  done <<< "$DEEP_RELATIVE"
else
  log_ok "No deep relative imports (../../../)"
fi

# 12b. Circular imports check (basic heuristic)
# A full check needs madge, but we flag obvious self-imports
SELF_IMPORTS=$(grep -rn "from '\.\/" "$SRC" 2>/dev/null \
  | awk -F: '{print $1, $2}' \
  | awk '{file=$1; gsub(/.*\//, "", file); gsub(/\.tsx?/, "", file); if ($2 ~ file) print NR": "$0}' \
  | head -5 || true)
if [ -n "$SELF_IMPORTS" ]; then
  log_warn "Possible self-imports detected — verify no circular dependencies:"
  echo "$SELF_IMPORTS"
fi

# 12c. Check for duplicate imports in files
DUPE_IMPORTS=$(grep -rn "^import " "$SRC" 2>/dev/null \
  | awk -F: '{print $1}' | sort | uniq -d | while read -r f; do
    # For each file, check for duplicate from same module
    dupe=$(grep "^import " "$f" 2>/dev/null | sed "s/.*from //g" | sort | uniq -d)
    [ -n "$dupe" ] && echo "$f: $dupe"
  done || true)
if [ -n "$DUPE_IMPORTS" ]; then
  while IFS= read -r line; do
    log_warn "Duplicate imports from same module — merge them: $line"
  done <<< "$DUPE_IMPORTS"
else
  log_ok "No duplicate imports detected"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 13 — ESLint
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 13 — ESLint"

if command -v eslint &>/dev/null || [ -f "$(pwd)/node_modules/.bin/eslint" ]; then
  ESLINT_BIN="$(pwd)/node_modules/.bin/eslint"
  [ ! -f "$ESLINT_BIN" ] && ESLINT_BIN="eslint"

  ESLINT_OUT=$("$ESLINT_BIN" "$SRC" --ext .ts,.tsx,.js,.jsx \
    --format compact 2>&1 || true)

  ESLINT_ERRORS=$(echo "$ESLINT_OUT" | grep -c " Error - " || true)
  ESLINT_WARNS=$(echo "$ESLINT_OUT"  | grep -c " Warning - " || true)

  if [ "$ESLINT_ERRORS" -gt 0 ]; then
    log_error "ESLint: $ESLINT_ERRORS error(s) found"
    echo "$ESLINT_OUT" | grep " Error - " | head -10
  else
    log_ok "ESLint: no errors"
  fi

  [ "$ESLINT_WARNS" -gt 0 ] && log_warn "ESLint: $ESLINT_WARNS warning(s) — run: eslint $SRC --fix"

  if [ "$FIX_MODE" = true ] && [ "$ESLINT_ERRORS" -gt 0 ]; then
    "$ESLINT_BIN" "$SRC" --ext .ts,.tsx,.js,.jsx --fix 2>/dev/null && \
      log_fix "ESLint --fix applied"
  fi
else
  log_warn "ESLint not found — install with: $PKG_MANAGER add -D eslint"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 14 — Prettier
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 14 — Prettier Formatting"

if [ -f "$(pwd)/node_modules/.bin/prettier" ]; then
  PRETTIER_BIN="$(pwd)/node_modules/.bin/prettier"

  UNFORMATTED=$("$PRETTIER_BIN" --check "$SRC" 2>&1 | grep "^src\|^app" | wc -l | tr -d ' ')
  if [ "$UNFORMATTED" -gt 0 ]; then
    log_warn "$UNFORMATTED file(s) not formatted — run: prettier --write $SRC"
    if [ "$FIX_MODE" = true ]; then
      "$PRETTIER_BIN" --write "$SRC" 2>/dev/null && log_fix "Prettier formatting applied to $UNFORMATTED files"
    fi
  else
    log_ok "All files are Prettier-formatted"
  fi
else
  log_warn "Prettier not found in node_modules — run: $PKG_MANAGER install"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 15 — Test Coverage Sanity
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 15 — Test Coverage"

TEST_COUNT=$(find "$SRC" -name "*.test.ts" -o -name "*.test.tsx" \
  -o -name "*.spec.ts" -o -name "*.spec.tsx" 2>/dev/null | wc -l | tr -d ' ')
COMPONENT_COUNT=$(find "$SRC" -name "*.tsx" 2>/dev/null | grep -v "test\|spec\|Test\|Spec" | wc -l | tr -d ' ')

if [ "$COMPONENT_COUNT" -gt 0 ]; then
  RATIO=$(echo "scale=0; $TEST_COUNT * 100 / $COMPONENT_COUNT" | bc 2>/dev/null || echo "0")
  if [ "$TEST_COUNT" -eq 0 ]; then
    log_error "No test files found — project has $COMPONENT_COUNT components with 0 tests"
  elif [ "${RATIO:-0}" -lt 30 ]; then
    log_warn "Low test coverage ratio: $TEST_COUNT tests for $COMPONENT_COUNT components (~${RATIO}%)"
  else
    log_ok "$TEST_COUNT test files for $COMPONENT_COUNT components (~${RATIO}% ratio)"
  fi
fi

# Check for Playwright e2e tests
E2E_COUNT=$(find "$(pwd)" -name "*.spec.ts" -path "*/e2e/*" \
  -o -name "*.spec.ts" -path "*/tests/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$E2E_COUNT" -eq 0 ]; then
  log_warn "No Playwright e2e tests found — @playwright/test is in devDependencies but unused"
else
  log_ok "$E2E_COUNT Playwright e2e test file(s) found"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 16 — Build Check
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 16 — Vite Build"

if [ -f "$(pwd)/package.json" ]; then
  if command -v node &>/dev/null; then
    BUILD_SCRIPT=$(node -e "const p=require('$(pwd)/package.json');console.log(p.scripts?.build||'')" 2>/dev/null || echo "")
    if [ -n "$BUILD_SCRIPT" ]; then
      log_info "Build script found: $BUILD_SCRIPT"
      log_info "Run '$PKG_MANAGER run build' to verify production build before deploy"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 17 — Bundle Size Heuristics
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 17 — Bundle Size Heuristics"

# Flag if dist/ exists and main chunk is > 1MB
if [ -d "$(pwd)/dist" ]; then
  LARGE_CHUNKS=$(find "$(pwd)/dist" -name "*.js" -size +1000k 2>/dev/null || true)
  if [ -n "$LARGE_CHUNKS" ]; then
    while IFS= read -r chunk; do
      size=$(du -sh "$chunk" | cut -f1)
      log_warn "Large JS chunk ($size): $(basename $chunk) — add code splitting"
    done <<< "$LARGE_CHUNKS"
  else
    log_ok "No JS chunks over 1MB in dist/"
  fi
else
  log_info "No dist/ folder — run '$PKG_MANAGER run build' to check bundle size"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GATE 18 — POS-Specific Checks (Domain)
# ─────────────────────────────────────────────────────────────────────────────
log_section "Gate 18 — POS Domain Checks"

# 18a. Currency formatting must use numeral.js (not .toFixed())
TO_FIXED=$(grep -rn "\.toFixed(" "$SRC" 2>/dev/null \
  | grep "\.ts\|\.tsx\|\.jsx\|\.js" \
  | grep -v "//\|Test\|Spec\|numeral\|non-currency\|latitude\|lng" || true)
if [ -n "$TO_FIXED" ]; then
  while IFS= read -r line; do
    log_warn ".toFixed() for currency — use numeral.js for locale-aware formatting: $line"
  done <<< "$TO_FIXED"
else
  log_ok "Currency formatting uses numeral.js"
fi

# 18b. QR code components should have error level prop
QR_NO_LEVEL=$(grep -rn "QRCode\|QRCodeSVG\|QRCodeCanvas" "$SRC" 2>/dev/null \
  | grep -v "level=\|//\|Test\|Spec" \
  | grep "<QR" || true)
if [ -n "$QR_NO_LEVEL" ]; then
  while IFS= read -r line; do
    log_warn "QR code without error correction level — add level='M' or higher for print: $line"
  done <<< "$QR_NO_LEVEL"
else
  log_ok "QR code components have error correction level"
fi

# 18c. Real-time (Pusher/Echo) — listeners must be cleaned up
ECHO_LISTENERS=$(grep -rn "\.listen(\|\.channel(\|window\.Echo" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" | wc -l | tr -d ' ')
ECHO_CLEANUP=$(grep -rn "\.stopListening(\|\.leaveChannel(\|\.disconnect(\|return.*() =>" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" | wc -l | tr -d ' ')
if [ "$ECHO_LISTENERS" -gt 0 ] && [ "$ECHO_CLEANUP" -lt "$ECHO_LISTENERS" ]; then
  log_warn "$ECHO_LISTENERS Pusher/Echo listeners found but only $ECHO_CLEANUP cleanup calls — ensure all listeners are cleaned up in useEffect return"
elif [ "$ECHO_LISTENERS" -gt 0 ]; then
  log_ok "Pusher/Echo listeners have cleanup ($ECHO_LISTENERS listeners, $ECHO_CLEANUP cleanup calls)"
fi

# 18d. Hotkeys should have documentation (using react-hotkeys-hook)
HOTKEY_COUNT=$(grep -rn "useHotkeys\|useHotkey" "$SRC" 2>/dev/null \
  | grep -v "//\|Test\|Spec" | wc -l | tr -d ' ')
if [ "$HOTKEY_COUNT" -gt 0 ]; then
  log_ok "$HOTKEY_COUNT keyboard shortcut(s) defined with react-hotkeys-hook"
  HOTKEY_NO_DESC=$(grep -rn "useHotkeys(" "$SRC" 2>/dev/null \
    | grep -v "description:\|//\|Test\|Spec" | head -3 || true)
  [ -n "$HOTKEY_NO_DESC" ] && log_warn "Some hotkeys missing description: option — add for help menu/discoverability"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY REPORT
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                  QA SUMMARY                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e " ${GREEN}${BOLD}✓ PERFECT — All gates passed with no warnings${NC}"
elif [ "$ERRORS" -eq 0 ]; then
  echo -e " ${GREEN}${BOLD}✓ ALL GATES PASSED${NC} — $WARNINGS warning(s) to review"
  echo -e " ${GREEN}Safe to deploy.${NC}"
else
  echo -e " ${RED}${BOLD}✗ DEPLOY BLOCKED${NC}"
fi

echo ""
echo -e "  Errors:   ${RED}${BOLD}$ERRORS${NC}"
echo -e "  Warnings: ${YELLOW}$WARNINGS${NC}"
[ "$FIX_MODE" = true ] && echo -e "  Auto-fixes applied: ${CYAN}$FIXES${NC}"
echo ""

# Write markdown report
if [ "$REPORT_MODE" = true ]; then
  {
    echo "# EDLP POS — QA Report"
    echo "> Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "> Source: \`$SRC\`"
    echo ""
    echo "## Summary"
    echo "| Metric | Count |"
    echo "|--------|-------|"
    echo "| ❌ Errors | $ERRORS |"
    echo "| ⚠️ Warnings | $WARNINGS |"
    echo "| 🔧 Auto-fixes | $FIXES |"
    echo ""
    echo "## Deploy Status"
    if [ "$ERRORS" -eq 0 ]; then
      echo "✅ **SAFE TO DEPLOY**"
    else
      echo "🚫 **DEPLOY BLOCKED** — fix all errors before deploying"
    fi
    echo ""
    echo "## Detailed Results"
    for line in "${REPORT_LINES[@]}"; do
      echo "$line"
    done
    echo ""
    echo "---"
    echo "_Run \`./scripts/qa_check.sh --fix\` to auto-fix ESLint and Prettier issues_"
  } > "$REPORT_FILE"

  echo -e " ${CYAN}Report written to: $REPORT_FILE${NC}"
  echo ""
fi

if [ "$ERRORS" -gt 0 ]; then
  echo -e " ${RED}Fix all [ERROR] items above before running deploy.${NC}"
  echo ""
  exit 1
else
  echo -e " ${GREEN}No blocking errors. Proceeding to deploy is safe.${NC}"
  echo ""
  exit 0
fi
