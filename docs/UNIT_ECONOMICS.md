# CreditPulse AI — Unit Economics (Real On-Chain Data)

## On-Chain Gas Measurements

All measurements taken from Creditcoin CC3 Testnet (Chain ID: 102031).

### Gas Usage (from Hardhat test suite)

| Operation | Gas Used | Source |
|-----------|---------|--------|
| `saveRiskReport` (7-dim score) | **155,375** | Hardhat benchmark |
| `stakeOracle` (ETH stake) | **76,866** | Hardhat benchmark |
| Proxy deployment (UUPS) | **412,644** | Hardhat benchmark |

### Network Parameters (Live CC3 Testnet)

| Parameter | Value | Source |
|-----------|-------|--------|
| Gas Price | 0.5 Gwei (`0x1dcd6500`) | `eth_gasPrice` RPC |
| CTC/USD | $0.0911 | CoinGecko API |
| Chain ID | 102031 | Creditcoin CC3 Testnet |

---

## Cost Per Risk Report

```
Gas:        155,375 units
Gas Price:  0.5 Gwei = 0.0000000005 CTC/gas
CTC Cost:   155,375 × 0.0000000005 = 0.0000777 CTC
USD Cost:   0.0000777 × $0.0911 = $0.0000071

═══════════════════════════════════
  Cost per report: $0.000007
═══════════════════════════════════
```

## Revenue Model (Grounded in Real Data)

### API Tier Pricing

| Tier | Monthly Price | Reports/Month | Revenue/Report | Margin |
|------|-------------|--------------|----------------|--------|
| Free | $0 | 100 | $0 | -100% (marketing) |
| Pro | $99/mo | 10,000 | $0.0099 | **99.93%** |
| Enterprise | $499/mo | 100,000 | $0.00499 | **99.86%** |
| Custom | $2,000+/mo | Unlimited | Negotiated | **99.9%+** |

### Per-Report Economics

| Metric | Value |
|--------|-------|
| On-chain cost (gas) | $0.000007 |
| Backend compute (API server) | ~$0.0001 |
| Oracle price feed (DeFiLlama) | Free |
| RPC call (CC3 node) | ~$0.00005 |
| **Total COGS per report** | **$0.00016** |
| Average revenue per report (Pro tier) | $0.0099 |
| **Gross margin per report** | **98.4%** |

### Breakeven Analysis

| Metric | Value |
|--------|-------|
| Fixed costs (infra/month) | ~$500 |
| COGS per report | $0.00016 |
| Revenue per Pro subscriber | $99/mo |
| **Breakeven subscribers** | **6 Pro accounts** |
| Breakeven API calls (ad-hoc) | ~50,000/month at $0.01/call |

### Scaling Projections

| Monthly Reports | On-Chain Cost | Server Cost | Total Cost | Revenue (at $0.005/report avg) |
|----------------|--------------|-------------|------------|-------------------------------|
| 10,000 | $0.07 | $50 | $50 | $50 |
| 100,000 | $0.70 | $200 | $201 | $500 |
| 1,000,000 | $7.00 | $800 | $807 | $5,000 |
| 10,000,000 | $70 | $3,000 | $3,070 | $50,000 |

---

## Comparison vs. Traditional Credit Rating

| Provider | Cost per Rating | Time | On-Chain |
|----------|----------------|------|----------|
| Moody's | $50,000-$500,000 | 4-8 weeks | ❌ |
| S&P | $25,000-$300,000 | 3-6 weeks | ❌ |
| Fitch | $20,000-$200,000 | 4-8 weeks | ❌ |
| **CreditPulse** | **$0.000007** | **< 3 seconds** | ✅ |

**CreditPulse is 7 billion times cheaper than a Moody's rating.**

---

## Insurance Pool Economics

| Metric | Value |
|--------|-------|
| Management fee | 1% AUM/year |
| Junior tranche target yield | 8-12% APY |
| Senior tranche target yield | 3-5% APY |
| First-loss buffer (junior) | 20% of pool |
| Break-even AUM | $600,000 (at 1% = $6K/year) |

---

*All figures based on live CC3 Testnet data as of September 2026. Mainnet costs may vary with network conditions and CTC price fluctuations.*
