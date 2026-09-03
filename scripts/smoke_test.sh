#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CreditPulse AI — Pre-Demo Smoke Test
# Run this before every investor demo to ensure stack is live
# Usage: bash scripts/smoke_test.sh [BASE_URL]
# ═══════════════════════════════════════════════════════════════

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

check() {
  local name="$1"
  local url="$2"
  local expect_key="$3"
  TOTAL=$((TOTAL + 1))

  response=$(curl -s -o /tmp/smoke_body -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)

  if [ "$response" = "200" ]; then
    if [ -n "$expect_key" ]; then
      if grep -q "$expect_key" /tmp/smoke_body 2>/dev/null; then
        echo "  ✅ $name (HTTP $response, key '$expect_key' found)"
        PASS=$((PASS + 1))
      else
        echo "  ⚠️  $name (HTTP $response, but key '$expect_key' NOT found)"
        FAIL=$((FAIL + 1))
      fi
    else
      echo "  ✅ $name (HTTP $response)"
      PASS=$((PASS + 1))
    fi
  else
    echo "  ❌ $name (HTTP $response — EXPECTED 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  CreditPulse AI — Pre-Demo Smoke Test                    ║"
echo "║  Target: $BASE_URL"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "📡 API Endpoints:"
check "Health Check"          "$BASE_URL/api/health"              "status"
check "Stats Dashboard"       "$BASE_URL/api/stats"               "don_nodes"
check "On-Chain Stats"        "$BASE_URL/api/stats/onchain"       "total_reports_onchain"
check "DON Node Status"       "$BASE_URL/api/don/nodes"           "node_id"

echo ""
echo "🔍 Analysis Pipeline:"
check "Analyze (Aave V3)"     "$BASE_URL/api/analyze?address=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" "overall_score"

echo ""
echo "🔗 Creditcoin CC3 RPC:"
cc3_response=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  --connect-timeout 5 --max-time 10 \
  "https://rpc.cc3-testnet.creditcoin.network" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if echo "$cc3_response" | grep -q "result" 2>/dev/null; then
  block_hex=$(echo "$cc3_response" | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  echo "  ✅ CC3 Testnet RPC (block: $block_hex)"
  PASS=$((PASS + 1))
else
  echo "  ❌ CC3 Testnet RPC unreachable"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  🟢 ALL $TOTAL CHECKS PASSED — Ready for demo!"
else
  echo "  🔴 $FAIL/$TOTAL CHECKS FAILED — Fix before demo!"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

exit $FAIL
