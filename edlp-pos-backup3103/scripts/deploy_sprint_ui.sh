#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Sprint UI/Fixes Deployment Script
# Deploys: ProductController fix, RolePermissionController, ProductResource,
#          api.php update, ProductsPage v2, UsersPage v3
#
# Usage (from WSL):
#   ./scripts/deploy_sprint_ui.sh ~/Downloads/edlp_sprint_ui.zip "feat: products stock levels + IAM redesign"
# =============================================================================
set -euo pipefail

ZIP_FILE="${1:-}"
COMMIT_MSG="${2:-feat: products stock fix + IAM redesign}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

[ -z "$ZIP_FILE" ] && error "Usage: $0 <path-to-zip> [commit-message]"
[ ! -f "$ZIP_FILE" ] && error "ZIP not found: $ZIP_FILE"

info "Project root: $PROJECT_DIR"
info "Applying from: $ZIP_FILE"

# ── Unpack to temp ────────────────────────────────────────────────────────────
TMPDIR=$(mktemp -d)
unzip -q "$ZIP_FILE" -d "$TMPDIR"
info "Unpacked to $TMPDIR"

# ── Copy backend files ────────────────────────────────────────────────────────
COPY() {
  SRC="$TMPDIR/$1"; DST="$PROJECT_DIR/$1"
  if [ -f "$SRC" ]; then
    mkdir -p "$(dirname "$DST")"
    cp "$SRC" "$DST"
    success "Copied: $1"
  else
    warn "Not found in zip: $1 (skipping)"
  fi
}

COPY "app/Http/Controllers/ProductController.php"
COPY "app/Http/Controllers/RolePermissionController.php"
COPY "app/Http/Resources/ProductResource.php"
COPY "routes/api.php"
COPY "frontend/src/ui/pages/ProductsPage.jsx"
COPY "frontend/src/ui/pages/UsersPage.jsx"

# ── Clear Laravel caches ──────────────────────────────────────────────────────
info "Clearing Laravel caches..."
cd "$PROJECT_DIR"
php artisan config:clear   2>/dev/null || warn "config:clear failed"
php artisan route:clear    2>/dev/null || warn "route:clear failed"
php artisan cache:clear    2>/dev/null || warn "cache:clear failed"
success "Caches cleared"

# ── Git commit ────────────────────────────────────────────────────────────────
info "Staging and committing..."
git add app/Http/Controllers/ProductController.php \
        app/Http/Controllers/RolePermissionController.php \
        app/Http/Resources/ProductResource.php \
        routes/api.php \
        frontend/src/ui/pages/ProductsPage.jsx \
        frontend/src/ui/pages/UsersPage.jsx 2>/dev/null || warn "git add had issues"

git commit -m "$COMMIT_MSG" 2>/dev/null || warn "Nothing to commit (already up-to-date)"
success "Committed: $COMMIT_MSG"

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$TMPDIR"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Deployment complete!                                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Backend fixes:                                      ║${NC}"
echo -e "${GREEN}║    • ProductController — inventory eager-loaded      ║${NC}"
echo -e "${GREEN}║    • ProductResource  — branch_stocks + totals       ║${NC}"
echo -e "${GREEN}║    • RolePermissionController — new (roles API)      ║${NC}"
echo -e "${GREEN}║    • api.php — /roles & /permissions routes added    ║${NC}"
echo -e "${GREEN}║  Frontend upgrades:                                  ║${NC}"
echo -e "${GREEN}║    • ProductsPage v2 — tabs + stock bars + skeleton  ║${NC}"
echo -e "${GREEN}║    • UsersPage v3   — Users + Roles + Permissions    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Run: cd frontend && npm run dev"
echo "  Then visit: http://localhost:5173/products"
echo "              http://localhost:5173/users"
