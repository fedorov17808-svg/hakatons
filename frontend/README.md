# ⚡ CreditPulse AI — Institutional Frontend & Verification Terminal

<div align="center">

**Enterprise Real-World Asset (RWA) Credit Intelligence & Decentralized Oracle Terminal on Creditcoin CC3**

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black.svg?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Creditcoin](https://img.shields.io/badge/Creditcoin_Testnet-Chain_ID_102031-00E5FF.svg)](https://creditcoin-testnet.blockscout.com)
[![Smart Contract](https://img.shields.io/badge/Contract-0x3589...f438-7928CA.svg)](https://creditcoin-testnet.blockscout.com/address/0x358925c5839a36bB2181786B8763Da0653B0f438)
[![Vitest](https://img.shields.io/badge/Vitest-74_Passing-success.svg?style=flat&logo=vitest)](https://vitest.dev/)

</div>

---

## 📌 Overview

The **CreditPulse AI Frontend Terminal** is a high-performance, institutional-grade decentralized web application built with **Next.js 16 (App Router)** and **React 19**. It provides real-time quantitative risk scoring, cryptographic attestation generation, federated DON quorum consensus visualization, and on-chain proof verification against the `CreditPulseASC.sol` smart contract on **Creditcoin Testnet (CC3)**.

---

## 🚀 Key Terminal Capabilities

### 1. 📐 Quantitative Merton & Jump-Diffusion Engine
* Visualizes real-time **Distance-to-Default ($\sigma$)**, 1-year default probability $P(V_T < D)$, 10-day 99% **Value-at-Risk (VaR)**, and **Expected Shortfall (CVaR)** calculated via 1,000 Monte Carlo stochastic paths.

### 2. 🛡️ Federated DON Validator Cluster Telemetry
* Real-time heartbeat and latency monitoring across independent oracle validator nodes (**Node Alpha**, **Node Beta**, **Node Gamma**).
* Visualizes cryptographic **2-of-3 Byzantine Fault Tolerant (BFT) Quorum** signatures generated via sorted packed ECDSA.

### 3. 🔮 Native Precompile `0x0FD2` Proof Verifier
* Interactive testing terminal for Creditcoin's native hardware precompile (`0x0FD2`).
* Verifies source chain (e.g. Sepolia) Merkle siblings, block continuity roots, and emits cryptographic Query IDs without third-party bridges.

### 4. 🏦 Proof-of-Reserve (PoR) & zkTLS Certificates
* On-chain minting of cryptographic reserve certificates (`saveRWAZkTLSCertificate` and `saveRWACertificate`) backed by custodian commitments and legal entity digests.

### 5. ⚡ Dual Execution Engine
* **Self-Sovereign Direct MetaMask Mode:** Users sign and broadcast multi-signed transactions directly to Creditcoin CC3.
* **Gasless Relayer Mode:** Zero-friction institutional attestation broadcast with live block confirmation polling.

### 6. 💼 Institutional Due Diligence & SDK Portal
* 1-Click markdown export of institutional credit memos.
* Dynamic B2B Oracle fee & $CTC burn simulator (0.5 CTC/query, 20% burn, 60% validator APR, 20% insurance pool).
* 1-Line developer SDK integration snippets in **Solidity**, **TypeScript**, and **Python**.

---

## 🏛️ System Architecture

```mermaid
graph TD
    User([Institutional User / Underwriter]) -->|1. Enter Asset / Vault Address| UI[CreditPulse Terminal UI]
    
    subgraph Frontend Next.js 16 Architecture
        UI --> Form[AnalysisForm & Presets]
        Form --> API_Analyze[/api/analyze]
        API_Analyze --> Quant[Quant Engine: Merton & Jump-Diffusion]
        API_Analyze --> Onchain[EVM Bytecode & Portfolio Introspector]
        API_Analyze --> Oracle[Price Cascade: Binance + DeFiLlama]
        API_Analyze --> AI[AI Credit Rating Advisor]
        
        UI --> Exec[ExecutionModeSwitcher]
        Exec -->|Direct MetaMask| DirectFlow[Web3 BrowserProvider]
        Exec -->|Gasless Relayer| RelayerFlow[/api/record-don & /api/record]
        
        RelayerFlow --> DON[DON Consensus Generator: 2-of-3 BFT Quorum]
        UI --> Verifier[ProofVerifier: Precompile 0x0FD2]
        Verifier --> ASC_Verified[/api/record-verified]
    end
    
    subgraph Creditcoin Testnet CC3 Chain ID 102031
        DirectFlow -->|saveRiskReportMultiSigned| ASC[CreditPulseASC Smart Contract]
        RelayerFlow -->|saveRiskReportSigned| ASC
        ASC_Verified -->|saveVerifiedRiskReport| ASC
        ASC --> Precompile[Creditcoin Native Precompile 0x0FD2]
        ASC --> Storage[(Immutable Credit History Ledger)]
    end
```

---

## 📂 Project Structure

```
frontend/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/
│   │   │   ├── analyze/             # Quantitative risk & credit rating API
│   │   │   ├── attestcoin/verify/   # Native precompile 0x0FD2 verification
│   │   │   ├── don/
│   │   │   │   ├── consensus/       # BFT multi-oracle signature aggregation
│   │   │   │   └── nodes/           # Live DON validator node statuses
│   │   │   ├── health/              # Unified enterprise health check
│   │   │   ├── record/              # Single-signer relayer submission
│   │   │   ├── record-don/          # Multi-signed DON quorum broadcast
│   │   │   ├── record-verified/     # Precompile-verified proof binding
│   │   │   ├── stats/               # On-chain ledger statistics
│   │   │   └── tx-status/[hash]/    # Honest transaction receipt verifier
│   │   ├── globals.css              # Custom Tailwind & dark mode tokens
│   │   ├── layout.tsx               # Root layout with Geist font & metadata
│   │   └── page.tsx                 # Main CreditPulse dashboard entry point
│   ├── components/                  # Modular, typed React components
│   │   ├── ActionButtons.tsx        # Direct & relayer submission buttons
│   │   ├── AIAdvisory.tsx           # Qualitative AI credit rating memo
│   │   ├── AnalysisForm.tsx         # Asset search input & benchmark selector
│   │   ├── DONClusterMonitor.tsx    # 3-node DON quorum monitor & status
│   │   ├── Header.tsx               # Header, wallet connect & live RPC badge
│   │   ├── InstitutionalPortal.tsx  # $CTC unit economics & SDK code generator
│   │   ├── ProofOfReserveCard.tsx   # Cryptographic PoR commitment card
│   │   ├── ProofVerifier.tsx        # Hardware precompile 0x0FD2 test bench
│   │   ├── RadarChartComponent.tsx  # Recharts 6-dimension risk radar
│   │   ├── RiskMetrics.tsx          # 7-vector score bars & Merton indicators
│   │   ├── ScoreHeader.tsx          # Composite score badge & RWA tiering
│   │   ├── ScoringTransparency.tsx  # Sector weights, Lindy seasoning & rationale
│   │   └── TxStatusPanel.tsx        # Live transaction status & block explorer link
│   ├── hooks/                       # Custom React state hooks
│   │   ├── useBackendStatus.ts      # Engine health & RPC status watcher
│   │   ├── useOnChainHistory.ts     # Smart contract history reader
│   │   ├── useRiskAnalysis.ts       # Analysis state machine & score animator
│   │   ├── useTransactionRecorder.ts# Multi-mode transaction executor & poller
│   │   └── useWallet.ts             # Web3 browser wallet connector
│   └── lib/                         # Core algorithmic & cryptographic libraries
│       ├── aiNarrative.ts           # Explainable AI rating narrative builder
│       ├── config.ts                # Contract ABIs, presets & network constants
│       ├── donSigners.ts            # Multi-node ECDSA BFT quorum signature generator
│       ├── onchainInspector.ts      # EVM bytecode & multi-token balance scanner
│       ├── oracleSigner.ts          # EIP-712 typed data & packed signature signer
│       ├── priceOracle.ts           # Multi-tier price resolution cascade
│       └── quantEngine.ts           # Merton (1974) & Jump-Diffusion Monte Carlo
└── vitest.config.ts                 # Vitest test suite configuration
```

---

## 🛠️ Quick Start & Local Development

### 1. Prerequisites
- **Node.js** v18.17+ or v20+
- **npm** or **pnpm**

### 2. Installation
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### 3. Environment Setup
```bash
# Copy environment configuration
cp .env.example .env.local
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 🧪 Testing & Quality Assurance

Run the comprehensive unit and integration test suite:

```bash
# Run Vitest test suite
npm run test
```

### Test Coverage Highlights:
- **74+ Unit & Integration Tests Passing**
- Merton structural default probability & Distance-to-Default calculations
- Kou Jump-Diffusion Monte Carlo VaR/CVaR convergence
- EIP-712 domain separator & typehash verification
- DON Quorum signature sorting & threshold verification
- Component rendering & transaction lifecycle states

---

## 🔗 Network & Contract Verification

| Parameter | Value |
|:---|:---|
| **Network Name** | Creditcoin Testnet (CC3) |
| **Chain ID** | `102031` |
| **RPC Endpoint** | `https://rpc.cc3-testnet.creditcoin.network` |
| **Currency Symbol** | `tCTC` |
| **Block Explorer** | [Creditcoin Blockscout](https://creditcoin-testnet.blockscout.com) |
| **CreditPulseASC Contract** | [`0x358925c5839a36bB2181786B8763Da0653B0f438`](https://creditcoin-testnet.blockscout.com/address/0x358925c5839a36bB2181786B8763Da0653B0f438) |
| **Native Query Verifier Precompile** | `0x0000000000000000000000000000000000000FD2` |

---

## 📄 License
MIT License — Copyright (c) 2026 CreditPulse AI Team.
