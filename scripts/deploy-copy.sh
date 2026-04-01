#!/usr/bin/env bash
# =============================================================================
# EDLP POS — Deploy Pipeline
# scripts/deploy.sh [ZIP_PATH_OR_NAME] [OPTIONS]
#
# Full automation pipeline:
#   1. Locate & extract the zip (from Windows Downloads or given path)
#   2. Detect content type  (laravel | react | fullstack)
#   3. Mount into monorepo  (smart file merge — never blindly overwrites)
#   4. Run QA gates         (laravel_qa_check + react_qa_check)
#   5. Git commit → push    (conventional commit, auto branch, remote sync)
#
# Usage:
#   ./scripts/deploy.sh                                # auto-find latest zip in Downloads
#   ./scripts/deploy.sh sprint3_laravel.zip            # by filename only (searches Downloads)
#   ./scripts/deploy.sh /mnt/c/Users/.../file.zip      # full path
#   ./scripts/deploy.sh sprint3.zip --dry-run          # preview without touching files
#   ./scripts/deploy.sh sprint3.zip --no-qa            # skip QA (dangerous — use rarely)
#   ./scripts/deploy.sh sprint3.zip --no-git           # skip git commit/push
#   ./scripts/deploy.sh sprint3.zip --force            # skip confirmation prompts
#   ./scripts/deploy.sh sprint3.zip --branch feat/xyz  # push to specific branch
#   ./scripts/deploy.sh sprint3.zip --react-only       # mount + QA React only
#   ./scripts/deploy.sh sprint3.zip --laravel-only     # mount + QA Laravel only
#   ./scripts/deploy.sh sprint3.zip --message "feat: add pos receipt module"
#
# Project layout expected:
#   /mnt/c/mydocs/edlp-pos/        ← PROJECT_ROOT (Laravel lives here)
#   /mnt/c/mydocs/edlp-pos/frontend/  ← React lives here
#   /mnt/c/mydocs/edlp-pos/scripts/   ← this script lives here
#
# Windows Downloads folder (auto-searched):
#   /mnt/c/Users/olaiya.hassan/Downloads/
# =============================================================================

set -euo pipefail

# ── Resolve absolute paths ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_ROOT="$PROJECT_ROOT/frontend"
WINDOWS_DOWNLOADS="/mnt/c/Users/olaiya.hassan/Downloads"
WORK_DIR="/tmp/edlp_deploy_$$"
LOG_FILE="$PROJECT_ROOT/deploy.log"
QA_REPORT_DIR="$PROJECT_ROOT/.qa-reports"

# ── Defaults ──────────────────────────────────────────────────────────────────
ZIP_INPUT="${1:-}"
DRY_RUN=false
SKIP_QA=false
SKIP_GIT=false
FORCE=false
REACT_ONLY=false
LARAVEL_ONLY=false
CUSTOM_BRANCH=""
CUSTOM_MESSAGE=""
QA_FIX=false

# ── Parse arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --no-qa)        SKIP_QA=true ;;
    --no-git)       SKIP_GIT=true ;;
    --force)        FORCE=true ;;
    --react-only)   REACT_ONLY=true ;;
    --laravel-only) LARAVEL_ONLY=true ;;
    --qa-fix)       QA_FIX=true ;;
    --branch=*)     CUSTOM_BRANCH="${arg#--branch=}" ;;
    --branch)       ;;
    --message=*)    CUSTOM_MESSAGE="${arg#--message=}" ;;
    --message)      ;;
    --help|-h)
      sed -n '3,30p' "$0" | sed 's/^# *//'
      exit 0
      ;;
  esac
done

# Handle --branch and --message as next-arg style too
PREV=""
for arg in "$@"; do
  case "$PREV" in
    --branch)  CUSTOM_BRANCH="$arg" ;;
    --message) CUSTOM_MESSAGE="$arg" ;;
  esac
  PREV="$arg"
done

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Logging ───────────────────────────────────────────────────────────────────
TS()        { date '+%Y-%m-%d %H:%M:%S'; }
log_raw()   { echo -e "$1" | tee -a "$LOG_FILE"; }
log_step()  { echo -e "\n${BLUE}${BOLD}▶ $1${NC}" | tee -a "$LOG_FILE"; }
log_ok()    { echo -e "  ${GREEN}✓${NC}  $1" | tee -a "$LOG_FILE"; }
log_warn()  { echo -e "  ${YELLOW}!${NC}  $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "  ${RED}✗${NC}  $1" | tee -a "$LOG_FILE"; }
log_info()  { echo -e "  ${DIM}·${NC}  $1" | tee -a "$LOG_FILE"; }
log_dry()   { echo -e "  ${MAGENTA}[DRY]${NC} $1" | tee -a "$LOG_FILE"; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  [ -d "$WORK_DIR" ] && rm -rf "$WORK_DIR"
  if [ "$exit_code" -ne 0 ]; then
    log_error "Pipeline aborted (exit $exit_code). Check $LOG_FILE for details."
  fi
}
trap cleanup EXIT

# ── Header ────────────────────────────────────────────────────────────────────
mkdir -p "$QA_REPORT_DIR"
echo "" >> "$LOG_FILE"
echo "════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "$(TS)  DEPLOY START" >> "$LOG_FILE"
echo "════════════════════════════════════════════════════════" >> "$LOG_FILE"

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        EDLP POS — Deploy Pipeline v1.0                ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════╝${NC}"
echo -e "  Project:   ${CYAN}$PROJECT_ROOT${NC}"
echo -e "  Frontend:  ${CYAN}$FRONTEND_ROOT${NC}"
echo -e "  Log:       ${CYAN}$LOG_FILE${NC}"
[ "$DRY_RUN" = true ]  && echo -e "  ${MAGENTA}${BOLD}DRY RUN — no files will be written${NC}"
[ "$SKIP_QA" = true ]  && echo -e "  ${YELLOW}⚠  QA gates disabled (--no-qa)${NC}"
[ "$SKIP_GIT" = true ] && echo -e "  ${YELLOW}⚠  Git push disabled (--no-git)${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — Locate the ZIP
# ─────────────────────────────────────────────────────────────────────────────
log_step "Phase 1 — Locating ZIP file"

ZIP_PATH=""

# If no argument given — find the newest .zip in Downloads
if [ -z "$ZIP_INPUT" ]; then
  log_info "No zip specified — scanning $WINDOWS_DOWNLOADS for latest..."
  ZIP_PATH=$(find "$WINDOWS_DOWNLOADS" -maxdepth 1 -name "*.zip" -newer "$WINDOWS_DOWNLOADS" \
    2>/dev/null | xargs ls -t 2>/dev/null | head -1 || true)

  # Fallback: just newest zip
  if [ -z "$ZIP_PATH" ]; then
    ZIP_PATH=$(ls -t "$WINDOWS_DOWNLOADS"/*.zip 2>/dev/null | head -1 || true)
  fi

  if [ -z "$ZIP_PATH" ]; then
    log_error "No .zip files found in $WINDOWS_DOWNLOADS"
    log_info "Usage: ./scripts/deploy.sh my_sprint.zip"
    exit 1
  fi
  log_ok "Auto-selected: $(basename "$ZIP_PATH") (newest in Downloads)"

elif [[ "$ZIP_INPUT" == *.zip && "$ZIP_INPUT" != /* && "$ZIP_INPUT" != ./* ]]; then
  # Filename only — search Downloads
  ZIP_PATH="$WINDOWS_DOWNLOADS/$ZIP_INPUT"
  if [ ! -f "$ZIP_PATH" ]; then
    # Also search QAChecks folder mentioned in your Downloads
    ZIP_PATH=$(find "$WINDOWS_DOWNLOADS" -maxdepth 2 -name "$ZIP_INPUT" 2>/dev/null | head -1 || true)
  fi
  if [ -z "$ZIP_PATH" ] || [ ! -f "$ZIP_PATH" ]; then
    log_error "ZIP not found: $ZIP_INPUT"
    log_info "Searched in: $WINDOWS_DOWNLOADS"
    exit 1
  fi
  log_ok "Found: $ZIP_PATH"

else
  # Full path given
  ZIP_PATH="$ZIP_INPUT"
  if [ ! -f "$ZIP_PATH" ]; then
    log_error "ZIP file not found: $ZIP_PATH"
    exit 1
  fi
  log_ok "Using: $ZIP_PATH"
fi

ZIP_NAME=$(basename "$ZIP_PATH" .zip)
ZIP_SIZE=$(du -sh "$ZIP_PATH" 2>/dev/null | cut -f1)
log_info "File: ${ZIP_NAME}.zip  (${ZIP_SIZE})"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Extract
# ─────────────────────────────────────────────────────────────────────────────
log_step "Phase 2 — Extracting ZIP"

mkdir -p "$WORK_DIR"

if command -v unzip &>/dev/null; then
  unzip -q "$ZIP_PATH" -d "$WORK_DIR" 2>/dev/null || {
    log_error "unzip failed — trying python fallback..."
    python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" \
      "$ZIP_PATH" "$WORK_DIR"
  }
else
  log_warn "unzip not installed — using python3..."
  python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" \
    "$ZIP_PATH" "$WORK_DIR" || {
    log_error "Extraction failed. Install unzip: sudo apt install unzip -y"
    exit 1
  }
fi

# Flatten if zip extracted into a single sub-folder
EXTRACT_ROOT="$WORK_DIR"
SUBDIRS=$(find "$WORK_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
ROOTFILES=$(find "$WORK_DIR" -maxdepth 1 -mindepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')

if [ "$SUBDIRS" -eq 1 ] && [ "$ROOTFILES" -eq 0 ]; then
  ONLY_DIR=$(find "$WORK_DIR" -maxdepth 1 -mindepth 1 -type d | head -1)
  EXTRACT_ROOT="$ONLY_DIR"
  log_info "Flattened: content is inside $(basename "$ONLY_DIR")/"
fi

FILE_COUNT=$(find "$EXTRACT_ROOT" -type f | wc -l | tr -d ' ')
log_ok "Extracted $FILE_COUNT files to $EXTRACT_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — Detect content type
# ─────────────────────────────────────────────────────────────────────────────
log_step "Phase 3 — Detecting content type"

HAS_LARAVEL=false
HAS_REACT=false
MOUNT_TYPE=""

# Laravel signals
if [ -f "$EXTRACT_ROOT/artisan" ] || \
   [ -d "$EXTRACT_ROOT/app/Http" ] || \
   [ -d "$EXTRACT_ROOT/app/Models" ] || \
   [ -f "$EXTRACT_ROOT/composer.json" ]; then
  HAS_LARAVEL=true
fi

# React signals
if [ -f "$EXTRACT_ROOT/package.json" ] || \
   [ -d "$EXTRACT_ROOT/src" ] || \
   [ -f "$EXTRACT_ROOT/vite.config.ts" ] || \
   [ -f "$EXTRACT_ROOT/vite.config.js" ]; then
  HAS_REACT=true
fi

# Also check if it's a frontend/ subfolder inside the zip
if [ -d "$EXTRACT_ROOT/frontend" ] && [ -f "$EXTRACT_ROOT/artisan" ]; then
  HAS_LARAVEL=true
  HAS_REACT=true
fi

# Flag overrides
[ "$LARAVEL_ONLY" = true ] && HAS_REACT=false
[ "$REACT_ONLY" = true ]   && HAS_LARAVEL=false

if [ "$HAS_LARAVEL" = true ] && [ "$HAS_REACT" = true ]; then
  MOUNT_TYPE="fullstack"
  log_ok "Detected: FULLSTACK (Laravel + React)"
elif [ "$HAS_LARAVEL" = true ]; then
  MOUNT_TYPE="laravel"
  log_ok "Detected: LARAVEL backend only"
elif [ "$HAS_REACT" = true ]; then
  MOUNT_TYPE="react"
  log_ok "Detected: REACT frontend only"
else
  log_warn "Could not auto-detect content type."
  echo ""
  echo -e "  What does this zip contain?"
  echo -e "  ${CYAN}1${NC}) Laravel / PHP backend"
  echo -e "  ${CYAN}2${NC}) React frontend"
  echo -e "  ${CYAN}3${NC}) Both (fullstack)"
  echo -e "  ${CYAN}4${NC}) Abort"
  read -rp "  Choice [1-4]: " choice
  case "$choice" in
    1) MOUNT_TYPE="laravel"; HAS_LARAVEL=true ;;
    2) MOUNT_TYPE="react";   HAS_REACT=true ;;
    3) MOUNT_TYPE="fullstack"; HAS_LARAVEL=true; HAS_REACT=true ;;
    *) log_error "Aborted."; exit 1 ;;
  esac
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — Preview & Confirm
# ─────────────────────────────────────────────────────────────────────────────
log_step "Phase 4 — Merge Preview"

# Show what will be copied where
show_preview() {
  local SRC="$1"
  local DEST="$2"
  local LABEL="$3"
  local new_files=0
  local update_files=0
  local ignored_files=0

  while IFS= read -r f; do
    local rel="${f#$SRC/}"
    local dest_file="$DEST/$rel"

    # Skip junk
    if [[ "$rel" == .git/* || "$rel" == node_modules/* || \
          "$rel" == vendor/* || "$rel" == .env || \
          "$rel" == storage/logs/* || "$rel" == bootstrap/cache/* ]]; then
      ignored_files=$((ignored_files+1))
      continue
    fi

    if [ -f "$dest_file" ]; then
      update_files=$((update_files+1))
    else
      new_files=$((new_files+1))
    fi
  done < <(find "$SRC" -type f 2>/dev/null)

  echo -e "  ${BOLD}$LABEL${NC}"
  echo -e "    src  → ${CYAN}$SRC${NC}"
  echo -e "    dest → ${CYAN}$DEST${NC}"
  echo -e "    ${GREEN}+${NC} $new_files new files"
  echo -e "    ${YELLOW}~${NC} $update_files files to update"
  echo -e "    ${DIM}⊘${NC} $ignored_files protected/ignored"
}

if [ "$HAS_LARAVEL" = true ]; then
  # Laravel source: could be root of zip, or a backend/ subfolder
  LARAVEL_SRC="$EXTRACT_ROOT"
  [ -d "$EXTRACT_ROOT/backend" ] && LARAVEL_SRC="$EXTRACT_ROOT/backend"
  show_preview "$LARAVEL_SRC" "$PROJECT_ROOT" "Laravel backend"
fi

if [ "$HAS_REACT" = true ]; then
  # React source: src/ folder, or frontend/ subfolder, or root if it has package.json
  REACT_SRC="$EXTRACT_ROOT"
  [ -d "$EXTRACT_ROOT/frontend" ] && REACT_SRC="$EXTRACT_ROOT/frontend"
  [ -d "$EXTRACT_ROOT/src" ]      && REACT_SRC="$EXTRACT_ROOT"
  show_preview "$REACT_SRC" "$FRONTEND_ROOT" "React frontend"
fi

echo ""

# Confirm prompt (skip if --force or --dry-run)
if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
  read -rp "  Proceed with merge? [y/N]: " confirm
  case "$confirm" in
    [yY][eE][sS]|[yY]) ;;
    *) log_warn "Aborted by user."; exit 0 ;;
  esac
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5 — Smart File Merge
# ─────────────────────────────────────────────────────────────────────────────
log_step "Phase 5 — Merging files into project"

# Files that must NEVER be overwritten from a zip
PROTECTED_FILES=(
  ".env"
  ".env.local"
  ".env.production"
  "storage/logs"
  "bootstrap/cache"
  "node_modules"
  "vendor"
  ".git"
  "composer.lock"     # only overwrite if explicitly new
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
  "bun.lockb"
)

is_protected() {
  local rel_path="$1"
  for p in "${PROTECTED_FILES[@]}"; do
    if [[ "$rel_path" == "$p" || "$rel_path" == "$p/"* ]]; then
      return 0
    fi
  done
  return 1
}

merge_into() {
  local SRC="$1"
  local DEST="$2"
  local LABEL="$3"
  local copied=0
  local skipped=0
  local protected=0

  log_info "Merging $LABEL..."

  while IFS= read -r f; do
    local rel="${f#$SRC/}"

    # Skip .git always
    [[ "$rel" == .git/* || "$rel" == .git ]] && continue

    # Check protected list
    if is_protected "$rel"; then
      log_info "  PROTECTED: $rel"
      protected=$((protected+1))
      continue
    fi

    local dest_file="$DEST/$rel"
    local dest_dir
    dest_dir=$(dirname "$dest_file")

    if [ "$DRY_RUN" = true ]; then
      log_dry "  would copy: $rel → $dest_file"
      copied=$((copied+1))
      continue
    fi

    mkdir -p "$dest_dir"
    cp "$f" "$dest_file"
    copied=$((copied+1))

  done < <(find "$SRC" -type f 2>/dev/null | sort)

  log_ok "$LABEL: $copied files merged, $protected protected files skipped"
}

# ── Merge Laravel ─────────────────────────────────────────────────────────────
if [ "$HAS_LARAVEL" = true ]; then
  LARAVEL_SRC="$EXTRACT_ROOT"
  [ -d "$EXTRACT_ROOT/backend" ] && LARAVEL_SRC="$EXTRACT_ROOT/backend"
  merge_into "$LARAVEL_SRC" "$PROJECT_ROOT" "Laravel"

  
  

  # Run artisan migrate if migrations changed
  if [ "$DRY_RUN" = false ] && [ -f "$PROJECT_ROOT/artisan" ]; then
    NEW_MIGRATIONS=$(find "$LARAVEL_SRC/database/migrations" -name "*.php" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NEW_MIGRATIONS" -gt 0 ]; then
      log_info "$NEW_MIGRATIONS migration file(s) found — checking status..."
      if php "$PROJECT_ROOT/artisan" migrate:status 2>/dev/null | grep -q "Pending"; then
        read -rp "  Pending migrations found. Run php artisan migrate? [y/N]: " run_migrate
        case "$run_migrate" in
          [yY]*) php "$PROJECT_ROOT/artisan" migrate --force && log_ok "Migrations applied" ;;
          *)     log_warn "Migrations skipped — run: php artisan migrate" ;;
        esac
      else
        log_info "No pending migrations"
      fi
    fi
  fi
fi

# ── Merge React ───────────────────────────────────────────────────────────────
if [ "$HAS_REACT" = true ]; then
  REACT_SRC="$EXTRACT_ROOT"
  [ -d "$EXTRACT_ROOT/frontend" ] && REACT_SRC="$EXTRACT_ROOT/frontend"

  merge_into "$REACT_SRC" "$FRONTEND_ROOT" "React"

  # Auto-install npm dependencies if package.json changed
  if [ "$DRY_RUN" = false ] && [ -f "$FRONTEND_ROOT/package.json" ]; then
    PKG_MANAGER="npm"
    [ -f "$FRONTEND_ROOT/pnpm-lock.yaml" ] && PKG_MANAGER="pnpm"
    [ -f "$FRONTEND_ROOT/yarn.lock" ]      && PKG_MANAGER="yarn"
    [ -f "$FRONTEND_ROOT/bun.lockb" ]      && PKG_MANAGER="bun"

    if command -v "$PKG_MANAGER" &>/dev/null; then
      log_info "Running $PKG_MANAGER install..."
      (cd "$FRONTEND_ROOT" && $PKG_MANAGER install --silent 2>/dev/null) && \
        log_ok "$PKG_MANAGER install complete" || \
        log_warn "$PKG_MANAGER install had warnings — check manually"
    else
      log_warn "$PKG_MANAGER not found — run install manually"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 6 — QA Gates
# ─────────────────────────────────────────────────────────────────────────────
if [ "$SKIP_QA" = true ]; then
  log_warn "Phase 6 — QA skipped (--no-qa flag set)"
  QA_PASSED=true
else
  log_step "Phase 6 — Running QA Gates"

  QA_PASSED=true
  QA_FLAGS="--report"
  [ "$QA_FIX" = true ] && QA_FLAGS="$QA_FLAGS --fix"
  QA_LARAVEL_EXIT=0
  QA_REACT_EXIT=0

  # ── Laravel QA ──────────────────────────────────────────────────────────────
  if [ "$HAS_LARAVEL" = true ]; then
    LARAVEL_QA="$SCRIPT_DIR/laravel_qa_check.sh"
    if [ -f "$LARAVEL_QA" ]; then
      log_info "Running Laravel QA..."
      bash "$LARAVEL_QA" "$PROJECT_ROOT" $QA_FLAGS 2>&1 | tee -a "$LOG_FILE" | \
        grep -E "ERROR|WARN|OK|PASS|BLOCK|SUMMARY|━━━" || true
      QA_LARAVEL_EXIT=${PIPESTATUS[0]}
      # Copy report to .qa-reports
      [ -f "$PROJECT_ROOT/laravel-qa-report.md" ] && \
        cp "$PROJECT_ROOT/laravel-qa-report.md" \
           "$QA_REPORT_DIR/laravel-qa-$(date +%Y%m%d-%H%M%S).md"
    else
      log_warn "laravel_qa_check.sh not found at $LARAVEL_QA — skipping Laravel QA"
    fi
  fi

  # ── React QA ─────────────────────────────────────────────────────────────────
  if [ "$HAS_REACT" = true ]; then
    REACT_QA="$SCRIPT_DIR/react_qa_check.sh"
    if [ -f "$REACT_QA" ]; then
      log_info "Running React QA..."
      bash "$REACT_QA" "$FRONTEND_ROOT/src" $QA_FLAGS 2>&1 | tee -a "$LOG_FILE" | \
        grep -E "ERROR|WARN|OK|PASS|BLOCK|SUMMARY|━━━" || true
      QA_REACT_EXIT=${PIPESTATUS[0]}
      # Copy report
      [ -f "$FRONTEND_ROOT/qa-report.md" ] && \
        cp "$FRONTEND_ROOT/qa-report.md" \
           "$QA_REPORT_DIR/react-qa-$(date +%Y%m%d-%H%M%S).md"
    else
      log_warn "react_qa_check.sh not found at $REACT_QA — skipping React QA"
    fi
  fi

  # ── Evaluate QA results ───────────────────────────────────────────────────────
  if [ "$QA_LARAVEL_EXIT" -ne 0 ] || [ "$QA_REACT_EXIT" -ne 0 ]; then
    QA_PASSED=false
    echo ""
    echo -e "  ${RED}${BOLD}QA GATES FAILED${NC}"
    [ "$QA_LARAVEL_EXIT" -ne 0 ] && echo -e "  ${RED}✗${NC} Laravel QA: BLOCKED"
    [ "$QA_REACT_EXIT" -ne 0 ]   && echo -e "  ${RED}✗${NC} React QA:   BLOCKED"
    echo ""

    if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
      echo -e "  ${YELLOW}QA errors found. Options:${NC}"
      echo -e "  ${CYAN}1${NC}) Continue anyway (commit despite errors)"
      echo -e "  ${CYAN}2${NC}) Run QA with --fix and retry"
      echo -e "  ${CYAN}3${NC}) Abort — do not commit"
      read -rp "  Choice [1-3]: " qa_choice
      case "$qa_choice" in
        1)
          log_warn "Proceeding despite QA errors (user override)"
          QA_PASSED=true
          ;;
        2)
          log_info "Re-running QA with --fix..."
          [ "$HAS_LARAVEL" = true ] && bash "$LARAVEL_QA" "$PROJECT_ROOT" --fix --report 2>/dev/null || true
          [ "$HAS_REACT" = true ]   && bash "$REACT_QA" "$FRONTEND_ROOT/src" --fix --report 2>/dev/null || true
          QA_PASSED=true
          log_ok "QA --fix applied — review changes before next deploy"
          ;;
        *)
          log_error "Deploy aborted due to QA failures."
          log_info "Fix the errors above, then re-run: ./scripts/deploy.sh $ZIP_NAME.zip"
          exit 1
          ;;
      esac
    else
      [ "$FORCE" = true ] && log_warn "Continuing despite QA failures (--force)"
    fi
  else
    log_ok "All QA gates passed"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 7 — Git: Stage → Commit → Push
# ─────────────────────────────────────────────────────────────────────────────
if [ "$SKIP_GIT" = true ]; then
  log_warn "Phase 7 — Git skipped (--no-git flag set)"
elif [ "$DRY_RUN" = true ]; then
  log_step "Phase 7 — Git (dry run — no commits)"
  log_dry "Would run: git add -A"
  log_dry "Would run: git commit -m '...'"
  log_dry "Would run: git push"
else
  log_step "Phase 7 — Git commit & push"

  cd "$PROJECT_ROOT"

  # ── Ensure we're in a git repo ──────────────────────────────────────────────
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_warn "Not a git repository. Initializing..."
    git init
    git remote add origin "$(cat .git-remote-url 2>/dev/null || echo '')" 2>/dev/null || true
  fi

  # ── Detect current branch ──────────────────────────────────────────────────
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
  TARGET_BRANCH="${CUSTOM_BRANCH:-$CURRENT_BRANCH}"

  # Auto-create branch if it doesn't exist and differs from current
  if [ "$TARGET_BRANCH" != "$CURRENT_BRANCH" ]; then
    if git show-ref --quiet "refs/heads/$TARGET_BRANCH" 2>/dev/null; then
      git checkout "$TARGET_BRANCH"
      log_ok "Switched to branch: $TARGET_BRANCH"
    else
      git checkout -b "$TARGET_BRANCH"
      log_ok "Created and switched to new branch: $TARGET_BRANCH"
    fi
  fi

  # ── Stage all changes ──────────────────────────────────────────────────────
  git add -A
  STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

  if [ "$STAGED" -eq 0 ]; then
    log_warn "Nothing to commit — all files already match the repository."
    log_info "This usually means the zip contained no changes vs what's already committed."
    exit 0
  fi

  log_info "$STAGED file(s) staged for commit"

  # ── Build conventional commit message ────────────────────────────────────────
  if [ -n "$CUSTOM_MESSAGE" ]; then
    COMMIT_MSG="$CUSTOM_MESSAGE"
  else
    # Auto-infer commit type from zip name / content
    COMMIT_TYPE="chore"
    COMMIT_SCOPE=""
    COMMIT_DESC=""

    # Infer type from zip name patterns
    if [[ "$ZIP_NAME" =~ sprint([0-9]+) ]]; then
      SPRINT_NUM="${BASH_REMATCH[1]}"
      COMMIT_SCOPE="sprint${SPRINT_NUM}"
    fi

    if [[ "$ZIP_NAME" =~ feat|feature ]]; then    COMMIT_TYPE="feat"
    elif [[ "$ZIP_NAME" =~ fix|bugfix|hotfix ]];  then COMMIT_TYPE="fix"
    elif [[ "$ZIP_NAME" =~ refactor ]];            then COMMIT_TYPE="refactor"
    elif [[ "$ZIP_NAME" =~ test ]];                then COMMIT_TYPE="test"
    elif [[ "$ZIP_NAME" =~ docs ]];                then COMMIT_TYPE="docs"
    elif [[ "$ZIP_NAME" =~ migration|db ]];        then COMMIT_TYPE="feat"
    fi

    # Build description from zip name
    COMMIT_DESC=$(echo "$ZIP_NAME" \
      | sed 's/_/ /g; s/-/ /g' \
      | sed 's/edlp pos //i; s/edlp-pos-//i' \
      | sed 's/laravel//i; s/react//i; s/frontend//i; s/backend//i' \
      | sed 's/  / /g' \
      | sed 's/^ *//; s/ *$//' \
      | tr '[:upper:]' '[:lower:]')

    # Add type context
    case "$MOUNT_TYPE" in
      laravel)    COMMIT_DESC="$COMMIT_DESC (laravel)" ;;
      react)      COMMIT_DESC="$COMMIT_DESC (react)" ;;
      fullstack)  COMMIT_DESC="$COMMIT_DESC (fullstack)" ;;
    esac

    # Build final message
    if [ -n "$COMMIT_SCOPE" ]; then
      COMMIT_MSG="${COMMIT_TYPE}(${COMMIT_SCOPE}): ${COMMIT_DESC}"
    else
      COMMIT_MSG="${COMMIT_TYPE}: ${COMMIT_DESC}"
    fi

    # Add QA status footer
    QA_FOOTER=""
    if [ "$SKIP_QA" = false ]; then
      if [ "$QA_PASSED" = true ]; then
        QA_FOOTER="qa: all gates passed"
      else
        QA_FOOTER="qa: deployed with errors (review .qa-reports/)"
      fi
    fi

    if [ -n "$QA_FOOTER" ]; then
      COMMIT_MSG="$(printf "%s\n\n%s\ndeployed-from: %s\ndeployed-at: %s" \
        "$COMMIT_MSG" "$QA_FOOTER" "$(basename "$ZIP_PATH")" "$(TS)")"
    fi
  fi

  log_info "Commit message:"
  echo "$COMMIT_MSG" | while IFS= read -r line; do
    echo -e "    ${DIM}$line${NC}"
  done
  echo ""

  # ── Confirm commit ──────────────────────────────────────────────────────────
  if [ "$FORCE" = false ]; then
    read -rp "  Commit and push? [y/N]: " git_confirm
    case "$git_confirm" in
      [yY]*) ;;
      *) log_warn "Git commit skipped by user."; exit 0 ;;
    esac
  fi

  # ── Commit ──────────────────────────────────────────────────────────────────
  git commit -m "$COMMIT_MSG"
  COMMIT_HASH=$(git rev-parse --short HEAD)
  log_ok "Committed: $COMMIT_HASH"

  # ── Push ────────────────────────────────────────────────────────────────────
  REMOTE=$(git remote 2>/dev/null | head -1 || echo "")

  if [ -z "$REMOTE" ]; then
    log_warn "No git remote configured."
    log_info "Add one with: git remote add origin https://github.com/your-org/edlp-pos.git"
    log_info "Then push with: git push -u origin $TARGET_BRANCH"
  else
    log_info "Pushing to $REMOTE/$TARGET_BRANCH..."

    # Set upstream if new branch
    if git push "$REMOTE" "$TARGET_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
      log_ok "Pushed to $REMOTE/$TARGET_BRANCH"
    else
      # If upstream not set, set it
      log_info "Setting upstream and retrying..."
      git push --set-upstream "$REMOTE" "$TARGET_BRANCH" 2>&1 | tee -a "$LOG_FILE" && \
        log_ok "Pushed with upstream set: $REMOTE/$TARGET_BRANCH" || \
        log_error "Push failed — check your git remote and credentials"
    fi

    # ── Sync: pull remote changes (rebase to keep history clean) ──────────────
    log_info "Syncing: pulling remote changes..."
    git fetch "$REMOTE" 2>/dev/null || true
    BEHIND=$(git rev-list HEAD...$REMOTE/$TARGET_BRANCH --count 2>/dev/null || echo 0)
    if [ "$BEHIND" -gt 0 ]; then
      log_info "$BEHIND remote commit(s) ahead — rebasing..."
      git pull --rebase "$REMOTE" "$TARGET_BRANCH" 2>&1 | tee -a "$LOG_FILE" && \
        log_ok "Rebase sync complete" || \
        log_warn "Rebase had conflicts — resolve and run: git rebase --continue"
    else
      log_ok "Branch is up to date with $REMOTE/$TARGET_BRANCH"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 8 — Final Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                  DEPLOY SUMMARY                       ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ZIP:       ${CYAN}$(basename "$ZIP_PATH")${NC}"
echo -e "  Type:      ${CYAN}$MOUNT_TYPE${NC}"
echo -e "  QA:        $([ "$SKIP_QA" = true ] && echo "${YELLOW}skipped${NC}" || ([ "$QA_PASSED" = true ] && echo "${GREEN}passed${NC}" || echo "${RED}errors found${NC}"))"
echo -e "  Git:       $([ "$SKIP_GIT" = true ] && echo "${YELLOW}skipped${NC}" || [ "$DRY_RUN" = true ] && echo "${MAGENTA}dry run${NC}" || echo "${GREEN}pushed → $TARGET_BRANCH${NC}")"
echo -e "  QA logs:   ${CYAN}$QA_REPORT_DIR${NC}"
echo -e "  Full log:  ${CYAN}$LOG_FILE${NC}"
echo ""

if [ "$DRY_RUN" = false ] && [ "$QA_PASSED" = true ] && [ "$SKIP_QA" = false ]; then
  echo -e "  ${GREEN}${BOLD}✓ DEPLOY COMPLETE${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "  ${MAGENTA}${BOLD}DRY RUN COMPLETE — no files changed${NC}"
else
  echo -e "  ${YELLOW}${BOLD}DEPLOY COMPLETE WITH WARNINGS — review QA reports${NC}"
fi

echo ""
echo "$(TS)  DEPLOY END — $ZIP_NAME" >> "$LOG_FILE"
echo "════════════════════════════════════════════════════════" >> "$LOG_FILE"
