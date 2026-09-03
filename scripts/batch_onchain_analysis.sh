#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# batch_onchain_analysis.sh — Run 15 real protocol analyses
# to create on-chain traction visible on Blockscout
# ══════════════════════════════════════════════════════════════
#
# USAGE:
#   1. Start the frontend:  cd frontend && npm run dev
#   2. Run this script:     bash scripts/batch_onchain_analysis.sh
#
# Each analysis hits /api/analyze → gets scored → records on-chain
# via /api/record. Result: 15+ transactions on Blockscout.
# ══════════════════════════════════════════════════════════════

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"

# 15 real protocol / whale addresses for analysis
declare -a TARGETS=(
  # DeFi Protocols
  "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"   # Aave V2 Lending Pool
  "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"   # Aave V3 Pool
  "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"   # Compound cDAI
  "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"   # Compound Comptroller
  "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497"   # sUSDe (Ethena)
  # RWA Issuers
  "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92"   # Ondo OUSG
  "0x96F6eF951840721AdBF46Ac996b59E0235CB985C"   # USDY
  "0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C"   # Mountain USDM
  # Stablecoins & DAOs
  "0x6B175474E89094C44Da98b954EedeAC495271d0F"   # DAI Token
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"   # USDC
  "0xdAC17F958D2ee523a2206206994597C13D831ec7"   # USDT
  # Bridges & Infrastructure
  "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"   # Coinbase cbETH
  "0xae78736Cd615f374D3085123A210448E74Fc6393"   # Rocket Pool rETH
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"   # Lido wstETH
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"   # WETH
)

declare -a NAMES=(
  "Aave V2 Lending Pool"
  "Aave V3 Pool"
  "Compound cDAI"
  "Compound Comptroller"
  "Ethena sUSDe"
  "Ondo OUSG"
  "Ondo USDY"
  "Mountain USDM"
  "MakerDAO DAI"
  "Circle USDC"
  "Tether USDT"
  "Coinbase cbETH"
  "Rocket Pool rETH"
  "Lido wstETH"
  "Wrapped ETH"
)

echo "═══════════════════════════════════════════════════════"
echo "  ⚡ CreditPulse Batch On-Chain Analysis"
echo "  Target: ${#TARGETS[@]} protocols → Blockscout traction"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check server is running
if ! curl -s "${API_BASE}/api/health" > /dev/null 2>&1; then
  echo "❌ Server not running at ${API_BASE}"
  echo "   Start it first: cd frontend && npm run dev"
  exit 1
fi
echo "✅ Server is running at ${API_BASE}"
echo ""

SUCCESS=0
FAILED=0

for i in "${!TARGETS[@]}"; do
  addr="${TARGETS[$i]}"
  name="${NAMES[$i]}"
  echo -n "[$((i+1))/${#TARGETS[@]}] Analyzing ${name} (${addr:0:8}...)... "

  # Step 1: Analyze
  RESULT=$(curl -s -X POST "${API_BASE}/api/analyze" \
    -H "Content-Type: application/json" \
    -d "{\"address\": \"${addr}\"}" \
    --max-time 30 2>/dev/null)

  SCORE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('overall',d.get('score','?')))" 2>/dev/null || echo "?")

  if [ "$SCORE" = "?" ]; then
    echo "❌ Analysis failed"
    FAILED=$((FAILED+1))
    continue
  fi

  echo -n "Score: ${SCORE}/100 → "

  # Step 2: Record on-chain (if analyze succeeded)
  RECORD=$(curl -s -X POST "${API_BASE}/api/record" \
    -H "Content-Type: application/json" \
    -d "$RESULT" \
    --max-time 30 2>/dev/null)

  TX_HASH=$(echo "$RECORD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tx_hash',d.get('txHash','')))" 2>/dev/null || echo "")

  if [ -n "$TX_HASH" ] && [ "$TX_HASH" != "" ]; then
    echo "✅ tx: ${TX_HASH:0:16}..."
    SUCCESS=$((SUCCESS+1))
  else
    echo "⚠️  Scored but record failed (may need wallet connected)"
    SUCCESS=$((SUCCESS+1))  # Analysis still succeeded
  fi

  # Rate limit protection
  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📊 Results: ${SUCCESS} scored, ${FAILED} failed"
echo "  🔗 Verify: https://creditcoin-testnet.blockscout.com/address/0x358925c5839a36bB2181786B8763Da0653B0f438"
echo "═══════════════════════════════════════════════════════"
