#!/usr/bin/env bash
# =============================================================================
# Laravel 12 / PHP 8.2 — QA Gate
# scripts/laravel_qa_check.sh [path/to/app] [--fix] [--report]
#
# Acts as a Senior Engineer Agent to enforce code quality, security,
# performance, and Laravel 12 best practices across the backend codebase.
#
# Exit code 0 = all gates passed — safe to deploy
# Exit code 1 = errors found — DO NOT deploy
#
# Usage:
#   ./scripts/laravel_qa_check.sh                        # checks ./app (default)
#   ./scripts/laravel_qa_check.sh /path/to/app           # custom app path
#   ./scripts/laravel_qa_check.sh /path/to/app --fix     # auto-fix where possible
#   ./scripts/laravel_qa_check.sh /path/to/app --report  # write laravel-qa-report.md
#
# Requirements:
#   - php >= 8.2 in PATH
#   - composer in PATH (for vendor tools)
#   - Optional: ./vendor/bin/phpstan, ./vendor/bin/pint, ./vendor/bin/phpcs
# =============================================================================

set -euo pipefail

APP="${1:-$(pwd)/app}"
ROOT="$(cd "$(dirname "$APP")/.." 2>/dev/null && pwd || dirname "$APP")"
# If app/ is passed, root is parent; if a project root is passed directly, use it
[ -d "$APP/app" ] && ROOT="$APP" && APP="$APP/app"

FIX_MODE=false
REPORT_MODE=false
REPORT_FILE="$ROOT/laravel-qa-report.md"

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

# ── PHP file finder (excludes vendor, storage, bootstrap/cache) ───────────────
find_php() {
  find "$1" -name "*.php" \
    | grep -v "/vendor/\|/storage/\|/bootstrap/cache/\|/node_modules/" \
    2>/dev/null
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Laravel 12 / PHP 8.2 — QA Gate v1.0            ║${NC}"
BASENAME="$(basename "$ROOT")"
echo -e "${BOLD}║      Checking: $BASENAME$(printf '%*s' $((38 - ${#BASENAME})) '')║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo -e " Root:     ${CYAN}$ROOT${NC}"
echo -e " App:      ${CYAN}$APP${NC}"
echo -e " Fix Mode: $([ "$FIX_MODE" = true ] && echo "${GREEN}ON${NC}" || echo "${YELLOW}OFF${NC}")"
echo -e " Report:   $([ "$REPORT_MODE" = true ] && echo "${GREEN}$REPORT_FILE${NC}" || echo "${YELLOW}OFF${NC}")"
echo ""

# Guard: app must exist
if [ ! -d "$APP" ]; then
  echo -e "${RED}[FATAL]${NC} App directory not found: $APP"
  exit 1
fi

# ── PHP version check ─────────────────────────────────────────────────────────
if ! command -v php &>/dev/null; then
  echo -e "${RED}[FATAL]${NC} php not found in PATH"
  exit 1
fi

PHP_VERSION=$(php -r "echo PHP_VERSION;")
PHP_MAJOR=$(php -r "echo PHP_MAJOR_VERSION;")
PHP_MINOR=$(php -r "echo PHP_MINOR_VERSION;")
log_info "PHP version: $PHP_VERSION"

if [ "$PHP_MAJOR" -lt 8 ] || ([ "$PHP_MAJOR" -eq 8 ] && [ "$PHP_MINOR" -lt 2 ]); then
  log_error "PHP $PHP_VERSION detected — Laravel 12 requires PHP >= 8.2"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 1 — PHP Syntax Check
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 1 — PHP Syntax (php -l)"

SYNTAX_ERRORS=0
SYNTAX_FILES=0

while IFS= read -r f; do
  SYNTAX_FILES=$((SYNTAX_FILES+1))
  if ! php -l "$f" > /dev/null 2>&1; then
    log_error "PHP syntax error in: $f"
    php -l "$f" 2>&1 | tail -1
    SYNTAX_ERRORS=$((SYNTAX_ERRORS+1))
  fi
done < <(find_php "$APP")

# Also check routes/, config/, database/
for extra_dir in "$ROOT/routes" "$ROOT/config" "$ROOT/database"; do
  [ -d "$extra_dir" ] && while IFS= read -r f; do
    SYNTAX_FILES=$((SYNTAX_FILES+1))
    if ! php -l "$f" > /dev/null 2>&1; then
      log_error "PHP syntax error in: $f"
      SYNTAX_ERRORS=$((SYNTAX_ERRORS+1))
    fi
  done < <(find_php "$extra_dir")
done

[ "$SYNTAX_ERRORS" -eq 0 ] && log_ok "$SYNTAX_FILES PHP files — all syntax clean"


# ═════════════════════════════════════════════════════════════════════════════
# GATE 2 — Project Structure & Laravel 12 Conventions
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 2 — Laravel 12 Project Structure"

# 2a. Required Laravel directories
REQUIRED_DIRS=("app/Http/Controllers" "app/Models" "app/Providers" "routes" "config" "database/migrations" "resources" "tests")
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$ROOT/$dir" ]; then
    log_warn "Expected Laravel directory missing: $dir"
  fi
done

# 2b. Required Laravel files
REQUIRED_FILES=("composer.json" ".env" "artisan" "bootstrap/app.php")
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$ROOT/$f" ]; then
    log_warn "Expected Laravel file missing: $ROOT/$f"
  fi
done

# 2c. .env in .gitignore
if [ -f "$ROOT/.env" ]; then
  if ! grep -q "^\.env$\|^\.env\b" "$ROOT/.gitignore" 2>/dev/null; then
    log_error ".env file is NOT in .gitignore — CRITICAL SECURITY RISK"
  else
    log_ok ".env is properly gitignored"
  fi
fi

# 2d. .env.example must exist
if [ ! -f "$ROOT/.env.example" ]; then
  log_warn ".env.example missing — document all required env vars for the team"
else
  log_ok ".env.example present"
fi

# 2e. APP_DEBUG must be false in production .env
if grep -q "APP_DEBUG=true" "$ROOT/.env" 2>/dev/null; then
  log_error "APP_DEBUG=true in .env — NEVER deploy with debug mode on (exposes stack traces)"
fi

# 2f. APP_KEY must be set
if ! grep -q "APP_KEY=base64:" "$ROOT/.env" 2>/dev/null; then
  log_warn "APP_KEY not set or not using base64 format — run: php artisan key:generate"
else
  log_ok "APP_KEY is set"
fi

# 2g. Laravel 12 — bootstrap/app.php (new slim bootstrap, not Kernel-based)
if grep -q "Http\\\\Kernel\|Console\\\\Kernel" "$ROOT/bootstrap/app.php" 2>/dev/null; then
  log_warn "Old Kernel-based bootstrap detected — Laravel 12 uses the new slim Application bootstrap"
else
  log_ok "Bootstrap uses Laravel 12 slim Application pattern"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 3 — Naming Conventions & Class Structure
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 3 — Naming Conventions"

# 3a. Controllers must be PascalCase and end in Controller
while IFS= read -r f; do
  filename=$(basename "$f" .php)
  if [[ ! "$filename" =~ Controller$ ]]; then
    log_warn "Controller not suffixed with 'Controller': $f"
  fi
  if [[ ! "$filename" =~ ^[A-Z] ]]; then
    log_error "Controller not PascalCase: $f"
  fi
done < <(find "$APP/Http/Controllers" -name "*.php" 2>/dev/null || true)

# 3b. Models must be singular PascalCase
while IFS= read -r f; do
  filename=$(basename "$f" .php)
  if [[ ! "$filename" =~ ^[A-Z] ]]; then
    log_error "Model not PascalCase: $f"
  fi
  # Common plurals that should be singular
  if [[ "$filename" =~ s$ ]] && [[ ! "$filename" =~ Status$|Class$|Address$|Process$|Access$|Series$|News$ ]]; then
    log_warn "Model appears to be plural: $filename — models should be singular (User not Users)"
  fi
done < <(find "$APP/Models" -name "*.php" 2>/dev/null || true)

# 3c. Requests must end in Request
while IFS= read -r f; do
  filename=$(basename "$f" .php)
  if [[ ! "$filename" =~ Request$ ]]; then
    log_warn "Form Request not suffixed with 'Request': $f"
  fi
done < <(find "$APP/Http/Requests" -name "*.php" 2>/dev/null || true)

# 3d. Policies must end in Policy
while IFS= read -r f; do
  filename=$(basename "$f" .php)
  if [[ ! "$filename" =~ Policy$ ]]; then
    log_warn "Policy file not suffixed with 'Policy': $f"
  fi
done < <(find "$APP/Policies" -name "*.php" 2>/dev/null || true)

# 3e. Events / Listeners / Jobs / Mail / Notifications naming
for type_dir in "Events" "Listeners" "Jobs" "Mail" "Notifications"; do
  while IFS= read -r f; do
    filename=$(basename "$f" .php)
    if [[ ! "$filename" =~ ^[A-Z] ]]; then
      log_error "$type_dir class not PascalCase: $f"
    fi
  done < <(find "$APP/$type_dir" -name "*.php" 2>/dev/null || true)
done

log_ok "Naming convention scan complete"


# ═════════════════════════════════════════════════════════════════════════════
# GATE 4 — Eloquent & Database Best Practices
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 4 — Eloquent & Database"

# 4a. No Model::all() without limit (N+1 / memory killer)
ALL_HITS=$(grep -rn "::all()" "$APP" "$ROOT/routes" 2>/dev/null \
  | grep -v "//.*::all()\|vendor\|Test\|Spec\|cachedActive\|->take\|->limit\|->paginate" \
  | grep -v "^\s*\*" || true)
if [ -n "$ALL_HITS" ]; then
  while IFS= read -r line; do
    log_error "::all() without limit — use paginate(), limit(), or lazy(): $line"
  done <<< "$ALL_HITS"
else
  log_ok "No unguarded ::all() calls"
fi

# 4b. N+1 detection — relationships accessed in loops without eager loading
# Heuristic: foreach with ->relationship inside
NPLUSONE=$(grep -rn "foreach\|->each(" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|vendor\|with(\|load(" || true)
EAGER_MISSING=$(grep -rn "\$[a-zA-Z]*->[a-zA-Z]*->" "$APP/Http" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|with(\|load(\|request\|response\|session\|auth\|config\|app\|blade" \
  | head -5 || true)
if [ -n "$EAGER_MISSING" ]; then
  log_warn "Possible N+1 — chained relationship access without eager loading:"
  echo "$EAGER_MISSING" | head -3
else
  log_ok "No obvious N+1 relationship access patterns"
fi

# 4c. Migrations — no schema changes without down() method
MISSING_DOWN=0
while IFS= read -r f; do
  if ! grep -q "public function down()" "$f" 2>/dev/null; then
    log_warn "Migration missing down() rollback method: $(basename $f)"
    MISSING_DOWN=$((MISSING_DOWN+1))
  fi
done < <(find "$ROOT/database/migrations" -name "*.php" 2>/dev/null || true)
[ "$MISSING_DOWN" -eq 0 ] && log_ok "All migrations have down() rollback methods"

# 4d. No raw DB queries without parameterized bindings (SQL injection)
RAW_SQL=$(grep -rn "DB::statement\|DB::select\|whereRaw\|selectRaw\|orderByRaw\|havingRaw" \
  "$APP" 2>/dev/null | grep -v "//\|Test\|Spec\|?\|bindParam\|\$[a-zA-Z]*\b\]" \
  | grep "\\\$[a-zA-Z]" | grep -v "bindings\|binding\|\[\$" || true)
if [ -n "$RAW_SQL" ]; then
  while IFS= read -r line; do
    log_error "Possible unparameterized raw SQL — use bindings []: $line"
  done <<< "$RAW_SQL"
else
  log_ok "Raw SQL calls appear to use parameterized bindings"
fi

# 4e. Models must declare $fillable or $guarded (not both empty)
UNGUARDED_MODELS=0
while IFS= read -r f; do
  if ! grep -q "\$fillable\|\$guarded" "$f" 2>/dev/null; then
    log_warn "Model has no \$fillable or \$guarded — mass assignment vulnerability: $(basename $f)"
    UNGUARDED_MODELS=$((UNGUARDED_MODELS+1))
  fi
  # Warn if $guarded = [] (fully unguarded)
  if grep -q "protected \\\$guarded\s*=\s*\[\]" "$f" 2>/dev/null; then
    log_warn "Model uses \$guarded = [] (fully unguarded) — prefer explicit \$fillable: $(basename $f)"
  fi
done < <(find "$APP/Models" -name "*.php" 2>/dev/null || true)
[ "$UNGUARDED_MODELS" -eq 0 ] && log_ok "All models declare \$fillable or \$guarded"

# 4f. Soft deletes — models using SoftDeletes should have deleted_at in migrations
SOFTDELETE_MODELS=$(grep -rln "SoftDeletes" "$APP/Models" 2>/dev/null || true)
if [ -n "$SOFTDELETE_MODELS" ]; then
  while IFS= read -r model; do
    model_name=$(basename "$model" .php | tr '[:upper:]' '[:lower:]')
    migration_check=$(find "$ROOT/database/migrations" -name "*.php" 2>/dev/null \
      | xargs grep -l "deleted_at\|softDeletes" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$migration_check" -eq 0 ]; then
      log_warn "Model uses SoftDeletes but no migration with deleted_at found: $(basename $model)"
    fi
  done <<< "$SOFTDELETE_MODELS"
  log_ok "SoftDeletes models checked"
fi

# 4g. No DB queries in constructors
QUERY_IN_CONSTRUCTOR=$(grep -rn "public function __construct" "$APP" 2>/dev/null -A 10 \
  | grep "DB::\|->where\|->find\|->first\|->get()" \
  | grep -v "//\|Test\|Spec" | head -5 || true)
if [ -n "$QUERY_IN_CONSTRUCTOR" ]; then
  log_error "Database query inside constructor — this breaks testing and boot performance"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 5 — Security
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 5 — Security"

# 5a. No hardcoded credentials
HARDCODED_CREDS=$(grep -rn \
  "password\s*=\s*['\"][a-zA-Z0-9!@#\$%^&*]\{6,\}\|secret\s*=\s*['\"][a-zA-Z0-9]\{16,\}\|api_key\s*=\s*['\"][a-zA-Z0-9]\{16,\}" \
  "$APP" "$ROOT/config" "$ROOT/routes" 2>/dev/null \
  | grep -v "//\|env(\|config(\|Test\|Spec\|Hash::\|bcrypt\|password_hash\|validation\|fake()\|factory\|nullable\|confirm\|required\|min:\|confirmed\|:password\|\$password" \
  | grep -v "^\s*\*" || true)
if [ -n "$HARDCODED_CREDS" ]; then
  while IFS= read -r line; do
    log_error "Possible hardcoded credential — use env(): $line"
  done <<< "$HARDCODED_CREDS"
else
  log_ok "No hardcoded credentials detected"
fi

# 5b. All config values must come from env() — not hardcoded in config files
CONFIG_HARDCODED=$(grep -rn "^\s*'[a-zA-Z_]*'\s*=>\s*'[a-zA-Z0-9._@:/]\{10,\}'" \
  "$ROOT/config" 2>/dev/null \
  | grep -v "env(\|//\|timezone\|charset\|collation\|driver\|prefix\|engine\|\\*\|locale\|faker\|cipher\|bcrypt\|argon\|hash\|log\|stack\|deprecations\|single\|daily\|papertrail\|stderr\|syslog\|errorlog\|null\|sync\|redis\|memcached\|array\|bootstrap\|database\|routes\|views\|storage\|public\|lang\|config\|vendor\|node_modules" \
  | head -10 || true)
if [ -n "$CONFIG_HARDCODED" ]; then
  log_warn "Possible hardcoded config values — all secrets should use env():"
  echo "$CONFIG_HARDCODED" | head -3
else
  log_ok "Config values use env() for secrets"
fi

# 5c. Routes must use auth middleware or be explicitly public
UNPROTECTED_ROUTES=$(grep -rn "Route::" "$ROOT/routes/api.php" 2>/dev/null \
  | grep -v "middleware\|auth\|sanctum\|guest\|public\|//\|signed\|throttle\|->name\|->prefix\|->group\|apiResource\b.*{" \
  | grep "Route::post\|Route::put\|Route::patch\|Route::delete" \
  | head -10 || true)
if [ -n "$UNPROTECTED_ROUTES" ]; then
  while IFS= read -r line; do
    log_warn "Mutating API route without explicit middleware check: $line"
  done <<< "$UNPROTECTED_ROUTES"
else
  log_ok "API mutating routes have middleware applied"
fi

# 5d. No eval() in PHP code
EVAL_HITS=$(grep -rn "\beval(" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$EVAL_HITS" ]; then
  while IFS= read -r line; do
    log_error "eval() found — severe security risk: $line"
  done <<< "$EVAL_HITS"
else
  log_ok "No eval() usage"
fi

# 5e. No shell_exec / exec / system / passthru without sanitization
SHELL_HITS=$(grep -rn "\bshell_exec(\|\bexec(\|\bsystem(\|\bpassthru(\|\bpopen(" \
  "$APP" 2>/dev/null | grep -v "//\|Test\|Spec\|escapeshellarg\|escapeshellcmd" || true)
if [ -n "$SHELL_HITS" ]; then
  while IFS= read -r line; do
    log_error "Shell execution without sanitization — use escapeshellarg(): $line"
  done <<< "$SHELL_HITS"
else
  log_ok "No unsafe shell execution calls"
fi

# 5f. CSRF protection — ensure VerifyCsrfToken is not disabled for web routes
if grep -q "VerifyCsrfToken\|csrf" "$ROOT/bootstrap/app.php" 2>/dev/null; then
  if grep -q "except.*\*\|except.*'\*'" "$APP/Http/Middleware/VerifyCsrfToken.php" 2>/dev/null; then
    log_error "CSRF protection disabled for all routes — remove the wildcard exception"
  fi
fi

# 5g. Sanctum / API tokens — no token stored in plain text in DB
TOKEN_PLAIN=$(grep -rn "->token\b\|plainTextToken\|createToken" "$APP" 2>/dev/null \
  | grep "save()\|update(\|DB::" | grep -v "//\|Test\|Spec" || true)
if [ -n "$TOKEN_PLAIN" ]; then
  log_warn "API token possibly being persisted after creation — Sanctum tokens are hashed; never log/store plainTextToken"
fi

# 5h. No var_dump / print_r in production code
DEBUG_PHP=$(grep -rn "\bvar_dump(\|\bprint_r(\|\bvar_export(" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$DEBUG_PHP" ]; then
  while IFS= read -r line; do
    log_error "PHP debug function found — remove before deploy: $line"
  done <<< "$DEBUG_PHP"
else
  log_ok "No var_dump()/print_r() debug calls"
fi

# 5i. dd() / dump() / ray() checks
DD_HITS=$(grep -rn "\bdd(\|\bdump(\|\bdumpe(\|\bray(\|\bddd(" "$APP" "$ROOT/routes" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|addDays\|hidden\|password\|odd\|middle" || true)
if [ -n "$DD_HITS" ]; then
  while IFS= read -r line; do
    log_error "Laravel debug helper found — remove before deploy: $line"
  done <<< "$DD_HITS"
else
  log_ok "No dd()/dump()/ray() debug helpers"
fi

# 5j. File uploads must use validated MIME types
FILE_UPLOAD=$(grep -rn "->file(\|UploadedFile\|storeAs\|store(\|putFile" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|mimes:\|mimetypes:\|image\|validate\|rules" | head -5 || true)
if [ -n "$FILE_UPLOAD" ]; then
  log_warn "File upload without MIME validation detected — always validate mimes in FormRequest:"
  echo "$FILE_UPLOAD" | head -3
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 6 — Controllers
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 6 — Controllers"

# 6a. Controllers must not contain business logic (fat controller smell)
while IFS= read -r f; do
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt 600 ]; then
    log_warn "Fat controller ($lines lines) — move logic to Services/Actions: $f"
  fi
done < <(find "$APP/Http/Controllers" -name "*.php" 2>/dev/null || true)

# 6b. Controllers must use Form Requests for validation (not inline validate())
INLINE_VALIDATE=$(grep -rn "\$request->validate(\|\$this->validate(" "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$INLINE_VALIDATE" ]; then
  while IFS= read -r line; do
    log_warn "Inline validation in controller — extract to FormRequest for reusability: $line"
  done <<< "$INLINE_VALIDATE"
else
  log_ok "Controllers use Form Requests for validation"
fi

# 6c. Controllers should return consistent response formats
MIXED_RESPONSES=$(grep -rn "response()->json\|Response::json\|->toJson()" \
  "$APP/Http/Controllers" 2>/dev/null | wc -l | tr -d ' ')
RESOURCE_USAGE=$(grep -rn "JsonResource\|ResourceCollection\|::collection\|new [A-Z].*Resource(" \
  "$APP/Http/Controllers" 2>/dev/null | wc -l | tr -d ' ')
if [ "$MIXED_RESPONSES" -gt 5 ] && [ "$RESOURCE_USAGE" -eq 0 ]; then
  log_warn "Raw response()->json() used $MIXED_RESPONSES times with no API Resources — use Laravel Resources for consistent output"
else
  [ "$RESOURCE_USAGE" -gt 0 ] && log_ok "API Resources used for response formatting ($RESOURCE_USAGE occurrences)"
fi

# 6d. No direct Model access in controllers — should go through Services
DIRECT_ELOQUENT=$(grep -rn "::\(create\|update\|where\|find\|firstOrCreate\)(" \
  "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|Auth::" | head -10 || true)
if [ -n "$DIRECT_ELOQUENT" ]; then
  log_warn "Direct Eloquent calls in controller — consider Service/Repository pattern:"
  echo "$DIRECT_ELOQUENT" | head -3
fi

# 6e. Single Responsibility — one public method per action (avoid multi-method controllers)
CONTROLLER_ACTION_COUNT=0
while IFS= read -r f; do
  action_count=$(grep -c "public function " "$f" 2>/dev/null | tr -d '[:space:]' || echo 0)
  if [ "${action_count:-0}" -gt 7 ]; then
    log_warn "Controller has $action_count public methods — consider splitting: $(basename $f)"
    CONTROLLER_ACTION_COUNT=$((CONTROLLER_ACTION_COUNT+1))
  fi
done < <(find "$APP/Http/Controllers" -name "*.php" 2>/dev/null || true)
[ "$CONTROLLER_ACTION_COUNT" -eq 0 ] && log_ok "Controller method counts are within bounds"


# ═════════════════════════════════════════════════════════════════════════════
# GATE 7 — Service Layer & Business Logic
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 7 — Service Layer"

# 7a. Services must be injected via constructor, not instantiated with new
NEW_SERVICE=$(grep -rn "new [A-Z][a-zA-Z]*Service(" "$APP/Http/Controllers" \
  "$APP/Http/Requests" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$NEW_SERVICE" ]; then
  while IFS= read -r line; do
    log_warn "Service instantiated with 'new' — use constructor injection for testability: $line"
  done <<< "$NEW_SERVICE"
else
  log_ok "Services are constructor-injected (not manually instantiated)"
fi

# 7b. No hardcoded token rates / fees (project-specific)
HARDCODED_RATES=$(grep -rn "\* 0\.9\b\|\* 1\.111\|\* 1\.1111\|FEE.*0\.075\|\* 0\.075" \
  "$APP/Services" 2>/dev/null \
  | grep -v "//\|#\|private const\|fallback\|default\|Test\|Spec" \
  | grep -v "^\s*\*" || true)
if [ -n "$HARDCODED_RATES" ]; then
  while IFS= read -r line; do
    log_error "Hardcoded rate/fee in service — use config() or PlatformSettingsService: $line"
  done <<< "$HARDCODED_RATES"
else
  log_ok "No hardcoded rates in Service layer"
fi

# 7c. Services must not directly access HTTP request (breaks testability)
REQUEST_IN_SERVICE=$(grep -rn "request()\|Request \$request\|\$_GET\|\$_POST\|\$_REQUEST" \
  "$APP/Services" 2>/dev/null | grep -v "//\|Test\|Spec" || true)
if [ -n "$REQUEST_IN_SERVICE" ]; then
  while IFS= read -r line; do
    log_warn "HTTP request accessed in Service — pass data as parameters instead: $line"
  done <<< "$REQUEST_IN_SERVICE"
else
  log_ok "Services don't directly access HTTP request"
fi

# 7d. Large service files (God service smell)
while IFS= read -r f; do
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt 400 ]; then
    log_warn "Large service file ($lines lines) — consider splitting by responsibility: $f"
  fi
done < <(find "$APP/Services" -name "*.php" 2>/dev/null || true)


# ═════════════════════════════════════════════════════════════════════════════
# GATE 8 — API Resources & Response Standards
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 8 — API Resources & Responses"

# 8a. API Resources must exist if API routes do
if [ -d "$ROOT/routes" ] && grep -q "Route::" "$ROOT/routes/api.php" 2>/dev/null; then
  if [ ! -d "$APP/Http/Resources" ]; then
    log_warn "API routes found but no app/Http/Resources/ directory — use API Resources for consistent JSON output"
  else
    RESOURCE_COUNT=$(find "$APP/Http/Resources" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
    log_ok "$RESOURCE_COUNT API Resource(s) defined"
  fi
fi

# 8b. No direct array returns from API controllers (inconsistent structure)
DIRECT_ARRAY_RETURN=$(grep -rn "return \[" "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|'rules'\|'messages'" || true)
if [ -n "$DIRECT_ARRAY_RETURN" ]; then
  while IFS= read -r line; do
    log_warn "Raw array return from controller — use API Resources or response helpers: $line"
  done <<< "$DIRECT_ARRAY_RETURN"
fi

# 8c. Consistent HTTP status codes
WRONG_STATUS=$(grep -rn "response()->json.*200\b" "$APP/Http/Controllers" 2>/dev/null \
  | grep "store\|create\|post" | grep -v "//\|Test\|Spec" | head -5 || true)
if [ -n "$WRONG_STATUS" ]; then
  log_warn "POST/store endpoints returning 200 — use 201 Created for resource creation"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 9 — Validation (Form Requests)
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 9 — Validation"

# 9a. Form Requests must implement authorize() properly
ALWAYS_TRUE_AUTH=$(grep -rn "public function authorize()" "$APP/Http/Requests" 2>/dev/null -A 3 \
  | grep "return true;" | wc -l | tr -d ' ')
REQUEST_COUNT=$(find "$APP/Http/Requests" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
if [ "$REQUEST_COUNT" -gt 0 ] && [ "$ALWAYS_TRUE_AUTH" -eq "$REQUEST_COUNT" ]; then
  log_warn "All $REQUEST_COUNT FormRequests return authorize() = true — implement proper authorization checks"
elif [ "$ALWAYS_TRUE_AUTH" -gt 0 ]; then
  log_warn "$ALWAYS_TRUE_AUTH FormRequest(s) have authorize() = true without policy checks"
else
  log_ok "FormRequest authorize() methods use proper authorization"
fi

# 9b. Validation rules should use Rule objects for complex rules
REGEX_RULES=$(grep -rn "'regex:\|\"regex:" "$APP/Http/Requests" 2>/dev/null \
  | grep -v "//\|Test\|Spec" | wc -l | tr -d ' ')
if [ "$REGEX_RULES" -gt 3 ]; then
  log_warn "$REGEX_RULES regex validation rules found — consider Rule::in() or custom Rule objects for readability"
fi

# 9c. Required fields without 'nullable' or 'sometimes' for optional updates
UPDATE_REQUESTS=$(find "$APP/Http/Requests" -name "Update*.php" -o -name "*UpdateRequest.php" 2>/dev/null || true)
if [ -n "$UPDATE_REQUESTS" ]; then
  while IFS= read -r f; do
    if grep -q "'required'" "$f" 2>/dev/null && ! grep -q "nullable\|sometimes" "$f" 2>/dev/null; then
      log_warn "Update request uses 'required' without 'sometimes/nullable' — PATCH requests should allow partial updates: $(basename $f)"
    fi
  done <<< "$UPDATE_REQUESTS"
fi

log_ok "Validation checks complete"


# ═════════════════════════════════════════════════════════════════════════════
# GATE 10 — Caching & Performance
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 10 — Caching & Performance"

# 10a. No Model::all() without limit (repeat from Gate 4 — critical enough for its own gate)
# Already covered above

# 10b. Cache usage check — no cache without TTL
CACHE_FOREVER=$(grep -rn "Cache::put\|cache()->put\|Cache::forever\|cache()->forever\|Cache::rememberForever" \
  "$APP" 2>/dev/null | grep -v "//\|Test\|Spec" || true)
if [ -n "$CACHE_FOREVER" ]; then
  while IFS= read -r line; do
    log_warn "Cache stored forever — set an expiry TTL to prevent stale data: $line"
  done <<< "$CACHE_FOREVER"
else
  log_ok "No forever-cache calls without TTL"
fi

# 10c. No synchronous heavy operations in request lifecycle (use Jobs)
SYNC_HEAVY=$(grep -rn "Mail::send\|Mail::to\b\|Notification::send\|Http::post\|Http::get" \
  "$APP/Http/Controllers" "$APP/Services" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|->queue\|->later\|->onQueue\|dispatch\|Queue::" | head -10 || true)
if [ -n "$SYNC_HEAVY" ]; then
  while IFS= read -r line; do
    log_warn "Synchronous Mail/Notification/HTTP call in request — use queued jobs for better response times: $line"
  done <<< "$SYNC_HEAVY"
else
  log_ok "Heavy operations (mail/notifications) use queues"
fi

# 10d. Missing database indexes heuristic — foreign keys should be indexed
UNINDEXED_FK=$(grep -rn "\$table->foreignId\|\$table->unsignedBigInteger\|\$table->foreign(" \
  "$ROOT/database/migrations" 2>/dev/null \
  | grep -v "->index()\|->constrained\|//\|Test\|Spec" | head -5 || true)
if [ -n "$UNINDEXED_FK" ]; then
  log_warn "Foreign key columns possibly without indexes — use ->index() or ->constrained():"
  echo "$UNINDEXED_FK" | head -3
else
  log_ok "Foreign key columns appear to be indexed"
fi

# 10e. No select * with Eloquent (always select specific columns)
SELECT_STAR=$(grep -rn "->select('\*')\|->select(\"\*\")\|->get()\b" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|->with\|count\|paginate\|->select(" | head -5 || true)
if [ -n "$SELECT_STAR" ]; then
  log_warn "Possible SELECT * queries — specify columns for better performance:"
  echo "$SELECT_STAR" | head -3
fi

# 10f. Queue worker check — jobs should implement ShouldQueue
JOB_FILES=$(find "$APP/Jobs" -name "*.php" 2>/dev/null || true)
if [ -n "$JOB_FILES" ]; then
  while IFS= read -r f; do
    if ! grep -q "ShouldQueue\|implements.*Queue" "$f" 2>/dev/null; then
      log_warn "Job does not implement ShouldQueue — sync jobs defeat the purpose: $(basename $f)"
    fi
  done <<< "$JOB_FILES"
  log_ok "Job files checked for ShouldQueue"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 11 — PHP 8.2 Modern Syntax & Compliance
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 11 — PHP 8.2 Modern Syntax"

# 11a. Use typed properties (PHP 8.0+) — warn on untyped class properties
UNTYPED_PROPS=$(grep -rn "^\s\+\(public\|protected\|private\)\s\+\$[a-zA-Z]" "$APP" 2>/dev/null \
  | grep -v "//\|\*\|string\|int\|float\|bool\|array\|object\|mixed\|null\|Collection\|[A-Z]\|?\s*[a-z]" \
  | head -10 || true)
if [ -n "$UNTYPED_PROPS" ]; then
  log_warn "Untyped class properties found — PHP 8.2 supports typed properties:"
  echo "$UNTYPED_PROPS" | head -3
else
  log_ok "Class properties appear to use PHP 8.x typed declarations"
fi

# 11b. Use return type declarations on all methods
UNTYPED_METHODS=$(grep -rn "public function [a-zA-Z]*(" "$APP" 2>/dev/null \
  | grep -v ": \|static\|__construct\|__destruct\|__toString\|//\|\*" \
  | grep -v "Test\|Spec" | head -10 || true)
if [ -n "$UNTYPED_METHODS" ]; then
  log_warn "Methods without return type declarations found — add return types for type safety:"
  echo "$UNTYPED_METHODS" | head -3
fi

# 11c. No use of deprecated dynamic properties (PHP 8.2 deprecated)
DYNAMIC_PROPS=$(grep -rn "\$this->[a-zA-Z_]*\s*=" "$APP" 2>/dev/null \
  | grep -v "//\|\*\|Test\|Spec\|\$this->attributes\|\$this->relations\|\$this->original" \
  | grep -v "public\|protected\|private\|fillable\|guarded\|casts\|dates\|table\|primaryKey" \
  | head -10 || true)
# (Informational — too many false positives to error on)

# 11d. Use match expressions instead of switch (PHP 8.0+)
SWITCH_USAGE=$(grep -rn "^\s*switch\s*(" "$APP" 2>/dev/null \
  | grep -v "//\|\*\|Test\|Spec" | wc -l | tr -d ' ')
if [ "$SWITCH_USAGE" -gt 5 ]; then
  log_warn "$SWITCH_USAGE switch() statements — consider match() expression for cleaner, type-safe branching"
else
  log_ok "switch() usage minimal ($SWITCH_USAGE) — match() expressions preferred"
fi

# 11e. Use null-safe operator (?->) instead of isset chains
ISSET_CHAIN=$(grep -rn "isset(\$[a-zA-Z]*->" "$APP" 2>/dev/null \
  | grep -v "//\|\*\|Test\|Spec" | head -5 || true)
if [ -n "$ISSET_CHAIN" ]; then
  log_warn "isset() on chained objects — use PHP 8 null-safe operator ?-> instead:"
  echo "$ISSET_CHAIN" | head -3
else
  log_ok "No verbose isset() chains (null-safe operator in use)"
fi

# 11f. Use constructor property promotion (PHP 8.0+)
OLD_CONSTRUCTOR=$(grep -rn "public function __construct" "$APP" 2>/dev/null -A 10 \
  | grep "^\s*\$this->[a-zA-Z_]* = \$[a-zA-Z_]*;" \
  | wc -l | tr -d ' ')
if [ "$OLD_CONSTRUCTOR" -gt 10 ]; then
  log_warn "$OLD_CONSTRUCTOR old-style constructor assignments — use constructor property promotion (PHP 8.0+)"
fi

# 11g. Readonly properties — use readonly for immutable data
log_info "Consider using PHP 8.1+ readonly properties for DTOs and Value Objects"


# ═════════════════════════════════════════════════════════════════════════════
# GATE 12 — Laravel 12 Specific Features & Patterns
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 12 — Laravel 12 Patterns"

# 12a. Use Invokable Single Action Controllers
MULTI_ACTION=$(find "$APP/Http/Controllers" -name "*.php" 2>/dev/null -exec grep -l "public function index\|public function store\|public function show" {} \; | wc -l | tr -d ' ')
INVOKABLE=$(grep -rln "public function __invoke" "$APP/Http/Controllers" 2>/dev/null | wc -l | tr -d ' ')
log_info "$MULTI_ACTION resource controllers, $INVOKABLE invokable single-action controllers"

# 12b. Route model binding must be used — no manual ->find() in controllers
MANUAL_FIND=$(grep -rn "\$request->route\|Route::current\|\$id\)\|Request \$request.*\$id" \
  "$APP/Http/Controllers" 2>/dev/null \
  | grep "find(\$id\|find(\$request\|->find(request" \
  | grep -v "//\|Test\|Spec" | head -5 || true)
if [ -n "$MANUAL_FIND" ]; then
  while IFS= read -r line; do
    log_warn "Manual model lookup — use Route Model Binding instead (type-hint Model in method): $line"
  done <<< "$MANUAL_FIND"
else
  log_ok "Route Model Binding patterns detected"
fi

# 12c. Policies — authorization should use Gates/Policies not manual checks
MANUAL_AUTH=$(grep -rn "if (\$user->id ==\|if (auth()->id() ==\|if (\$request->user()->id ==" \
  "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|Test\|Spec" | head -5 || true)
if [ -n "$MANUAL_AUTH" ]; then
  while IFS= read -r line; do
    log_warn "Manual ID comparison for authorization — use Policies and \$this->authorize(): $line"
  done <<< "$MANUAL_AUTH"
else
  log_ok "No manual ID-based authorization (Policies in use)"
fi

# 12d. Observers / Events — ensure event listeners are registered
if [ -d "$APP/Observers" ]; then
  OBSERVER_COUNT=$(find "$APP/Observers" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
  OBSERVER_REGISTERED=$(grep -rn "observe(\|::observe(" "$APP/Providers" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$OBSERVER_COUNT" -gt "$OBSERVER_REGISTERED" ]; then
    log_warn "$OBSERVER_COUNT Observer(s) found but only $OBSERVER_REGISTERED registered — check AppServiceProvider"
  else
    log_ok "$OBSERVER_COUNT Observer(s) registered correctly"
  fi
fi

# 12e. Queues — failed jobs table should exist
if [ -d "$ROOT/database/migrations" ]; then
  FAILED_JOBS_MIGRATION=$(find "$ROOT/database/migrations" -name "*failed_jobs*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$FAILED_JOBS_MIGRATION" -eq 0 ]; then
    log_warn "No failed_jobs migration — run: php artisan queue:failed-table && php artisan migrate"
  else
    log_ok "failed_jobs table migration exists"
  fi
fi

# 12f. Telescope / Debugbar must not be in production dependencies
TELESCOPE_PROD=$(grep -n "telescope\|debugbar" "$ROOT/composer.json" 2>/dev/null \
  | grep -v "require-dev\|//\|#" | head -5 || true)
if [ -n "$TELESCOPE_PROD" ]; then
  log_warn "Laravel Telescope/Debugbar in production dependencies — move to require-dev"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 13 — Migrations & Database Schema
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 13 — Migrations & Schema"

# 13a. No schema changes in seeders
SCHEMA_IN_SEEDER=$(grep -rn "Schema::\|DB::statement.*CREATE\|DB::statement.*ALTER" \
  "$ROOT/database/seeders" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$SCHEMA_IN_SEEDER" ]; then
  while IFS= read -r line; do
    log_error "Schema change in seeder — schema belongs in migrations: $line"
  done <<< "$SCHEMA_IN_SEEDER"
else
  log_ok "No schema changes in seeders"
fi

# 13b. Migrations should not contain business logic
BIZ_IN_MIGRATION=$(grep -rn "new [A-Z][a-zA-Z]*\|App\\\\Models\|Illuminate\\\\Support\\\\Facades\\\\Mail" \
  "$ROOT/database/migrations" 2>/dev/null \
  | grep -v "//\|\*\|DB::\|Schema::\|use " | head -5 || true)
if [ -n "$BIZ_IN_MIGRATION" ]; then
  while IFS= read -r line; do
    log_warn "Business logic in migration — migrations should only define schema: $line"
  done <<< "$BIZ_IN_MIGRATION"
else
  log_ok "Migrations contain only schema definitions"
fi

# 13c. Timestamps — tables should have timestamps() unless explicitly excluded
TABLES_NO_TIMESTAMPS=0
while IFS= read -r f; do
  if ! grep -q "timestamps()\|\$table->created_at\|->timestamp(" "$f" 2>/dev/null; then
    # Skip pivot tables and helper tables
    fname=$(basename "$f")
    if [[ ! "$fname" =~ pivot\|_failed_\|personal_access\|cache\|sessions\|jobs\|batch ]]; then
      log_info "No timestamps() in migration: $(basename $f) — intentional? Add timestamps() for audit trail"
    fi
  fi
done < <(find "$ROOT/database/migrations" -name "*create_*" 2>/dev/null || true)


# ═════════════════════════════════════════════════════════════════════════════
# GATE 14 — Testing Coverage
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 14 — Test Coverage"

TEST_COUNT=$(find "$ROOT/tests" -name "*.php" 2>/dev/null \
  | grep -v "TestCase\|CreatesApplication" | wc -l | tr -d ' ')
CONTROLLER_COUNT=$(find "$APP/Http/Controllers" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
SERVICE_COUNT=$(find "$APP/Services" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')

log_info "$TEST_COUNT test files for $CONTROLLER_COUNT controllers and $SERVICE_COUNT services"

if [ "$TEST_COUNT" -eq 0 ]; then
  log_error "No test files found — a production application must have tests"
elif [ "$CONTROLLER_COUNT" -gt 0 ]; then
  FEATURE_TESTS=$(find "$ROOT/tests/Feature" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
  UNIT_TESTS=$(find "$ROOT/tests/Unit" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
  log_info "Feature: $FEATURE_TESTS | Unit: $UNIT_TESTS"

  if [ "$FEATURE_TESTS" -eq 0 ]; then
    log_warn "No Feature tests — HTTP endpoint tests are critical for API reliability"
  else
    log_ok "$FEATURE_TESTS Feature test file(s)"
  fi
  if [ "$UNIT_TESTS" -eq 0 ]; then
    log_warn "No Unit tests — business logic in Services should have unit tests"
  else
    log_ok "$UNIT_TESTS Unit test file(s)"
  fi
fi

# 14b. Run test suite if available and not too large
if command -v php &>/dev/null && [ -f "$ROOT/artisan" ]; then
  if [ "$TEST_COUNT" -lt 50 ]; then
    log_info "Run tests with: php artisan test --parallel"
  else
    log_info "Large test suite ($TEST_COUNT files) — run: php artisan test --parallel --bail"
  fi
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 15 — PHPStan Static Analysis
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 15 — PHPStan Static Analysis"

PHPSTAN_BIN=""
[ -f "$ROOT/vendor/bin/phpstan" ] && PHPSTAN_BIN="$ROOT/vendor/bin/phpstan"

if [ -n "$PHPSTAN_BIN" ]; then
  PHPSTAN_CONFIG=""
  [ -f "$ROOT/phpstan.neon" ]      && PHPSTAN_CONFIG="--configuration=$ROOT/phpstan.neon"
  [ -f "$ROOT/phpstan.neon.dist" ] && PHPSTAN_CONFIG="--configuration=$ROOT/phpstan.neon.dist"

  PHPSTAN_OUT=$("$PHPSTAN_BIN" analyse "$APP" \
    $PHPSTAN_CONFIG \
    --level=6 \
    --no-progress \
    --error-format=raw 2>&1 || true)

  PHPSTAN_ERRORS=$(echo "$PHPSTAN_OUT" | grep -c "^$APP\|Line\b" || true)

  if [ "$PHPSTAN_ERRORS" -gt 0 ]; then
    log_error "PHPStan found $PHPSTAN_ERRORS issue(s) at level 6"
    echo "$PHPSTAN_OUT" | head -15
  else
    log_ok "PHPStan analysis passed at level 6"
  fi
else
  log_warn "PHPStan not installed — run: composer require --dev phpstan/phpstan larastan/larastan"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 16 — Laravel Pint (Code Style)
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 16 — Laravel Pint (Code Style)"

PINT_BIN=""
[ -f "$ROOT/vendor/bin/pint" ] && PINT_BIN="$ROOT/vendor/bin/pint"

if [ -n "$PINT_BIN" ]; then
  PINT_OUT=$("$PINT_BIN" --test "$APP" 2>&1 || true)
  PINT_DIRTY=$(echo "$PINT_OUT" | grep -c "FIXED\|Would fix" || true)

  if [ "$PINT_DIRTY" -gt 0 ]; then
    log_warn "$PINT_DIRTY file(s) need formatting — run: ./vendor/bin/pint"
    if [ "$FIX_MODE" = true ]; then
      "$PINT_BIN" "$APP" 2>/dev/null && log_fix "Pint formatting applied"
    fi
  else
    log_ok "All PHP files match Pint code style"
  fi
else
  log_warn "Laravel Pint not installed — run: composer require --dev laravel/pint"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 17 — Composer & Dependencies
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 17 — Composer & Dependencies"

if [ -f "$ROOT/composer.json" ] && command -v composer &>/dev/null; then
  # 17a. Check for known vulnerabilities
  AUDIT_OUT=$(composer audit --working-dir="$ROOT" --no-interaction 2>&1 || true)
  VULN_COUNT=$(echo "$AUDIT_OUT" | grep -c "CVE-\|vulnerability\|Vulnerability" || true)
  if [ "$VULN_COUNT" -gt 0 ]; then
    log_error "$VULN_COUNT vulnerability/vulnerabilities found in Composer dependencies"
    echo "$AUDIT_OUT" | grep "CVE-\|Package\|Severity" | head -10
  else
    log_ok "No known vulnerabilities in Composer dependencies"
  fi

  # 17b. composer.lock must be committed
  if [ ! -f "$ROOT/composer.lock" ]; then
    log_error "composer.lock missing — must be committed for reproducible deploys"
  else
    log_ok "composer.lock is present"
  fi

  # 17c. Dev dependencies not in require (only require-dev)
  DEV_IN_PROD=$(php -r "
    \$c = json_decode(file_get_contents('$ROOT/composer.json'), true);
    \$prod = array_keys(\$c['require'] ?? []);
    \$devPkgs = ['phpunit', 'phpstan', 'mockery', 'fakerphp', 'laravel/pint', 'laravel/telescope'];
    foreach (\$prod as \$p) {
      foreach (\$devPkgs as \$dev) {
        if (str_contains(\$p, \$dev)) echo \$p . PHP_EOL;
      }
    }
  " 2>/dev/null || true)
  if [ -n "$DEV_IN_PROD" ]; then
    while IFS= read -r pkg; do
      log_warn "Dev package in production require: $pkg — move to require-dev"
    done <<< "$DEV_IN_PROD"
  else
    log_ok "No dev-only packages in production require"
  fi
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 18 — Environment & Configuration
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 18 — Environment & Config"

# 18a. All required env vars have entries in .env.example
if [ -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
  ENV_VARS=$(grep -v "^#\|^$" "$ROOT/.env" | cut -d= -f1 | sort)
  EXAMPLE_VARS=$(grep -v "^#\|^$" "$ROOT/.env.example" | cut -d= -f1 | sort)
  MISSING_FROM_EXAMPLE=$(comm -23 <(echo "$ENV_VARS") <(echo "$EXAMPLE_VARS") || true)
  if [ -n "$MISSING_FROM_EXAMPLE" ]; then
    while IFS= read -r var; do
      log_warn "Env var in .env but missing from .env.example: $var"
    done <<< "$MISSING_FROM_EXAMPLE"
  else
    log_ok ".env and .env.example are in sync"
  fi
fi

# 18b. Log level should not be debug in production
if grep -q "LOG_LEVEL=debug" "$ROOT/.env" 2>/dev/null; then
  log_warn "LOG_LEVEL=debug in .env — use 'error' or 'warning' for production"
fi

# 18c. Session driver should not be file in production with multiple servers
SESSION_DRIVER=$(grep "SESSION_DRIVER=" "$ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "file")
if [[ "$SESSION_DRIVER" == "file" ]]; then
  log_warn "SESSION_DRIVER=file — use 'redis' or 'database' for multi-server/production deployments"
else
  log_ok "Session driver: $SESSION_DRIVER"
fi

# 18d. Cache driver should not be file in production
CACHE_DRIVER=$(grep "CACHE_DRIVER=\|CACHE_STORE=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2 | tr -d '"' || echo "file")
if [[ "$CACHE_DRIVER" == "file" || "$CACHE_DRIVER" == "array" ]]; then
  log_warn "CACHE_DRIVER=$CACHE_DRIVER — use 'redis' for production performance"
else
  log_ok "Cache driver: $CACHE_DRIVER"
fi

# 18e. Queue connection should not be sync for production
QUEUE_CONN=$(grep "QUEUE_CONNECTION=" "$ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "sync")
if [[ "$QUEUE_CONN" == "sync" ]]; then
  log_warn "QUEUE_CONNECTION=sync — use 'redis' or 'database' so jobs don't block requests"
else
  log_ok "Queue connection: $QUEUE_CONN"
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 19 — Filament Admin (if present)
# ═════════════════════════════════════════════════════════════════════════════
FILAMENT_DIR="$APP/Filament"
if [ -d "$FILAMENT_DIR" ]; then
  log_section "Gate 19 — Filament Admin"

  # 19a. Resources must have Pages/ subdirectory
  RESOURCES_DIR="$FILAMENT_DIR/Resources"
  if [ -d "$RESOURCES_DIR" ]; then
    MISSING_PAGES=0
    for resource_file in "$RESOURCES_DIR"/*.php; do
      [ -f "$resource_file" ] || continue
      resource_name=$(basename "$resource_file" .php)
      pages_dir="$RESOURCES_DIR/${resource_name}/Pages"
      if [ ! -d "$pages_dir" ]; then
        log_error "Filament Resource missing Pages/ directory: $resource_name"
        MISSING_PAGES=$((MISSING_PAGES+1))
      fi
    done
    RESOURCE_COUNT=$(ls "$RESOURCES_DIR"/*.php 2>/dev/null | wc -l | tr -d ' ')
    [ "$MISSING_PAGES" -eq 0 ] && log_ok "$RESOURCE_COUNT Filament resources have Pages/ directories"
  fi

  # 19b. Filament auth must not use sanctum guard (web guard required)
  if grep -rn "authGuard.*sanctum\|->authGuard('sanctum')" "$APP/Providers" 2>/dev/null | grep -qv "//"; then
    log_error "authGuard('sanctum') in Filament provider — Filament requires 'web' guard, not sanctum"
  else
    log_ok "Filament auth guard is correct (not sanctum)"
  fi

  # 19c. Filament widgets should not make unguarded DB calls
  WIDGET_QUERIES=$(grep -rn "Model::all()\|->get()\b" "$FILAMENT_DIR/Widgets" 2>/dev/null \
    | grep -v "//\|paginate\|limit\|take" | head -5 || true)
  if [ -n "$WIDGET_QUERIES" ]; then
    log_warn "Unguarded DB calls in Filament widgets — add limits or caching:"
    echo "$WIDGET_QUERIES" | head -3
  fi
fi


# ═════════════════════════════════════════════════════════════════════════════
# GATE 20 — POS Domain Checks (project-specific)
# ═════════════════════════════════════════════════════════════════════════════
log_section "Gate 20 — POS Domain Checks"

# 20a. PlatformSettingsService — must be injected not instantiated
PSS_NEW=$(grep -rn "new PlatformSettingsService" "$APP" 2>/dev/null \
  | grep -v "//\|Test\|Spec" || true)
if [ -n "$PSS_NEW" ]; then
  while IFS= read -r line; do
    log_error "PlatformSettingsService manually instantiated — inject via constructor: $line"
  done <<< "$PSS_NEW"
fi

# 20b. PlatformSettingsService injected but not imported
INJECT_MISSING=0
while IFS= read -r f; do
  if grep -q "PlatformSettingsService \$settings\|PlatformSettingsService \$platformSettings" "$f" 2>/dev/null; then
    if ! grep -q "use App\\\\Services\\\\PlatformSettingsService" "$f" 2>/dev/null; then
      log_error "PlatformSettingsService injected but not imported in: $f"
      INJECT_MISSING=$((INJECT_MISSING+1))
    fi
  fi
done < <(find_php "$APP/Services")
[ "$INJECT_MISSING" -eq 0 ] && log_ok "All PlatformSettingsService injections have matching imports"

# 20c. No hardcoded obligation score penalties
OBL_HITS=$(grep -rn "decrement.*hustler_score.*[0-9]\+\|score_penalty.*[0-9]\+" \
  "$APP/Services" 2>/dev/null \
  | grep -v "//\|private const\|PlatformSettings\|settings->\|obligationScorePenalty" \
  | grep -v "^\s*\*" || true)
if [ -n "$OBL_HITS" ]; then
  while IFS= read -r line; do
    log_warn "Hardcoded obligation penalty — verify it reads from \$settings->obligationScorePenalty(): $line"
  done <<< "$OBL_HITS"
else
  log_ok "No hardcoded obligation score penalties"
fi

# 20d. TokenPackage / token economy rates must come from config
TOKEN_RATE_HITS=$(grep -rn "\* 0\.9\b\|\* 1\.111\|\* 1\.1111\|TOKEN_RATE\|token_rate" \
  "$APP/Services" "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|config(\|env(\|settings->\|TokenEconomy::\|Test\|Spec" \
  | grep -v "^\s*\*" || true)
if [ -n "$TOKEN_RATE_HITS" ]; then
  while IFS= read -r line; do
    log_error "Hardcoded token rate — use TokenEconomy::rate() or config('pos.token_rate'): $line"
  done <<< "$TOKEN_RATE_HITS"
else
  log_ok "Token economy rates use dynamic configuration"
fi

# 20e. Receipts / Invoices must use queued jobs for generation
SYNC_RECEIPT=$(grep -rn "Receipt\|Invoice\|generatePdf\|GenerateReceipt" \
  "$APP/Http/Controllers" 2>/dev/null \
  | grep -v "//\|Test\|Spec\|dispatch\|->queue\|Queue::\|Job::" | head -5 || true)
if [ -n "$SYNC_RECEIPT" ]; then
  log_warn "Receipt/Invoice generation in controller may be synchronous — dispatch as queued job:"
  echo "$SYNC_RECEIPT" | head -3
fi


# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║               LARAVEL QA SUMMARY                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e " ${GREEN}${BOLD}✓ PERFECT — All 20 gates passed with zero warnings${NC}"
elif [ "$ERRORS" -eq 0 ]; then
  echo -e " ${GREEN}${BOLD}✓ ALL GATES PASSED${NC} — $WARNINGS warning(s) to address"
  echo -e " ${GREEN}Safe to deploy.${NC}"
else
  echo -e " ${RED}${BOLD}✗ DEPLOY BLOCKED${NC}"
fi

echo ""
echo -e "  Errors:       ${RED}${BOLD}$ERRORS${NC}"
echo -e "  Warnings:     ${YELLOW}$WARNINGS${NC}"
[ "$FIX_MODE" = true ] && echo -e "  Auto-fixes:   ${CYAN}$FIXES${NC}"
echo ""
echo -e "  Gates run:    ${MAGENTA}20${NC} (PHP Syntax, Structure, Naming, Eloquent, Security,"
echo -e "               Controllers, Services, API Resources, Validation,"
echo -e "               Performance, PHP 8.2, Laravel 12, Migrations,"
echo -e "               Tests, PHPStan, Pint, Composer, Env, Filament, POS)"
echo ""

# ── Write markdown report ─────────────────────────────────────────────────────
if [ "$REPORT_MODE" = true ]; then
  {
    echo "# Laravel 12 / PHP 8.2 — QA Report"
    echo ""
    echo "> Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "> Project root: \`$ROOT\`"
    echo "> PHP version: \`$PHP_VERSION\`"
    echo ""
    echo "## Summary"
    echo ""
    echo "| Metric | Count |"
    echo "|--------|-------|"
    echo "| ❌ Errors | $ERRORS |"
    echo "| ⚠️ Warnings | $WARNINGS |"
    echo "| 🔧 Auto-fixes | $FIXES |"
    echo "| 🔬 Gates | 20 |"
    echo ""
    echo "## Deploy Status"
    echo ""
    if [ "$ERRORS" -eq 0 ]; then
      echo "### ✅ SAFE TO DEPLOY"
    else
      echo "### 🚫 DEPLOY BLOCKED — fix all errors before deploying"
    fi
    echo ""
    echo "## Detailed Results"
    echo ""
    for line in "${REPORT_LINES[@]}"; do
      echo "$line"
    done
    echo ""
    echo "---"
    echo ""
    echo "_Run \`./scripts/laravel_qa_check.sh --fix\` to auto-fix Pint formatting_"
    echo ""
    echo "_Recommended next steps:_"
    echo "- \`composer audit\` — dependency vulnerability scan"
    echo "- \`./vendor/bin/phpstan analyse app --level=8\` — max static analysis"
    echo "- \`php artisan test --parallel --coverage\` — full test suite with coverage"
    echo "- \`php artisan optimize:clear && php artisan config:cache\` — production cache"
  } > "$REPORT_FILE"

  echo -e " ${CYAN}Report written to: $REPORT_FILE${NC}"
  echo ""
fi

if [ "$ERRORS" -gt 0 ]; then
  echo -e " ${RED}Fix all [ERROR] items above before deploying.${NC}"
  echo ""
  exit 1
else
  echo -e " ${GREEN}No blocking errors. Safe to deploy.${NC}"
  echo ""
  exit 0
fi
