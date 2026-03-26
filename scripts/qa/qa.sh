#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo " ENTERPRISE QA ENGINE — EDLP POS"
echo "========================================="

ERRORS=0

run_step () {
echo ""
echo "▶ $1"
if ! eval "$2"; then
echo "❌ FAILED: $1"
ERRORS=$((ERRORS+1))
else
echo "✅ PASSED: $1"
fi
}

# 1. Lint + Format

run_step "Lint Check" "npm run lint"

# 2. Type Check (if TS)

run_step "Type Check" "npx tsc --noEmit || true"

# 3. Unit Tests

run_step "Unit Tests" "npm run test:run"

# 4. E2E Tests

run_step "E2E Tests" "npm run test:e2e"

# 5. Architecture Rules

run_step "Architecture Check" "bash scripts/qa/architecture-check.sh"

# 6. Security

run_step "Security Scan" "bash scripts/qa/security-check.sh"

# 7. Performance

run_step "Performance Audit" "bash scripts/qa/performance-check.sh"

# 8. Build Validation

run_step "Production Build" "npm run build"

echo ""
echo "========================================="

if [ "$ERRORS" -gt 0 ]; then
echo "❌ QA FAILED ($ERRORS errors)"
exit 1
else
echo "✅ QA PASSED — READY FOR DEPLOYMENT"
exit 0
fi
