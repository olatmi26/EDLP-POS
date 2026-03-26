#!/usr/bin/env bash

ERRORS=0

# ❌ No business logic inside components

BAD_LOGIC=$(grep -rn "fetch|axios" src/components || true)
if [ -n "$BAD_LOGIC" ]; then
echo "[ERROR] API calls inside components — move to services/hooks"
ERRORS=$((ERRORS+1))
fi

# ❌ No direct axios (must use React Query)

AXIOS=$(grep -rn "axios." src | grep -v "services" || true)
if [ -n "$AXIOS" ]; then
echo "[ERROR] Direct axios usage outside service layer"
ERRORS=$((ERRORS+1))
fi

# ❌ Large files

find src -name "*.tsx" -o -name "*.jsx" | while read f; do
LINES=$(wc -l < "$f")
if [ "$LINES" -gt 300 ]; then
echo "[WARN] Large component: $f ($LINES lines)"
fi
done

# ❌ No env usage

ENV=$(grep -rn "http://" src || true)
if [ -n "$ENV" ]; then
echo "[ERROR] Hardcoded URLs detected"
ERRORS=$((ERRORS+1))
fi

exit $ERRORS
