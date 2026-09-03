# @creditpulse/sdk

> Official TypeScript SDK for CreditPulse AI — Institutional-Grade Credit Risk Scoring on Creditcoin CC3

[![npm version](https://img.shields.io/npm/v/@creditpulse/sdk.svg)](https://www.npmjs.com/package/@creditpulse/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

CreditPulse SDK enables DeFi protocols, lending platforms, and fintech applications to integrate institutional-grade credit risk scoring powered by:

- **Merton (1974) Structural Default Model** — Probability of default calculation
- **Kou Jump-Diffusion Monte Carlo** — 1,000-path tail risk simulation
- **Decentralized Oracle Network (DON)** — Multi-oracle consensus with BLS signatures
- **On-chain Attestation** — Verifiable, tamper-proof risk reports on Creditcoin CC3

## Installation

```bash
npm install @creditpulse/sdk
# or
yarn add @creditpulse/sdk
```

## Quick Start

```typescript
import { CreditPulseSDK } from '@creditpulse/sdk';

// Initialize with Creditcoin CC3 Testnet
const sdk = new CreditPulseSDK({
  rpcUrl: 'https://rpc.cc3-testnet.creditcoin.network',
  contractAddress: '0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5',
});

// Analyze credit risk for any EVM address
const report = await sdk.analyzeRisk('0xdAC17F958D2ee523a2206206994597C13D831ec7');

console.log(`Overall Score: ${report.overallScore}/100`);
console.log(`Default Probability: ${report.mertonPD}%`);
console.log(`VaR (99%): $${report.var99.toLocaleString()}`);
```

## Features

### Risk Analysis
```typescript
// Full 7-dimensional risk assessment
const report = await sdk.analyzeRisk(address);
// Returns: overallScore, collateral, liquidity, audit, security, volatility, governance
```

### On-Chain Recording
```typescript
// Record risk report on-chain with oracle signature
const tx = await sdk.recordOnChain(address, report, privateKey);
console.log(`TX Hash: ${tx.hash}`);
```

### Dynamic Loan Terms
```typescript
// Get risk-adjusted lending parameters
const terms = await sdk.getDynamicLoanTerms(report);
// Returns: maxLTV, interestRate, liquidationThreshold, collateralFactor
```

### Insurance Pool
```typescript
// Query insurance pool status
const pool = await sdk.getInsurancePoolStatus();
console.log(`Junior Tranche TVL: ${pool.juniorTVL}`);
console.log(`Senior Tranche TVL: ${pool.seniorTVL}`);
```

## API Reference

### `CreditPulseSDK`

| Method | Description | Returns |
|--------|-------------|---------|
| `analyzeRisk(address)` | Full credit risk analysis | `RiskScores` |
| `recordOnChain(address, scores, key)` | Record report on-chain | `TransactionReceipt` |
| `getDynamicLoanTerms(scores)` | Risk-adjusted loan parameters | `DynamicLoanTerms` |
| `getContractStats()` | Protocol statistics | `ContractStats` |

### `RiskScores`

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `overallScore` | `number` | 0-100 | Composite credit score |
| `collateral` | `number` | 0-100 | Collateral health |
| `liquidity` | `number` | 0-100 | Liquidity depth |
| `audit` | `number` | 0-100 | Smart contract audit status |
| `security` | `number` | 0-100 | Security posture |
| `volatility` | `number` | 0-100 | Market volatility exposure |
| `governance` | `number` | 0-100 | Governance risk |
| `mertonPD` | `number` | 0-100% | Merton probability of default |
| `var99` | `number` | USD | Value-at-Risk (99th percentile) |

## Requirements

- Node.js >= 18.0.0
- ethers.js v6

## License

MIT © CreditPulse AI Team
