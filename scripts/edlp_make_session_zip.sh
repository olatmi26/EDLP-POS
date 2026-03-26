#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Make Session ZIP for Claude
# scripts/edlp_make_session_zip.sh
#
# Run this BEFORE starting a Claude session on desktop.
# Upload the generated ZIP to Claude.
# =============================================================================

set -euo pipefail

PROJECT_DIR="/mnt/c/mydocs/edlp-pos"
OUTPUT_DIR="$PROJECT_DIR/../edlp_sessions"
TIMESTAMP=$(date +%Y%m%d_%H%M)

mkdir -p "$OUTPUT_DIR"

echo "→ Running EDLP QA check before packaging..."
if ! "$PROJECT_DIR/scripts/edlp_qa_check.sh" "$PROJECT_DIR/app" "$PROJECT_DIR/frontend/src"; then
    echo "❌ QA failed — fix errors before creating ZIP"
    exit 1
fi

ZIP_FILE="$OUTPUT_DIR/edlp_session_${TIMESTAMP}.zip"

echo "→ Packaging EDLP POS project (Laravel + React SPA)..."

cd "$PROJECT_DIR"

zip -r "$ZIP_FILE" \
    app/ \
    database/migrations/ \
    database/seeders/ \
    routes/ \
    config/ \
    frontend/src/ \
    frontend/public/ \
    edlp_CLAUDE.md \
    scripts/ \
    composer.json \
    package.json \
    vite.config.js \
    --exclude "*/vendor/*" \
    --exclude "*/node_modules/*" \
    --exclude "*/.git/*" \
    --exclude "*/storage/logs/*" \
    --exclude "*/storage/framework/*" \
    --exclude "*.env" \
    2>/dev/null

SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo "✅ Session ZIP created: $ZIP_FILE ($SIZE)"

echo ""
echo "=============================================="
echo " NEXT STEP:"
echo " Upload $ZIP_FILE to Claude and start message with:"
echo ""
echo 'Continue EDLP POS. Extract the uploaded session ZIP to /home/claude/project,'
echo 'read edlp_CLAUDE.md first, then [your task].'
echo "=============================================="