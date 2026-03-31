#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Fullstack QA Runner
# scripts/qa.sh [--fix] [--report] [--react-only] [--laravel-only]
#
# Orchestrates both React and Laravel QA gates for monorepo or
# adjacent frontend/backend project layouts.
#
# Supported layouts:
#   monorepo/
#   ├── frontend/          ← React (src/ inside)
#   ├── backend/           ← Laravel (app/ inside)
#   └── scripts/qa.sh      ← this file
#
#   OR flat layout:
#   project/
#   ├── src/               ← React source
#   ├── app/               ← Laravel app/
#   └── scripts/qa.sh
#
# Usage:
#   ./scripts/qa.sh                    # runs both
#   ./scripts/qa.sh --react-only       # React QA only
#   ./scripts/qa.sh --laravel-only     # Laravel QA only
#   ./scripts/qa.sh --fix              # auto-fix where possible
#   ./scripts/qa.sh --report           # generate both reports
#   ./scripts/qa.sh --fix --report     # fix + report
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

FIX_FLAG=""
REPORT_FLAG=""
RUN_REACT=true
RUN_LARAVEL=true

for arg in "$@"; do
  case "$arg" in
    --fix)          FIX_FLAG="--fix" ;;
    --report)       REPORT_FLAG="--report" ;;
    --react-only)   RUN_LARAVEL=false ;;
    --laravel-only) RUN_REACT=false ;;
  esac
done

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REACT_EXIT=0
LARAVEL_EXIT=0

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           EDLP POS — Fullstack QA Runner                ║${NC}"
echo -e "${BOLD}║           React 19 + Laravel 12 / PHP 8.2               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e " Root: ${CYAN}$ROOT${NC}"
echo -e " Running: $([ "$RUN_REACT" = true ] && echo "${GREEN}React${NC}" || echo "${YELLOW}React (skipped)${NC}") + $([ "$RUN_LARAVEL" = true ] && echo "${GREEN}Laravel${NC}" || echo "${YELLOW}Laravel (skipped)${NC}")"
echo -e " Fix mode:  $([ -n "$FIX_FLAG" ] && echo "${GREEN}ON${NC}" || echo "OFF")"
echo -e " Report:    $([ -n "$REPORT_FLAG" ] && echo "${GREEN}ON${NC}" || echo "OFF")"
echo ""

# ── Locate React source ───────────────────────────────────────────────────────
find_react_src() {
  local candidates=("$ROOT/frontend/src" "$ROOT/src" "$ROOT/client/src" "$ROOT/web/src")
  for c in "${candidates[@]}"; do
    [ -d "$c" ] && echo "$c" && return
  done
  echo ""
}

# ── Locate Laravel root ───────────────────────────────────────────────────────
find_laravel_root() {
  local candidates=("$ROOT/backend" "$ROOT" "$ROOT/api" "$ROOT/server")
  for c in "${candidates[@]}"; do
    [ -f "$c/artisan" ] && echo "$c" && return
  done
  echo ""
}

# ── Run React QA ──────────────────────────────────────────────────────────────
if [ "$RUN_REACT" = true ]; then
  REACT_SRC=$(find_react_src)
  REACT_SCRIPT="$SCRIPT_DIR/react_qa_check.sh"

  if [ ! -f "$REACT_SCRIPT" ]; then
    echo -e "${YELLOW}[SKIP]${NC} React QA script not found at: $REACT_SCRIPT"
    RUN_REACT=false
  elif [ -z "$REACT_SRC" ]; then
    echo -e "${YELLOW}[SKIP]${NC} React src/ directory not found — checked: frontend/src, src/, client/src"
    RUN_REACT=false
  else
    echo -e "${BOLD}▶ Running React QA Gate...${NC}"
    bash "$REACT_SCRIPT" "$REACT_SRC" $FIX_FLAG $REPORT_FLAG || REACT_EXIT=$?
  fi
fi

# ── Run Laravel QA ────────────────────────────────────────────────────────────
if [ "$RUN_LARAVEL" = true ]; then
  LARAVEL_ROOT=$(find_laravel_root)
  LARAVEL_SCRIPT="$SCRIPT_DIR/laravel_qa_check.sh"

  if [ ! -f "$LARAVEL_SCRIPT" ]; then
    echo -e "${YELLOW}[SKIP]${NC} Laravel QA script not found at: $LARAVEL_SCRIPT"
    RUN_LARAVEL=false
  elif [ -z "$LARAVEL_ROOT" ]; then
    echo -e "${YELLOW}[SKIP]${NC} Laravel artisan not found — checked: backend/, root, api/, server/"
    RUN_LARAVEL=false
  else
    echo -e "${BOLD}▶ Running Laravel QA Gate...${NC}"
    bash "$LARAVEL_SCRIPT" "$LARAVEL_ROOT" $FIX_FLAG $REPORT_FLAG || LARAVEL_EXIT=$?
  fi
fi

# ── Combined summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              FULLSTACK QA FINAL SUMMARY                 ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_EXIT=$((REACT_EXIT + LARAVEL_EXIT))

if [ "$TOTAL_EXIT" -eq 0 ]; then
  echo -e " ${GREEN}${BOLD}✓ ALL SYSTEMS CLEAR — Safe to deploy${NC}"
else
  echo -e " ${RED}${BOLD}✗ DEPLOY BLOCKED${NC}"
  [ "$REACT_EXIT" -ne 0 ]   && echo -e "   ${RED}✗ React QA:   FAILED${NC}"
  [ "$LARAVEL_EXIT" -ne 0 ] && echo -e "   ${RED}✗ Laravel QA: FAILED${NC}"
  [ "$REACT_EXIT" -eq 0 ] && [ "$RUN_REACT" = true ]     && echo -e "   ${GREEN}✓ React QA:   passed${NC}"
  [ "$LARAVEL_EXIT" -eq 0 ] && [ "$RUN_LARAVEL" = true ] && echo -e "   ${GREEN}✓ Laravel QA: passed${NC}"
fi

echo ""
exit $TOTAL_EXIT
