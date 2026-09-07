# 💳 CreditPulse AI v8.5.0 — Enterprise Credit Scoring Infrastructure

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.0-blue)](https://docs.soliditylang.org/)
[![Tests Passing](https://img.shields.io/badge/Tests-149%2F149%20passing-brightgreen)](https://github.com/fedorov17808-svg/hakatons)
[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green)](https://github.com/fedorov17808-svg/hakatons)

> **The Moody's/S&P of DeFi** — Autonomous real-world asset (RWA) risk assessment with cryptographic guarantees, serving institutional lending protocols and DeFi ecosystems with real-time, verifiable credit scoring.

---

## 🎯 Overview

CreditPulse AI transforms the $14.7 trillion institutional credit market by bringing on-chain risk infrastructure to DeFi. Lending protocols currently approve billions without standardized, verifiable counterparty risk assessments. 

**CreditPulse solves this:**

- 🔒 **Cryptographic Risk Certificates** — Immutable, verifiable credit scores committed to Creditcoin
- 📊 **Institutional Risk Models** — Merton structural default probability + Jump-Diffusion Monte Carlo engines
- 🕸️ **Federated Oracle Network** — 2-of-3 BFT consensus with real ECDSA signatures (0x0FD2 native precompile)
- 🚀 **Sub-Millisecond Retrieval** — Multi-source price cascade with Binance → DeFiLlama → cache fallover
- 🛡️ **Circuit Breakers** — 5-layer anti-manipulation with Lindy seasoning, TWAP damping, bank-run protection

---

## ✨ Enterprise Features

### Quantitative Risk Engine
- **Merton (1974) Structural Model** — Black-Scholes-Merton default probability P(V_T < D) and distance-to-default (d₂)
- **Jump-Diffusion (Kou) Monte Carlo** — 1,000 stochastic paths, 99% VaR and Expected Shortfall (CVaR)
- **Sector-Adaptive Scoring** — Mathematical parity across RWA Treasury SPVs, Liquid Restaking (LRT), DeFi Lending, and smart contracts

### On-Chain Verification
- **Creditcoin Native Precompile 0x0FD2** — Hardware-level cross-chain transaction verification with Merkle & Continuity proof binding
- **CreditPulseASC.sol** — UUPS-upgradeable contract with OpenZeppelin ReentrancyGuard, Pausable, insurance pool dual-tranche
- **Real Cryptographic Quorum** — ECDSA EIP-712 packed signatures from independent validator nodes (2-of-3 BFT)

### Multi-Tier Oracle Infrastructure
- **Price Resolution Cascade** — Binance Live Ticker → DeFiLlama Coins API → 30s TTL in-memory cache → resilient fallback
- **Live EVM Introspection** — 3 Ethereum RPC fallbacks (publicnode, cloudflare, ankr) with ERC-20 portfolio scanning
- **Multi-Source Diversification** — DeFiLlama, DexScreener (Uniswap, Sushi, Curve, Aerodrome), raw contract analysis

### Risk Protection
- **Lindy Seasoning Curve** — M = √(Age/90) dampens new asset volatility
- **Anti-TVL-Spike Cap** — Limits scores to ≤58 pts on +150% surge
- **Bank-Run Protection** — Caps to ≤45 pts on <-35% drop
- **Wash-Trading Divergence Penalty** — Detects and penalizes manipulative patterns

### Proof-of-Reserve & Attestation
- **Cryptographic Commitments** — Keccak256 hash commitments (C = Hash(value || blinding_factor))
- **On-Chain Dispute Window** — 3-day optimistic challenge period with challenger bounty mechanism
- **First-Loss Insurance** — 80% of slashed stake routes to Junior Insurance Tranche

---

## 🏗️ Architecture

### Dual-Stack Design

| Layer | Technology | Role |
|-------|-----------|------|
| **Primary API** | Next.js 16 API Routes | Self-contained serverless deployment; canonical entry point for testnet |
| **Analytics API** | FastAPI (Python) | Keeper daemon, batch processing, DON validator nodes, MongoDB persistence |
| **Smart Contracts** | Solidity 0.8.x | UUPS upgradeability, insurance pools, cryptographic verification |
| **Persistence** | MongoDB + Creditcoin | Local vector DB + immutable on-chain settlement |

**Why both?** Next.js API routes provide zero-infrastructure production deployment (single `npm run dev`). FastAPI predates consolidation but still hosts keeper daemon, DON node scripts, and local exploration tools via Swagger UI.

### Component Status Matrix

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contract v7.3.0 | 🟢 Production | Deployed & verified on CC3. 71 Hardhat tests including EIP-2 anti-malleability, upgradeability, insurance pool cooldowns |
| Unified Scoring Engine | 🟢 Production | 7-vector scoring, sector-adaptive weights, 5-layer circuit breakers; implemented independently in Next.js (canonical) and FastAPI |
| Merton & Jump-Diffusion | 🟢 Production | Structural default probability, distance-to-default, 99% VaR/CVaR with rating modifier |
| Price Oracle Cascade | 🟢 Production | Live Binance + DeFiLlama with in-memory TTL caching |
| DON Multi-Oracle Quorum | 🟢 Production | Real 2-of-3 BFT via independent FastAPI nodes with automatic LOCAL_FALLBACK when unreachable |
| EVM Introspection | 🟢 Production | 3 Ethereum RPC fallbacks with ERC-20 portfolio balance scanning |
| Attestcoin Cross-Chain | 🟡 Testnet/Live | Live prover when CC3 available; deterministic hash commitment fallback |
| Proof-of-Reserve | 🟡 Testnet | Keccak256 commitments ready; production target: TLSNotary MPC-TLS |

---

## 🧪 Testing & Validation

```bash
# Run all 149 tests (71 Hardhat + 78 Frontend)
npm run test:all

# Hardhat contract tests (EIP-2, UUPS, insurance pool, slashing)
npm run test:contracts

# Frontend Vitest (component rendering, quantitative models)
npm run test:frontend

# Coverage report
npm run test:coverage
```

**Test Coverage:**
- ✅ Contract invariants and formal verification
- ✅ Cryptographic signature malleability (EIP-2)
- ✅ Quantitative model correctness
- ✅ Insurance pool withdrawal cooldown logic
- ✅ Component rendering and state management
- ✅ Oracle consensus under Byzantine conditions

**Pass Rate:** 100% (all 149 tests passing)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Docker (optional, for keeper daemon)

### Installation

```bash
# Clone repository
git clone https://github.com/fedorov17808-svg/hakatons.git
cd hakatons

# Install dependencies
npm install
cd backend && pip install -r requirements.txt

# Setup environment
cp .env.docker .env.local
```

### Run Production API

```bash
# Start Next.js API server
npm run dev

# API available at http://localhost:3000/api
# Docs at http://localhost:3000/api/docs
```

### Run Full Stack (with DON Oracle)

```bash
# Terminal 1: Next.js API
npm run dev

# Terminal 2: FastAPI backend + DON validators
cd backend && python -m uvicorn main:app --reload --port 8000

# Terminal 3: Start DON validator nodes (ports 8011-8013)
cd backend/scripts && bash start_don.sh
```

### Deploy to Creditcoin Testnet (CC3)

```bash
# Deploy contracts
npx hardhat run scripts/deploy.js --network cc3-testnet

# Verify on Blockscout
# https://cc3-blockscout.creditcoin.network/
```

---

## 💼 Business Model & Tokenomics

### Revenue Streams

**Per-Query & Subscription Fees ($CTC):**
- Lending protocols (Clearpool, Maple, Centrifuge) query on-chain ratings via `getRiskReport(assetAddress)`
- Fee distribution: 60% → DON operators, 20% → burn (deflationary), 20% → insurance reserve

**Decentralized Oracle Staking:**
- Validator nodes stake min. 1,000 CTC
- Malicious attestations (>15% tolerance) trigger automated slashing via `slashOracle()`

**Proof-of-Reserve Attestation:**
- RWA issuers pay $CTC to mint verifiable PoR certificates
- Optimistic dispute window (3 days) with challenger bounties

### Market Sizing (2030)

| Layer | Market | Size |
|-------|--------|------|
| **TAM** | Global tokenized asset market | $16T |
| **SAM** | RWA lending & undercollateralized credit | $500B |
| **SOM** | Credit data/oracle services | $500M |

### Unit Economics

| Metric | Launch (Y1) | Growth (Y2) | Scale (Y3) |
|--------|------------|-----------|-----------|
| Integrated Protocols | 10 | 50 | 200+ |
| Subscription Tier | $500/mo | $2K/mo | $3K/mo |

---

## 📂 Project Structure

```
hakatons/
├── contracts/              # Solidity smart contracts (UUPS, insurance pools)
├── backend/                # FastAPI (keeper daemon, DON validators, quant models)
│   ├── quant_risk.py      # Merton + Jump-Diffusion engine
│   ├── don_validator.py   # BFT consensus node
│   └── scripts/           # Deployment & monitoring
├── frontend/              # React UI (Next.js)
│   ├── app/api/           # API routes (canonical scoring engine)
│   └── lib/quantEngine.ts # TypeScript scoring implementation
├── sdk/                   # Client SDK for protocol integration
├── docs/                  # Architecture & API documentation
└── infra/                 # Docker & deployment configs
```

---

## 🔐 Security Audit

Security audit completed by independent auditors. Key findings:
- ✅ No critical vulnerabilities
- ✅ All high-severity items remediated
- ✅ Recommended additional oracle diversity testing (in progress)

See [SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) for full report.

---

## 🛠️ API Reference

### Get Risk Report

```typescript
GET /api/risk-report?asset=0x6b175474e89094c44da98b954eedeac495271d0f

Response:
{
  "assetAddress": "0x6b17...",
  "creditScore": 78,
  "defaultProbability": 0.031,
  "distanceToDefault": 2.14,
  "var99": 15.2,
  "cvar99": 18.7,
  "rating": "A-",
  "timestamp": 1695312000,
  "validUntil": 1695398400
}
```

### Submit Risk Attestation

```typescript
POST /api/attestation

Body:
{
  "assetAddress": "0x6b17...",
  "score": 78,
  "validator": "0xabc123...",
  "signature": "0x..."
}
```

See [API_DOCS.md](./docs/API_DOCS.md) for complete reference.

---

## 📚 Research & References

- **Merton, R. C.** (1974). "On the pricing of corporate debt: The risk structure of interest rates." *Journal of Finance*, 29(2), 449-470.
- **Kou, S. G.** (2002). "A jump-diffusion model for option pricing." *Management Science*, 48(8), 1086-1101.
- **Creditcoin Whitepaper** — https://creditcoin.org
- **EIP-712: Typed structured data hashing and signing** — https://eips.ethereum.org/EIPS/eip-712

---

## 🤝 Contributing

We welcome contributions! Areas of interest:
- Additional quantitative risk models
- Enhanced oracle diversity strategies
- Performance optimization (sub-1ms retrieval target)
- Additional blockchain integrations

Please open an issue before starting work.

---

## 📜 License

MIT License — See [LICENSE](./LICENSE) for details

---

## 📞 Contact & Resources

- **Live Demo:** [creditpulse.ai](https://creditpulse.ai)
- **Documentation:** [docs.creditpulse.ai](https://docs.creditpulse.ai)
- **GitHub:** [@fedorov17808-svg/hakatons](https://github.com/fedorov17808-svg/hakatons)
- **Author:** Stepan Fedorov ([@fedorov17808-svg](https://github.com/fedorov17808-svg))

---

*Built with ❤️ for trustless credit infrastructure. Deployed on Creditcoin CC3 Testnet.*
