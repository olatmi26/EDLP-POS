#!/usr/bin/env bash

echo "Analyzing bundle size..."

npm run build > /dev/null 2>&1

SIZE=$(du -sh dist | cut -f1)

echo "Bundle size: $SIZE"

# Fail if too large (adjust)

LIMIT_MB=5
ACTUAL_MB=$(du -sm dist | cut -f1)

if [ "$ACTUAL_MB" -gt "$LIMIT_MB" ]; then
echo "[WARN] Bundle too large (>5MB)"
fi

echo "Checking lazy loading..."

LAZY=$(grep -rn "React.lazy" src || true)

if [ -z "$LAZY" ]; then
echo "[WARN] No lazy loading detected"
fi
