# ⚡ CreditPulse AI — Autonomous RWA Risk Scoring Platform

**CreditPulse AI** is a decentralized, autonomous credit scoring and risk assessment infrastructure tailored for Real-World Assets (RWA) and institutional DeFi capital pools.

---

## 🌟 Key Features

* **🤖 Autonomous AI Risk Engine:** Multi-factor analysis evaluating liquidity depth, collateralization ratios, and smart contract audit proofs calibrated against real-time market TVL benchmarks (via DeFiLlama Oracle).
* **📊 Institutional Spider Radar Analytics:** Dynamic 6-axis visual index breakdown powered by `recharts`.
* **⛓️ On-Chain Proof minting:** Verifiable recording of credit score reports directly into the deployed smart contract on Creditcoin Testnet.
* **🧾 PDF Audit Export:** One-click generation of B2B audit reports for risk managers and liquidity providers.

---

## 🏗️ System ArchitectureNext.js 14 Frontend    │ ───►   │  FastAPI AI Scoring Engine   │
│  (Tailwind + Recharts)  │        │  (Python + DeFiLlama Oracle) │
└────────────┬────────────┘        └──────────────┬───────────────┘
│                                    │
▼                                    ▼
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Ethers.js / Web3      │ ───►   │  CreditPulseScore.sol        │
│   Wallet Provider       │        │  0xd9145CCE...9943F39138     │
└─────────────────────────┘        └──────────────┴───────────────┘---

## 📜 Deployed Smart Contract

* **Contract Address:** `0xd9145CCE52D386f254917e481eB44e9943F39138`
* **Network:** Creditcoin Testnet / EVM Compatible Testnet
* **ABI Functions:** `saveRiskReport(string _assetAddress, uint256 _overallScore)`

---

## 🚀 Quickstart Guide

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
