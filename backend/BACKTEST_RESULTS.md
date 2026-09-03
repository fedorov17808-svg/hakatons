# CreditPulse — Historical Incident Backtest Report

**Generated:** 2026-08-30 13:47 UTC
**Model Version:** v7.3.0
**Incidents Tested:** 4

## Summary: 4/4 scenarios passed

| Incident | Pre-Score | During | Post | Drop | Circuit Breaker | Bank Run | Result |
|---|---|---|---|---|---|---|---|
| Terra/LUNA Death Spiral | 82 | 45 | 45 | -37 | 🔴 FIRED | 🏃 Yes | ✅ PASS |
| FTX/Alameda Contagion | 87 | 67 | 45 | -42 | 🔴 FIRED | No | ✅ PASS |
| SVB Bank Run & USDC Depeg | 91 | 83 | 84 | -7 | ⚪ No | No | ✅ PASS |
| Euler Finance Flash Loan Attack | 83 | 45 | 45 | -38 | 🔴 FIRED | 🏃 Yes | ✅ PASS |

---
### Terra/LUNA Death Spiral (May 7-13, 2022)
**Severity:** CATASTROPHIC

**Score Trajectory:**
- Pre-crisis: **82** (expected: (70, 90))
- During crisis: **45**
- Post-crisis: **45** (max expected: 50)
- Total drop: **-37 points**

> 🔴 **Circuit Breaker:** Circuit Breaker Triggered: Severe capital outflow / Bank Run detected (24h: -45.0%, 7d: -72.0%).

| Dimension | Pre | During | Post |
|---|---|---|---|
| overall | 82 | 45 | 45 |
| liquidity | 100 | 93 | 76 |
| collateral | 73 | 43 | 43 |
| security | 76 | 76 | 76 |
| volatility_score | 87 | 0 | 0 |
| governance | 71 | 71 | 70 |
| audit | 100 | 100 | 100 |

**Validation:**
- Pre-score in expected range: ✅
- Circuit breaker matched expectation: ✅
- Post-score below maximum: ✅

---
### FTX/Alameda Contagion (Nov 6-11, 2022)
**Severity:** CATASTROPHIC

**Score Trajectory:**
- Pre-crisis: **87** (expected: (75, 95))
- During crisis: **67**
- Post-crisis: **45** (max expected: 50)
- Total drop: **-42 points**

> 🔴 **Circuit Breaker:** None

| Dimension | Pre | During | Post |
|---|---|---|---|
| overall | 87 | 67 | 45 |
| liquidity | 95 | 89 | 80 |
| collateral | 82 | 50 | 50 |
| security | 80 | 80 | 80 |
| volatility_score | 92 | 0 | 0 |
| governance | 94 | 94 | 93 |
| audit | 100 | 100 | 100 |

**Validation:**
- Pre-score in expected range: ✅
- Circuit breaker matched expectation: ✅
- Post-score below maximum: ✅

---
### SVB Bank Run & USDC Depeg (Mar 10-13, 2023)
**Severity:** HIGH

**Score Trajectory:**
- Pre-crisis: **91** (expected: (80, 95))
- During crisis: **83**
- Post-crisis: **84** (max expected: 90)
- Total drop: **-7 points**

| Dimension | Pre | During | Post |
|---|---|---|---|
| overall | 91 | 83 | 84 |
| liquidity | 100 | 100 | 100 |
| collateral | 84 | 72 | 70 |
| security | 92 | 92 | 92 |
| volatility_score | 99 | 56 | 72 |
| governance | 83 | 83 | 83 |
| audit | 100 | 100 | 100 |

**Validation:**
- Pre-score in expected range: ✅
- Circuit breaker matched expectation: ✅
- Post-score below maximum: ✅

---
### Euler Finance Flash Loan Attack (Mar 13, 2023)
**Severity:** CATASTROPHIC

**Score Trajectory:**
- Pre-crisis: **83** (expected: (70, 90))
- During crisis: **45**
- Post-crisis: **45** (max expected: 50)
- Total drop: **-38 points**

> 🔴 **Circuit Breaker:** Circuit Breaker Triggered: Severe capital outflow / Bank Run detected (24h: -96.0%, 7d: -96.0%).

| Dimension | Pre | During | Post |
|---|---|---|---|
| overall | 83 | 45 | 45 |
| liquidity | 83 | 70 | 66 |
| collateral | 82 | 50 | 50 |
| security | 76 | 76 | 76 |
| volatility_score | 92 | 0 | 0 |
| governance | 91 | 89 | 89 |
| audit | 100 | 100 | 100 |

**Validation:**
- Pre-score in expected range: ✅
- Circuit breaker matched expectation: ✅
- Post-score below maximum: ✅

---
## Conclusion

✅ **All historical scenarios passed.** The scoring model correctly:
- Assigned moderate-to-high scores to pre-crisis protocols
- Triggered circuit breakers during catastrophic events
- Degraded scores significantly post-crisis
- Detected bank-run patterns in rapid TVL outflows