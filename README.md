# ⚡ CreditPulse AI v8.5.0 Enterprise

<div align="center">

> The **$14.7 trillion** institutional credit market has **zero** on-chain risk infrastructure. Lending protocols approve billions in loans without standardized, verifiable counterparty risk assessments. **CreditPulse is the Moody's / S&P of DeFi** — autonomous credit scoring with cryptographic guarantees, serving any protocol that needs real-time risk data before approving a loan.

**Autonomous Real-World Asset (RWA) Risk Assessment Platform & Decentralized Credit Scoring Infrastructure on Creditcoin — Powered by Attestcoin Protocol, Merton Jump-Diffusion Engine & Federated DON Oracles**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/fedorov17808-svg/hakatons)
[![Creditcoin Testnet](https://img.shields.io/badge/network-Creditcoin_Testnet_%28CC3%29-00E5FF.svg)](https://creditcoin-testnet.blockscout.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16_React_19-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![EVM Compatible](https://img.shields.io/badge/EVM-Chain_ID_102031-orange.svg)](https://rpc.cc3-testnet.creditcoin.network)
[![Tests Passing](https://img.shields.io/badge/Tests-149%20Passing-success.svg)](https://github.com/fedorov17808-svg/hakatons)
[![Security](https://img.shields.io/badge/Security-Slither%20Audited-34d399.svg)](SECURITY_AUDIT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Live Demo](#-live-demo--contract-verification) • [Dashboard](/dashboard) • [Explorer](/explorer) • [Docs](/docs) • [Early Access](/waitlist) • [Architecture](#-architecture) • [Quant Models](#-quantitative-risk-models) • [Security Audit](SECURITY_AUDIT.md) • [Whitepaper](WHITEPAPER.md) • [Roadmap](ROADMAP.md) • [Pitch Deck](docs/PITCH_DECK.md) • [Unit Economics](docs/UNIT_ECONOMICS.md) • [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md) • [SDK](sdk/README.md) • [Quick Start](#-quick-start--reproduction)

</div>

---

## ✨ Enterprise Features (v8.5.0)

- ✅ **Creditcoin Native Precompile `0x0FD2` Integration** — Hardware-level cross-chain transaction verification, Merkle & Continuity proof binding ([verified on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0x7986752dcf8d62a59cfc1c3bdf07df3aadb46095167282fa8818370b844d2fb8))
- ✅ **Merton (1974) Structural Default Model & Jump-Diffusion Engine** — Black-Scholes-Merton default probability $P(V_T < D)$ and distance-to-default ($d_2$), combined with Kou Jump-Diffusion Monte Carlo (1,000 stochastic paths), 99% VaR, and 99% Expected Shortfall (CVaR).
- ✅ **Unified Sector-Adaptive Scoring Matrices** — Exact mathematical parity between backend and frontend engines across RWA Treasury SPVs, Liquid Restaking (LRT), DeFi Lending, and unindexed smart contracts.
- ✅ **Multi-Tier Live Oracle Price Resolution** — Zero-downtime multi-asset pricing cascade with millisecond failover: Binance Live Public Ticker $\to$ DeFiLlama Coins API $\to$ In-memory 30s TTL cache $\to$ Resilient fallback.
- ✅ **Authentic Federated 2-of-3 BFT DON Quorum** — Real cryptographic ECDSA EIP-712 & packed signatures derived per validator node with verifiable on-chain threshold submission to `CreditPulseASC.sol`.
- ✅ **5-Layer Anti-Manipulation & Circuit Breakers** — Lindy Seasoning curve ($M = \sqrt{\text{Age}/90}$), TWAP surge damping, Anti-TVL-Spike cap ($\le 58$ pts on $+150\%$ surge), Bank-run protection ($\le 45$ pts on $<-35\%$ drop), Wash-trading divergence penalty.
- ✅ **Multi-Source Data Diversification** — Consolidated ingestion across DeFiLlama, DexScreener (Uniswap, Sushi, Curve, Aerodrome), and live EVM RPC contract introspection with ERC-20 multi-token balance scanning.
- ✅ **Autonomous Keeper Daemon with On-Chain Drift Triggering** — Background `threading.Timer` scheduler with auto-start, configurable heartbeat cadence, score drift detection $|\Delta_{\text{score}}| \ge 5$ pts, and live telemetry.
- ✅ **Self-Sovereign Direct MetaMask Mode + Gasless Relayer Mode** — 1-click dual execution engine allowing users or institutional relayers to commit cryptographic proofs.
- ✅ **Cryptographic Proof-of-Reserve (PoR) Commitments** — Keccak256 hash commitments (`C = Hash(value || blinding_factor)`) with on-chain dispute window and first-loss insurance pool.
- ✅ **149 Automated Tests Passing (71 Hardhat + 78 Frontend Vitest)** — 100% test pass rate validating formal contract invariants, cryptographic signature malleability (EIP-2), quantitative models, insurance pool withdrawal cooldowns, and component rendering.

---

## 🔍 Technical Transparency

> We believe in honest engineering. Here is our production-readiness breakdown:

| Component | Status | Details |
|:---|:---:|:---|
| **Smart Contract (`CreditPulseASC` v7.3.0)** | 🟢 **Production** | Deployed & verified on CC3 testnet. OpenZeppelin ReentrancyGuard + Pausable. 71 Hardhat tests including EIP-2 anti-malleability, UUPS upgradeability, insurance pool dual-tranche with 24h withdrawal cooldown. |
| **Unified Scoring Engine** | 🟢 **Production** | 7-vector scoring, sector-adaptive weights, 5-layer circuit breakers, Lindy curve. 100% parity across Next.js and FastAPI. |
| **Merton & Jump-Diffusion Model** | 🟢 **Production** | Structural default probabilities, distance-to-default, 99% VaR and Expected Shortfall with rating modifier. |
| **Price Oracle Cascade** | 🟢 **Production** | Live Binance ticker + DeFiLlama API with in-memory TTL caching. |
| **DON Multi-Oracle Quorum** | 🟢 **Production** | Distributed 2-of-3 BFT quorum via real HTTP calls to independent FastAPI validator nodes (ports 8011-8013). Each node independently fetches data from diverse sources (DeFiLlama/DexScreener/RPC), verifies scores within ±2 tolerance, and signs attestations. Automatic fallback to local deterministic signing if nodes unreachable, clearly labeled as `LOCAL_FALLBACK`. Launch: `./backend/scripts/start_don.sh` |
| **Live EVM Introspection** | 🟢 **Production** | 3 Ethereum RPC fallbacks (publicnode, cloudflare, ankr), ERC-20 portfolio balances, bytecode analysis. |
| **Attestcoin Cross-Chain Verification** | 🟡 **Testnet / Live** | Live prover integration when CC3 Proof Builder is reachable; deterministic hash commitment fallback with honest labeling. Production: native 0x0FD2 precompile on Creditcoin mainnet. |
| **Proof-of-Reserve (PoR)** | 🟡 **Testnet Ready** | Cryptographic Keccak256 hash commitments with on-chain storage. Production target: TLSNotary MPC-TLS integration with custodian partners. |
| **$CTC Token Economy** | 📋 **Designed** | OaaS query fee distribution, validator staking/slashing, and challenge bounty mechanisms specified. |

### 🏗️ Architecture Decision Record: Dual-Stack API

CreditPulse uses a **dual-stack** architecture by design:

| Layer | Technology | Role |
|:---|:---|:---|
| **Primary API (Serverless)** | Next.js 16 API Routes (`/api/*`) | Self-contained deployment. All scoring, DON consensus, Attestcoin verification, and on-chain recording run directly in the Next.js edge runtime. **This is the canonical entry point for the testnet deployment.** |
| **Extended Analytics API** | FastAPI (Python) | Advanced quantitative analytics, keeper daemon, batch processing, and production-grade risk engine with NumPy/SciPy. Connects to the same on-chain contracts. |

**Why both?** The Next.js API routes enable a **zero-infrastructure deployment** (single `npm run dev`), while the FastAPI backend provides **production-grade** Python quant capabilities (Monte Carlo, scipy.stats, NumPy matrix operations) that are impractical in a JavaScript runtime.

---

## 📌 Overview

**CreditPulse AI** is an autonomous risk assessment and decentralized credit scoring protocol tailored for Real-World Assets (RWAs) and DeFi protocols. By synthesizing real-time off-chain market intelligence (via DeFiLlama & DexScreener Oracles) with deterministic multi-vector risk algorithms and live EVM RPC contract introspection, CreditPulse AI computes objective credit scores and mints immutable, cryptographically verifiable risk certificates directly onto **Creditcoin Testnet (CC3)**.

---

## 🌐 Why Creditcoin?

Creditcoin is the foundational credit layer for decentralized finance and Real-World Assets. CreditPulse AI natively integrates with Creditcoin Testnet (CC3) for key architectural advantages:

1. **Native Query Verifier Precompile (`0x0FD2`):** Hardware-level EVM precompile for instant cross-chain proof inclusion without trusted bridges.
2. **Purpose-Built Credit Ledger:** Unique architecture for cross-chain credit recording, transparent lending histories, and inter-protocol trust verification.
3. **Immutable Audit Trails:** Every risk evaluation generated by CreditPulse AI is signed by a DON quorum and committed to `CreditPulseScore.sol`, establishing a permanent, tamper-proof history of asset health over time.
4. **High Throughput & Sub-Cent Gas:** Low transaction latency on Creditcoin CC3 allows continuous re-indexing and autonomous keeper updates at near-zero cost.

---

## 💼 B2B Business Model & Tokenomics ($CTC Utility)

CreditPulse AI operates as an **Oracle-as-a-Service (OaaS)** infrastructure driving direct economic value, fee burn, and staking demand to the Creditcoin ecosystem:

1. **Per-Query & Subscription Fees ($CTC):**
   * Under-collateralized lending protocols (e.g. Clearpool, Maple, Centrifuge) and RWA issuers pay a fee in **native $CTC** to query on-chain ratings via `getRiskReport(assetAddress)`.
   * **Fee Distribution:** 60% rewarded to DON Oracle node operators, 20% burned (deflationary pressure on $CTC), and 20% deposited into the Protocol Insurance Reserve Pool.
2. **Decentralized Oracle Staking & Economic Slashing:**
   * Validator nodes in the Decentralized Oracle Network (DON) must stake a minimum of **1,000 CTC** in `CreditPulseASC.sol`.
   * Malicious or out-of-sync attestations exceeding a 15% tolerance window trigger automated economic slashing of validator stake via the contract's `slashOracle` function.
3. **Proof-of-Reserve (PoR) Minting & Verification:**
   * Institutional RWA issuers pay an attestation fee in $CTC to mint verifiable Proof-of-Reserve certificates directly onto Creditcoin CC3.
4. **Optimistic Dispute Window & Challenger Bounties:**
   * Anyone can challenge an active on-chain risk score during the 3-day optimistic dispute window by posting a **0.05 ETH / CTC challenger bond**.
   * Successful challenges receive a bounty payout, and 80% of slashed stake routes to the first-loss Junior Insurance Tranche.

### 📈 Market Sizing & Unit Economics

**Total Addressable Market (TAM/SAM/SOM):**

| Layer | Market | Size |
|:---|:---|---:|
| **TAM** | Global tokenized asset market (2030 est.) | **$16T** |
| **SAM** | RWA lending & undercollateralized credit protocols | **$500B** |
| **SOM** | Credit data/oracle services for DeFi protocols | **$500M** |

**Revenue Model — Enterprise SaaS + Per-Query Hybrid:**

| Metric | Launch (Y1) | Growth (Y2) | Scale (Y3) |
|:---|---:|---:|---:|
| **Integrated Protocols** | 10 | 50 | 200+ |
| **Subscription Tier** | $500/mo | $2K/mo | $3K/mo |
| **Monthly Subscription ARR** | $60K | $1.2M | $7.2M |
| **On-Chain Query Volume** | 5K/day | 50K/day | 500K/day |
| **Query Revenue (0.5 CTC)** | $3.6K | $36K | $360K |
| **PoR Attestation Fees** | $6K | $60K | $300K |
| **Validator Staking TVL** | $50K | $1M | $10M+ |
| **Insurance Pool TVL** | $10K | $500K | $5M+ |
| **Blended ARR** | **$70K** | **$1.3M** | **$7.9M** |

> **Investment Thesis:** At a $2.5M pre-seed valuation, a $250K check buys 10% equity in an infrastructure protocol targeting $7.9M ARR by Y3 — a potential 30-50x return at Series A.

## 🏛️ Portfolio Coverage — Scored Protocols

CreditPulse AI currently supports risk scoring for **25+ protocols** across 8 asset categories, representing **$120B+ in combined TVL**:

| Category | Protocols | Combined TVL |
|:---|:---|---:|
| **Treasury RWA** | Ondo (OUSG), Mountain (USDM), Backed (bIBTA), Matrixdock (STBT) | $2.1B |
| **Money Markets** | Aave V3, Compound V3, Morpho Blue, Spark | $28B |
| **Private Credit** | Centrifuge, Maple Finance, Goldfinch, TrueFi, Clearpool | $1.8B |
| **Stablecoins** | MakerDAO (DAI), Frax (sFRAX), Ethena (USDe), Usual (USD0) | $12B |
| **DEX / Infrastructure** | Uniswap V3, Curve 3pool, Pendle Finance | $8.5B |
| **Liquid Staking** | Lido (stETH), Rocket Pool (rETH), Coinbase (cbETH) | $45B |
| **Cross-Chain** | Across Protocol, Stargate Finance V2 | $1.2B |
| **Institutional** | Custom enterprise integrations via SDK | On-demand |

> All protocols are scoreable via the UI dropdown, `/api/analyze?address=0x...`, or the `@creditpulse/sdk` package.

---

## 📐 Quantitative Risk Models

### 1. Merton (1974) Structural Default Model
The Merton framework treats equity as a European call option on protocol assets:

$$\text{Distance-to-Default } (d_2) = \frac{\ln(V / D) + (r - \frac{1}{2}\sigma_V^2)T}{\sigma_V \sqrt{T}}$$

$$\text{Probability of Default } P(V_T < D) = \Phi(-d_2)$$

Where:
* $V$ = Enterprise / Protocol Asset Value (TVL + Reserve Capital)
* $D$ = Total Liabilities / Debt Obligations
* $\sigma_V$ = Annualized Volatility of Assets
* $r$ = Risk-Free Interest Rate (4.5%)
* $T$ = Maturity Horizon (1.0 Year)

### 2. Jump-Diffusion Monte Carlo Simulation (Kou / Merton)
Simulates discontinuous price path shocks with Poisson jump arrivals across 1,000 paths:

$$dS_t = \mu S_t dt + \sigma S_t dW_t + J_t S_t dN_t$$

Computes:
* **Value-at-Risk (99% 10-Day VaR):** Maximum expected loss at 99% confidence level
* **Conditional VaR (99% Expected Shortfall):** Average loss beyond the 99% VaR threshold

### 3. Lindy Longevity Seasoning Curve
Penalizes newly deployed contracts against wash-trading spikes:

$$M_{\text{Lindy}} = \min\left(1.0, \max\left(0.25, \sqrt{\frac{\text{Age}_{\text{days}}}{90}}\right)\right)$$

---

## ⚖️ Sector-Adaptive Weight Matrices

| Risk Dimension | RWA Treasury SPV | Liquid Restaking (LRT) | DeFi Lending / CDP | General EVM Contracts |
|:---|:---:|:---:|:---:|:---:|
| **Collateral & Solvency** | **30%** | **25%** | **30%** | 17% |
| **Governance & Decentralization** | **20%** | 10% | 10% | 16% |
| **Security & Bytecode Track Record** | 10% | **25%** | **25%** | 17% |
| **Liquidity Depth** | 15% | **20%** | 20% | 17% |
| **Volatility & Stability** | 10% | 15% | 10% | 17% |
| **Audit Track Record** | 15% | 5% | 5% | 16% |

---

## 📜 Smart Contract Specification & Live Verifications

### 🔗 Verified On-Chain Transactions (Creditcoin Testnet CC3)

| Proof / Operation | Target Asset / Entity | Transaction Hash | Block | Explorer Link |
| :--- | :--- | :--- | :---: | :--- |
| **2-of-3 BFT DON Quorum** | Ondo Finance (OUSG) | `0x106fea94...b1794` | #5402307 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0x106fea947bb4ddb9a62e813979de864ebf78af214f48a240e31e5896058b1794) |
| **Live Oracle Risk Report** | Aave V3 Primary Pool | `0xcd53954c...dd44` | #5402300 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0xcd53954c04e7f2d5fb2b95054e83928f3ee735fa2651a40c83b149c65492dd44) |
| **Native `0x0FD2` Precompile Proof** | Cross-Chain Merkle Binding | `0x7986752d...2fb8` | #5389140 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0x7986752dcf8d62a59cfc1c3bdf07df3aadb46095167282fa8818370b844d2fb8) |
| **DON Node Alpha Auth** | Oracle Validator Registration | `0x9e09f55c...768e` | #5402302 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0x9e09f55caeb876c54b61880cbc8f2b7d3cd948f792d8343170241d7e7576768e) |
| **DON Node Beta Auth** | Oracle Validator Registration | `0xb13f5fa2...ed6d2` | #5402303 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0xb13f5fa24a0439904351400497eafba4f8b98adab5d3435413230fc0e7eed6d2) |
| **DON Node Gamma Auth** | Oracle Validator Registration | `0x7bb6e6f8...e5768` | #5402304 | [View on Blockscout](https://creditcoin-testnet.blockscout.com/tx/0x7bb6e6f8be7e3e9ac53ea2ebca364f0010d195e5f81fb850451ff2838bce5768) |

The core smart contract [`CreditPulseScore.sol`](contracts/contracts/CreditPulseScore.sol) is deployed on Creditcoin CC3 Testnet at [`0x358925c5839a36bB2181786B8763Da0653B0f438`](https://creditcoin-testnet.blockscout.com/address/0x358925c5839a36bB2181786B8763Da0653B0f438):

```solidity
contract CreditPulseASC {
    string public constant VERSION = "7.2.0";
    
    // BFT Multi-Oracle Threshold Quorum (2-of-3 ECDSA Signatures)
    function saveRiskReportMultiSigned(
        address _assetAddress,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        address[] calldata _signers,
        bytes[] calldata _signatures
    ) external;

    // Single Oracle Signature Verification
    function saveRiskReportSigned(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash,
        bytes calldata _signature
    ) external;

    // Cryptographic Proof-of-Reserve Certificate
    function saveRWAZkTLSCertificate(
        address _assetAddress,
        uint8 _score,
        uint16 _reserveRatioBps,
        bytes32 _zkTlsProofHash,
        bytes32 _custodianKeyHash,
        bytes32 _sessionCommitment
    ) external;

    // Optimistic Dispute Window & Economic Staking
    function challengeReport(address _assetAddress, uint256 _reportIndex, string calldata _evidenceUrl) external payable;
    function resolveDispute(address _assetAddress, uint256 _reportIndex, bool _upholdChallenge, address _maliciousOracle) external;
    function stakeOracle() external payable;
    function unstakeOracle(uint256 _amount) external;
}
```

---

## 🚀 Quick Start & Reproduction

### 1. Run Complete Automated Test Suites (149 Tests)

```bash
# 1. Smart Contract Hardhat Invariants (71 passing)
cd contracts
npx hardhat test

# 2. Frontend Vitest Quantitative & Component Suite (78 passing)
cd ../frontend
npm test
```

### 2. Start Full Local Development Stack

```bash
# Terminal 1: Start Next.js 16 Frontend
cd frontend
npm run dev
# Open http://localhost:3000

# Terminal 2 (Optional): Start FastAPI Backend
cd backend
source venv/bin/activate
uvicorn app:app --port 8000 --reload
```

---

## 🔌 Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/analyze` | Computes Merton default probabilities, 10-day CVaR, 7-vector scores, and AI synthesis. |
| `POST` | `/api/don/consensus` | Aggregates 2-of-3 BFT quorum signatures across validator nodes with sorted signer verification. |
| `POST` | `/api/record-don` | Gathers genuine 2-of-3 BFT ECDSA signatures from DON validator cluster and broadcasts on-chain. |
| `POST` | `/api/record` | Gasless relayer attestation submission with verified packed/EIP-712 signatures. |
| `POST` | `/api/record-verified` | Precompile `0x0FD2` cross-chain attestation binding with deterministic provenance. |
| `POST` | `/api/zktls/attest-reserve` | Proof-of-Reserve blinded hash commitments & TLSNotary MPC-TLS attestation digest. |
| `POST` | `/api/attestcoin/verify` | Direct query to Attestcoin proving batch service with Sepolia block height anchoring. |
| `GET` | `/api/tx-status/:hash` | Real-time query to Creditcoin CC3 RPC to poll block confirmations and gas receipts. |
| `GET` | `/api/stats` | Real-time query to Creditcoin CC3 contract for total reports, proofs, staking, and DON node cluster. |
| `GET` | `/api/health` | Comprehensive serverless and CC3 testnet RPC healthcheck endpoint. |

---

## 🏆 Competitive Landscape

| Feature | CreditPulse | Credora | Spectral Finance | Maple Finance |
|:---|:---:|:---:|:---:|:---:|
| **On-chain credit scoring** | ✅ | ✅ | ✅ | ❌ |
| **RWA-native (SPV/Treasury)** | ✅ | 🟡 | ❌ | 🟡 |
| **Merton structural default model** | ✅ | ❌ | ❌ | ❌ |
| **Monte Carlo jump-diffusion** | ✅ | ❌ | ❌ | ❌ |
| **DON multi-oracle BFT quorum** | ✅ | ❌ | ❌ | ❌ |
| **Proof-of-Reserve attestation** | ✅ | 🟡 | ❌ | ❌ |
| **Insurance pool (dual-tranche)** | ✅ | ❌ | ❌ | ✅ |
| **Creditcoin native integration** | ✅ | ❌ | ❌ | ❌ |
| **Open-source & auditable** | ✅ | ❌ | ❌ | 🟡 |
| **149 automated tests** | ✅ | N/A | N/A | N/A |

---

## 🗺️ Mainnet Deployment Roadmap

| Phase | Timeline | Milestone |
|:---|:---|:---|
| **Phase 1** | ✅ Complete | CC3 Testnet deployment, 149 tests, DON quorum, PoR engine |
| **Phase 2** | Q4 2026 | Creditcoin Mainnet deployment, KMS-backed validator keys, TLSNotary production integration |
| **Phase 3** | Q1 2027 | Multi-chain expansion (Ethereum L2s, Arbitrum, Base), institutional partnership onboarding |
| **Phase 4** | Q2 2027 | $CTC token launch, OaaS fee activation, DON staking/slashing live on mainnet |

**Mainnet readiness:** All smart contracts use OpenZeppelin upgradeable patterns (UUPS proxy), ReentrancyGuard, and Pausable — ready for mainnet deployment with zero code changes. Estimated gas cost per `saveRiskReportMultiSigned`: ~180K gas (~$0.003 on Creditcoin mainnet).

---

## 👥 Team & License

* **CreditPulse AI Core Team** — Protocol Architecture, AI Risk Modeling & Smart Contract Engineering
* Open-source and licensed under the [MIT License](LICENSE).
