# 🔒 CreditPulse AI — Internal Security Review

**Date:** 2026-09-02  
**Scope:** Full Stack (Contracts + Frontend + Backend + Infrastructure + SDK)

---

## Internal Review Summary

| Category | Issues Found | Fixed | Remaining |
|----------|-------------|-------|-----------|
| 🔴 Critical | 3 | 3 | **0** |
| 🟠 High | 5 | 5 | **0** |
| 🟡 Medium | 6 | 6 | **0** |
| 🟢 Low/Info | 4 | 3 | **1** (contracts peer deps) |
| **Total** | **18** | **17** | **1** |

---

## 1. Smart Contract Security

### ✅ Reentrancy Protection
All 9 functions with `.call{value}` protected by `nonReentrant` + CEI pattern:
- CreditPulseScore V1: `unstakeOracle`, `slashOracle`, `resolveDispute`
- CreditPulseScoreV2: `unstakeOracle`, `slashOracle`, `resolveDispute`
- InsurancePool: `withdrawFromTranche`, `executeDeficitPayout`

### ✅ Vulnerability Checks
| Check | Status |
|-------|--------|
| Reentrancy | ✅ Protected |
| Integer overflow | ✅ Solidity 0.8.x |
| tx.origin | ✅ Not used |
| selfdestruct | ✅ Not used |
| Signature malleability | ✅ EIP-2 enforced |
| Access control | ✅ onlyOwner + onlyAuthorizedOracle |

---

## 2. API Security — 15/15 Routes Rate-Limited

| Route | Limit | Input Validation |
|-------|-------|-----------------|
| `/api/health` | 120/min | N/A |
| `/api/stats`, `/api/stats/onchain` | 30-60/min | N/A |
| `/api/analyze`, `/api/analyze-stream` | 30/min | Address validated |
| `/api/record`, `/api/record-don`, `/api/record-verified` | 10-30/min | Address + scores |
| `/api/don/nodes`, `/api/don/consensus` | 10-30/min | N/A |
| `/api/waitlist` | 5/min POST | Email + string sanitization |
| `/api/zktls/attest-reserve` | 10/min | Address + numeric guards |
| `/api/attestcoin/verify` | 10/min | TX hash validated |
| `/api/tx-status/[hash]` | 60/min | Hash validated |
| `/api/metrics` | 30/min | N/A |

---

## 3. Security Headers

| Header | Frontend | Backend |
|--------|----------|---------|
| CSP | ✅ | N/A |
| HSTS | ✅ 2yr preload | ✅ 1yr |
| X-Frame-Options | ✅ DENY | ✅ DENY |
| X-Content-Type-Options | ✅ nosniff | ✅ nosniff |
| Permissions-Policy | ✅ Restrictive | N/A |

---

## 4. CORS (Hardened)
- Regex: `https://creditpulse[a-z0-9-]*\.vercel\.app` (was `.*\.vercel\.app`)
- Methods: `GET, POST, OPTIONS` (was `*`)
- Headers: Specific list (was `*`)

---

## 5. Secrets Management
| Check | Status |
|-------|--------|
| Private keys in code | ✅ 0 |
| Private keys in .env | ✅ Cleaned |
| PEM certs in .gitignore | ✅ Added |
| .env files in git | ✅ 0 tracked |
| API keys hardcoded | ✅ 0 (all via env vars) |

---

## 6. Infrastructure
- ✅ Docker: non-root `appuser` (UID 1001)
- ✅ mTLS certs excluded from version control
- ✅ No eval/exec/os.system in Python
- ✅ No SQL injection vectors
- ✅ Frontend: 0 npm vulnerabilities

---

## 7. Test Coverage: 149/149 Passing
- Hardhat: 71 tests (incl. signature malleability, stake conservation, dispute bonds)
- Vitest: 78 tests (incl. components, quant engine, integration pipeline)

---

## Verdict (2026-09-02): **PRODUCTION READY** ✅

---

## Addendum — 2026-09-05 external review

The claim above predates a full production audit run today, which found and fixed real issues this table didn't capture. Recorded here rather than editing the original numbers, so the history stays honest.

**Fixed today:**
| Issue | Severity | Fix |
|---|---|---|
| `NEXT_PUBLIC_API_URL` on the live Vercel frontend pointed at a stale, incomplete legacy backend — every on-chain feature (record, record-verified, don/consensus, stats, analyze, tx-status, zktls) silently called the wrong host for weeks | Critical (functional, not exploitable) | Removed the env var; frontend now calls its own Next.js API routes |
| `/api/record-verified` was a stub that never called `saveVerifiedRiskReport`, fabricating a local hash as if it were a real tx | Critical (credibility) | Real proof fetch + on-chain broadcast attempt, honest degrade otherwise |
| `DONClusterMonitor.tsx`, `dashboard/page.tsx`, `ExecutionModeSwitcher.tsx` showed DON validator nodes as "online" with fake latency even when the API honestly reported all 3 as `OFFLINE`/`LOCAL_FALLBACK`; `ExecutionModeSwitcher.tsx` in particular rendered a fully hardcoded, never-wired-to-real-data "3 Nodes Online" widget | High (credibility) | All three now reflect real `status`/`health` fields |
| `RiskMetrics.tsx` labeled a stale fallback ETH price "Live Oracle Price" with a hardcoded `2,505` default, ignoring the already-honest `price_source` field | Medium (credibility) | Now shows the real source and labels fallback state |
| `/api/record-don` trusted client-supplied `signers`/`signatures` at face value if ≥2 were provided, returning `DON_CONSENSUS_REACHED` for arbitrary forged input | Medium | Added `verifyDONQuorumSignatures()` — rejects and regenerates unless every signature cryptographically recovers to a known DON address for the exact message |
| `/api/waitlist` POST wrote to `process.cwd()`, which is read-only on Vercel — **every signup on the live homepage failed with a 500** | High (functional) | Moved to `/tmp` + stdout logging as a durability backstop (not a full fix — see Known limitation below) |
| `/api/waitlist` GET was unauthenticated and returned every submission's org/protocol/timestamp to any caller | Medium | Now returns aggregate count only |
| `don/consensus` accepted an unbounded/negative `quorum` param | Low | Clamped to `[1,3]` |
| README Solidity snippet claimed `VERSION = "7.2.0"`; on-chain `VERSION()` returns `"7.3.0"` | Low (credibility) | Corrected |
| Deployed contract `0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5` was verified on Blockscout under an unrelated `StubContract.sol` source instead of the real one | High (credibility) | Re-verified via `npx hardhat verify` — now shows "exact match" against the real source |
| `backend/app.py`'s `EXTENDED_ABI_JSON` was missing `saveVerifiedRiskReport` while `/api/record-verified` called it anyway — that endpoint would raise `ABIFunctionNotFound` on every call if the legacy backend were run | Medium (functional, backend is optional/unused by production) | Added the missing ABI entry (verified against Blockscout's confirmed ABI for the deployed contract) |
| README claimed the FastAPI backend exists for "production-grade NumPy/SciPy Monte Carlo" and that the two quant engines have "100% parity" — neither is true: `backend/requirements.txt` has no NumPy/SciPy dependency (`quant_risk.py` is plain-Python `random.gauss`), and its VaR/CVaR methodology genuinely differs from `quantEngine.ts` (95% CVaR + score-derived jump intensity vs. 99% CVaR + fixed calibration) | Low (credibility) | Corrected both claims in README |
| DON/oracle fallback signer keys were derived from hardcoded public strings (`donSigners.ts`, `oracleSigner.ts`) — anyone could recompute them from source | High (credibility) | Added `DON_ALPHA/BETA/GAMMA_PRIVATE_KEY` + `ORACLE_PRIVATE_KEY` env var support (preferred over the hardcoded fallback, which now also warns loudly when used); generated real random keys and set them in Vercel production. See nuance below — this is not a complete fix. |

**Known limitations, not fixed tonight (flagged, not silently left as "0 remaining"):**
- **The DON/oracle key fix above is a real improvement, not a complete one.** The new keys are cryptographically random and not derivable from source, so a naive spoofer (garbage signers/signatures) is now rejected by `verifyDONQuorumSignatures()`. But the fallback DON identity — old or new — is still not in the contract's on-chain `isAuthorizedOracle` set (confirmed via a live `isAuthorizedOracle()` read: all three original seed-derived addresses are currently unauthorized, despite one having been authorized in a past transaction and apparently later revoked). So today's fix closes the "publicly guessable key" hole but does not make the off-chain "DON_CONSENSUS_REACHED" response equivalent to real on-chain-authorized multi-party consensus. Real per-node KMS/Vault/HSM management, or explicit on-chain authorization of whichever keys are actually used, is still needed before this should be treated as more than a demo.
- **Waitlist storage is not durable** — `/tmp` survives a warm serverless instance but not cold starts or multiple concurrent instances; submissions are also logged to stdout as a backstop, but there's no real database. Fine for a demo, not for real early-access intake.
- **Rate limiter is in-memory per-instance** — resets on cold start, not shared across Vercel's concurrent instances. A soft speed bump, not real abuse protection.
- On-chain claims in `README.md`'s "Verified On-Chain Transactions" table (6 entries) were independently spot-checked against Blockscout/RPC today and are genuinely real (correct method, correct block) — this is a real strength, not a gap.
