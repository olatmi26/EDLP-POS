#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Deploy Script
# scripts/edlp_deploy.sh <path-to-zip> [commit-message]
# =============================================================================

set -euo pipefail

ZIP="${1:-}"
COMMIT_MSG="${2:-"chore: apply EDLP POS changes from Claude"}"
PROJECT="$(pwd)"
BACKUP_DIR="$PROJECT/../edlp_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
    echo "❌ Usage: ./scripts/edlp_deploy.sh <path-to-zip> [commit-message]"
    exit 1
fi

echo "=============================================="
echo " EDLP POS Deploy"
echo "=============================================="
echo " ZIP:    $ZIP"
echo " Commit: $COMMIT_MSG"
echo " Dir:    $PROJECT"
echo "=============================================="

# 1. Backup
echo ""
echo "→ [1/6] Creating backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/edlp_backup_${TIMESTAMP}.tar.gz"
tar -czf "$BACKUP_FILE" \
    -C "$PROJECT" \
    app/ routes/ database/migrations/ config/ frontend/src/ \
    --exclude="*/vendor/*" --exclude="*/node_modules/*" 2>/dev/null
echo "   ✅ Backup: $BACKUP_FILE"

# 2. Extract
echo ""
echo "→ [2/6] Extracting ZIP..."
unzip -o "$ZIP" -d "$PROJECT" > /dev/null
echo "   ✅ Files extracted"

# 3. PHP syntax check
echo ""
echo "→ [3/6] PHP syntax check..."
find "$PROJECT/app" -name "*.php" | while read -r f; do
    php -l "$f" > /dev/null 2>&1 || { echo "❌ Syntax error: $f"; exit 1; }
done
echo "   ✅ All PHP files clean"

# 4. QA Gate
echo ""
echo "→ [4/6] Running QA gate..."
if ! "$PROJECT/scripts/edlp_qa_check.sh" "$PROJECT/app" "$PROJECT/frontend/src"; then
    echo "❌ QA failed — restoring backup"
    tar -xzf "$BACKUP_FILE" -C "$PROJECT"
    exit 1
fi
echo "   ✅ QA passed"

# 5. Migrations (if any)
echo ""
NEW_MIGS=$(find "$PROJECT/database/migrations" -name "*.php" | wc -l)
if [ "$NEW_MIGS" -gt 0 ]; then
    echo "→ [5/6] Running migrations..."
    php "$PROJECT/artisan" migrate --no-interaction --force
    echo "   ✅ Migrations done"
else
    echo "→ [5/6] No new migrations"
fi

# 6. Git commit & push
echo ""
echo "→ [6/6] Git commit & push..."
cd "$PROJECT"
git add -A
if git diff --cached --quiet; then
    echo "   No changes to commit"
else
    git commit -m "$COMMIT_MSG"
    git push origin main
    echo "   ✅ Committed & pushed to GitHub"
fi

echo ""
echo "=============================================="
echo " ✅ EDLP POS DEPLOY COMPLETE!"
echo "=============================================="
