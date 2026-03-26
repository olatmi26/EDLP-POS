#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Sprint Deploy Script
# Usage: ./scripts/deploy.sh <path-to-zip> "<commit message>"
#
# 1. Extracts zip relative to project root
# 2. Copies new files (preserves .env, vendor, node_modules)
# 3. Runs Laravel QA gate
# 4. Runs migrations
# 5. Commits & pushes to origin/main
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ZIP_FILE="${1:-}"
COMMIT_MSG="${2:-"chore: sprint update $(date '+%Y-%m-%d %H:%M')"}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           EDLP POS — Sprint Deploy Runner               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Validate zip ──────────────────────────────────────────────────────────────
if [ -z "$ZIP_FILE" ]; then
  echo -e "${RED}[FATAL]${NC} No zip file specified."
  echo "Usage: ./scripts/deploy.sh ~/Downloads/sprint.zip \"feat: description\""
  exit 1
fi

if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}[FATAL]${NC} Zip file not found: $ZIP_FILE"
  exit 1
fi

echo -e " Project:    ${CYAN}$PROJECT_ROOT${NC}"
echo -e " Zip:        ${CYAN}$ZIP_FILE${NC}"
echo -e " Commit:     ${CYAN}$COMMIT_MSG${NC}"
echo ""

# ── Extract zip to temp dir ───────────────────────────────────────────────────
TEMP_DIR=$(mktemp -d)
echo -e "${BOLD}▶ Extracting zip...${NC}"
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"
echo -e "${GREEN}[OK]${NC} Extracted to $TEMP_DIR"

# ── Copy files into project (rsync, exclude protected paths) ─────────────────
echo -e "${BOLD}▶ Copying files into project...${NC}"
rsync -av \
  --exclude='.env' \
  --exclude='vendor/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='storage/logs/' \
  --exclude='storage/framework/cache/' \
  "$TEMP_DIR/" "$PROJECT_ROOT/" \
  | tail -5

echo -e "${GREEN}[OK]${NC} Files copied"
rm -rf "$TEMP_DIR"

# ── Set permissions ───────────────────────────────────────────────────────────
chmod +x "$PROJECT_ROOT/scripts/"*.sh 2>/dev/null || true

# ── Run Laravel QA gate ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}▶ Running Laravel QA gate...${NC}"
QA_EXIT=0
bash "$SCRIPT_DIR/laravel_qa_check.sh" "$PROJECT_ROOT" || QA_EXIT=$?

if [ "$QA_EXIT" -ne 0 ]; then
  echo -e "${RED}${BOLD}[BLOCKED]${NC} QA gate failed — fix errors before deploying."
  exit 1
fi

# ── Run composer install (if composer.json changed) ───────────────────────────
if [ -f "$PROJECT_ROOT/composer.json" ]; then
  echo -e "${BOLD}▶ Running composer install...${NC}"
  cd "$PROJECT_ROOT" && composer install --no-interaction --prefer-dist --optimize-autoloader 2>&1 | tail -3
  echo -e "${GREEN}[OK]${NC} Composer packages installed"
fi

# ── Run migrations ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}▶ Running migrations...${NC}"
cd "$PROJECT_ROOT"
php artisan migrate --force
echo -e "${GREEN}[OK]${NC} Migrations complete"

# ── Git add, commit, push ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}▶ Committing to git...${NC}"
cd "$PROJECT_ROOT"
git add -A
git commit -m "$COMMIT_MSG"
git push origin main
echo -e "${GREEN}[OK]${NC} Pushed to origin/main"

echo ""
echo -e "${GREEN}${BOLD}✓ DEPLOY COMPLETE${NC}"
echo ""
