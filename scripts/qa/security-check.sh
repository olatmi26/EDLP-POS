#!/usr/bin/env bash

echo "Running dependency audit..."
npm audit --audit-level=high || echo "[WARN] Vulnerabilities found"

echo "Checking secrets..."

SECRETS=$(grep -rn "apikey|secret|token" src || true)
if [ -n "$SECRETS" ]; then
echo "[WARN] Possible secrets in code"
fi

echo "Checking .env exposure..."

if [ -f ".env" ]; then
echo "[ERROR] .env file present in repo"
exit 1
fi
