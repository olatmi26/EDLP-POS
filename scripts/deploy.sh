#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Deploy Script
# scripts/deploy.sh <path-to-claude-zip> [commit-message] [--flags]
#
# What it does:
#   1. Backs up current project state (tar.gz)
#   2. Extracts Claude's output ZIP into the project
#   3. PHP syntax-checks all changed .php files
#   4. Runs EDLP QA gate
#   5. Runs migrations if any new migration files exist
#   6. Git commits and pushes to GitHub
#
# Usage (in WSL from project root):
#   cd ~/edlp-pos
#   ./scripts/deploy.sh ~/Downloads/edlp_some_feature.zip
#   ./scripts/deploy.sh ~/Downloads/edlp_some_feature.zip "feat: auth system"
#
# Flags:
#   --no-migrate    Skip migration step
#   --no-push       Skip git push
#   --no-backup     Skip backup (faster, use when disk space is tight)
#   --frontend      Also run npm install in frontend/ after extract
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Parse args ────────────────────────────────────────────────────────────────
ZIP=""
COMMIT_MSG=""
RUN_MIGRATE=true
RUN_PUSH=true
RUN_BACKUP=true
RUN_FRONTEND=false

for arg in "$@"; do
    case "$arg" in
        --no-migrate) RUN_MIGRATE=false ;;
        --no-push)    RUN_PUSH=false ;;
        --no-backup)  RUN_BACKUP=false ;;
        --frontend)   RUN_FRONTEND=true ;;
        *.zip)        ZIP="$arg" ;;
        *)            [ -z "$COMMIT_MSG" ] && COMMIT_MSG="$arg" ;;
    esac
done

if [ -z "$ZIP" ]; then
    echo -e "${RED}❌ Usage: ./scripts/deploy.sh <path-to-zip> [commit-message] [--flags]${NC}"
    echo ""
    echo "   Examples:"
    echo "   ./scripts/deploy.sh ~/Downloads/edlp_migrations.zip"
    echo "   ./scripts/deploy.sh ~/Downloads/edlp_auth.zip \"feat: auth system\""
    echo "   ./scripts/deploy.sh ~/Downloads/edlp_frontend.zip \"feat: react setup\" --frontend --no-migrate"
    echo ""
    echo "   Flags:"
    echo "   --no-migrate   Skip php artisan migrate"
    echo "   --no-push      Skip git push"
    echo "   --no-backup    Skip backup archive"
    echo "   --frontend     Run npm install in frontend/ after extract"
    exit 1
fi

if [ ! -f "$ZIP" ]; then
    echo -e "${RED}❌ ZIP not found: $ZIP${NC}"
    exit 1
fi

PROJECT="$(pwd)"
BACKUP_DIR="$PROJECT/../edlp_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Validate we are in the right project directory
if [ ! -f "$PROJECT/artisan" ]; then
    echo -e "${RED}❌ Not in Laravel project root. artisan not found in: $PROJECT${NC}"
    echo "   cd ~/edlp-pos first"
    exit 1
fi

# Auto-generate commit message from ZIP filename if not provided
if [ -z "$COMMIT_MSG" ]; then
    ZIP_BASE=$(basename "$ZIP" .zip)
    COMMIT_MSG="chore: apply ${ZIP_BASE} from Claude"
fi

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  EDLP POS — Deploy${NC}"
echo -e "${CYAN}================================================${NC}"
echo -e "  ZIP:    ${YELLOW}$ZIP${NC}"
echo -e "  Commit: ${YELLOW}$COMMIT_MSG${NC}"
echo -e "  Dir:    $PROJECT"
echo -e "${CYAN}================================================${NC}"

# ── Step 1: Backup ────────────────────────────────────────────────────────────
if $RUN_BACKUP; then
    echo ""
    echo -e "${BLUE}→ [1/6] Backing up current state...${NC}"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.tar.gz"
    tar -czf "$BACKUP_FILE" \
        -C "$PROJECT" \
        app/ routes/ database/migrations/ config/ bootstrap/ \
        --exclude="*/vendor/*" \
        --exclude="*/node_modules/*" \
        2>/dev/null || true
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "   ${GREEN}✅ Backup: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
    echo "   (Restore with: tar -xzf $BACKUP_FILE -C $PROJECT)"
else
    echo -e "${BLUE}→ [1/6] Backup skipped (--no-backup)${NC}"
    BACKUP_FILE=""
fi

# ── Step 2: Extract ZIP ───────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}→ [2/6] Extracting ZIP...${NC}"
FILE_COUNT=$(unzip -Z1 "$ZIP" | wc -l | tr -d ' ')
unzip -o "$ZIP" -d "$PROJECT" > /dev/null
echo -e "   ${GREEN}✅ $FILE_COUNT files extracted${NC}"

echo "   Changed files:"
unzip -Z1 "$ZIP" | grep -E "\.(php|js|jsx|ts|tsx|json|css|blade\.php|sh|md|env\.example)$" | while read -r f; do
    echo "     + $f"
done

# ── Step 3: PHP syntax check ──────────────────────────────────────────────────
echo ""
echo -e "${BLUE}→ [3/6] PHP syntax check...${NC}"
PHP_ERRORS=0
PHP_FILES=$(unzip -Z1 "$ZIP" | grep "\.php$" || true)

if [ -n "$PHP_FILES" ]; then
    while IFS= read -r f; do
        full_path="$PROJECT/$f"
        if [ -f "$full_path" ]; then
            if ! php -l "$full_path" > /dev/null 2>&1; then
                echo -e "   ${RED}❌ Syntax error: $f${NC}"
                php -l "$full_path" 2>&1 | tail -1
                PHP_ERRORS=$((PHP_ERRORS+1))
            fi
        fi
    done <<< "$PHP_FILES"
fi

if [ "$PHP_ERRORS" -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ PHP syntax errors found. Restoring backup...${NC}"
    if $RUN_BACKUP && [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        tar -xzf "$BACKUP_FILE" -C "$PROJECT"
        echo -e "   ${GREEN}✅ Backup restored${NC}"
    fi
    exit 1
fi

PHP_CHECK_COUNT=$(echo "$PHP_FILES" | grep -c "\.php$" || echo 0)
echo -e "   ${GREEN}✅ $PHP_CHECK_COUNT PHP files pass syntax check${NC}"

# ── Step 4: QA Gate ──────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}→ [4/6] Running QA gate...${NC}"

if [ -f "$PROJECT/scripts/qa_check.sh" ]; then
    chmod +x "$PROJECT/scripts/qa_check.sh"
    if ! "$PROJECT/scripts/qa_check.sh" "$PROJECT/app"; then
        echo ""
        echo -e "${RED}❌ QA gate failed. Restoring backup...${NC}"
        if $RUN_BACKUP && [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
            tar -xzf "$BACKUP_FILE" -C "$PROJECT"
            echo -e "   ${GREEN}✅ Backup restored${NC}"
        fi
        exit 1
    fi
else
    echo -e "   ${YELLOW}⚠️  qa_check.sh not found — skipping QA gate${NC}"
    echo "   (Expected at: $PROJECT/scripts/qa_check.sh)"
fi

# ── Step 4b: npm install (if --frontend flag and frontend dir exists) ──────────
if $RUN_FRONTEND && [ -d "$PROJECT/frontend" ]; then
    echo ""
    echo -e "${BLUE}→ [4b] Installing frontend dependencies...${NC}"
    cd "$PROJECT/frontend"
    npm install --silent
    echo -e "   ${GREEN}✅ npm install complete${NC}"
    cd "$PROJECT"
fi

# ── Step 5: Migrations ────────────────────────────────────────────────────────
echo ""
if $RUN_MIGRATE; then
    NEW_MIGRATIONS=$(unzip -Z1 "$ZIP" | grep "database/migrations/" | wc -l | tr -d ' ')
    if [ "$NEW_MIGRATIONS" -gt 0 ]; then
        echo -e "${BLUE}→ [5/6] Running $NEW_MIGRATIONS new migration(s)...${NC}"
        php "$PROJECT/artisan" migrate --no-interaction --force
        echo -e "   ${GREEN}✅ Migrations complete${NC}"
    else
        echo -e "${BLUE}→ [5/6] No new migrations in ZIP — skipping${NC}"
    fi
else
    echo -e "${BLUE}→ [5/6] Migrations skipped (--no-migrate)${NC}"
fi

# ── Step 6: Git commit + push ─────────────────────────────────────────────────
echo ""
echo -e "${BLUE}→ [6/6] Git commit...${NC}"
cd "$PROJECT"
git add -A
git status --short | head -30

if git diff --cached --quiet; then
    echo -e "   ${YELLOW}ℹ️  Nothing to commit (files unchanged)${NC}"
else
    git commit -m "$COMMIT_MSG"
    echo -e "   ${GREEN}✅ Committed: $COMMIT_MSG${NC}"

    if $RUN_PUSH; then
        echo "   → Pushing to GitHub..."
        git push origin "$(git branch --show-current)"
        echo -e "   ${GREEN}✅ Pushed to GitHub — https://github.com/olatmi26/EDLP-POS${NC}"
    else
        echo -e "   ${YELLOW}ℹ️  Push skipped (--no-push). Run: git push origin $(git branch --show-current)${NC}"
    fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ Deploy complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "  ZIP:     $ZIP"
echo "  Commit:  $COMMIT_MSG"
echo "  Branch:  $(git branch --show-current)"
[ -n "$BACKUP_FILE" ] && echo "  Backup:  $BACKUP_FILE"
echo ""
echo "  Next steps:"
echo "    php artisan serve          — start Laravel API"
echo "    cd frontend && npm run dev — start React dev server"
echo "    http://localhost:5173      — React frontend"
echo "    http://localhost:8000/api  — Laravel API"
echo -e "${GREEN}================================================${NC}"
