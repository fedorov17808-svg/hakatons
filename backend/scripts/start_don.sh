#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CreditPulse DON — Launch 3 Independent Oracle Nodes
# ═══════════════════════════════════════════════════════════
#
# Usage: ./scripts/start_don.sh
#
# This starts 3 independent FastAPI oracle nodes on ports 8011-8013.
# Each node has its own private key and independently verifies scores.

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║  CreditPulse DON — Starting 3 Oracle Nodes      ║"
echo "╚══════════════════════════════════════════════════╝"

# Check if nodes are already running
for port in 8011 8012 8013; do
  if lsof -i :$port -sTCP:LISTEN > /dev/null 2>&1; then
    echo "⚠️  Port $port already in use. Kill existing process first:"
    echo "   kill \$(lsof -t -i :$port)"
    exit 1
  fi
done

# Generate keys if env files are empty/missing
if [ ! -f .env.node-alpha ] || ! grep -q "^PRIVATE_KEY=" .env.node-alpha 2>/dev/null; then
  echo "🔑 Generating ephemeral node keys..."
  python3 -c "
from eth_account import Account
import secrets
for name, port, region in [('alpha', 8011, 'us-east-1'), ('beta', 8012, 'eu-west-3'), ('gamma', 8013, 'ap-se-1')]:
    pk = '0x' + secrets.token_hex(32)
    acct = Account.from_key(pk)
    with open(f'.env.node-{name}', 'w') as f:
        f.write(f'NODE_NAME=node-{name}\n')
        f.write(f'NODE_REGION={region}\n')
        f.write(f'PRIVATE_KEY={pk}\n')
        f.write(f'PORT={port}\n')
        f.write(f'PRIMARY_DATA_SOURCE={[\"defillama\",\"dexscreener\",\"rpc\"][[\"alpha\",\"beta\",\"gamma\"].index(name)]}\n')
    print(f'  Node {name}: {acct.address} (port {port}, source {[\"defillama\",\"dexscreener\",\"rpc\"][[\"alpha\",\"beta\",\"gamma\"].index(name)]})')
" 2>/dev/null || echo "⚠️  Could not auto-generate keys. Using existing env files."
fi

echo ""
echo "🚀 Launching nodes..."

# Start Node Alpha (port 8011)
ENV_FILE=.env.node-alpha uvicorn nodes.node_server:app \
  --host 0.0.0.0 --port 8011 --log-level warning &
PID_ALPHA=$!
echo "  ✅ Node Alpha (PID $PID_ALPHA) → http://localhost:8011"

# Start Node Beta (port 8012)
ENV_FILE=.env.node-beta uvicorn nodes.node_server:app \
  --host 0.0.0.0 --port 8012 --log-level warning &
PID_BETA=$!
echo "  ✅ Node Beta  (PID $PID_BETA) → http://localhost:8012"

# Start Node Gamma (port 8013)
ENV_FILE=.env.node-gamma uvicorn nodes.node_server:app \
  --host 0.0.0.0 --port 8013 --log-level warning &
PID_GAMMA=$!
echo "  ✅ Node Gamma (PID $PID_GAMMA) → http://localhost:8013"

echo ""
echo "⏳ Waiting for nodes to initialize..."
sleep 3

# Health check
ONLINE=0
for port in 8011 8012 8013; do
  if curl -sf http://localhost:$port/health > /dev/null 2>&1; then
    ONLINE=$((ONLINE + 1))
    echo "  ✅ Port $port: ONLINE"
  else
    echo "  ❌ Port $port: UNREACHABLE"
  fi
done

echo ""
if [ $ONLINE -ge 2 ]; then
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  DON CLUSTER: $ONLINE/3 NODES ONLINE — QUORUM MET  ║"
  echo "╚══════════════════════════════════════════════════╝"
else
  echo "⚠️  Only $ONLINE/3 nodes online. Quorum requires 2."
fi

echo ""
echo "Press Ctrl+C to stop all nodes."
echo "PIDs: $PID_ALPHA $PID_BETA $PID_GAMMA"

# Trap cleanup
trap "echo ''; echo 'Stopping DON nodes...'; kill $PID_ALPHA $PID_BETA $PID_GAMMA 2>/dev/null; echo 'Done.'; exit 0" INT TERM

# Wait for any child to exit
wait
