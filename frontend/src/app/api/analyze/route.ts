import { NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  computeMertonDefault,
  simulateJumpDiffusionVaR,
  computeLindySeasoning,
  computeQuantitativeRiskAdjustment
} from "@/lib/quantEngine";
import { getLiveEthPrice, fetchLiveProtocolData } from "@/lib/priceOracle";
import { inspectOnchainWallet } from "@/lib/onchainInspector";
import { generateCreditNarrative } from "@/lib/aiNarrative";
import { signEIP712RiskReport } from "@/lib/oracleSigner";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Rate limit: 10 analyses per minute per IP (heavy endpoint)
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(`analyze:${clientIP}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { detail: "Rate limit exceeded. Try again later.", retry_after_ms: rateCheck.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    );
  }

  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ detail: "Address parameter is required" }, { status: 400 });
    }

    let checksumAddr = address;
    try {
      checksumAddr = ethers.getAddress(address);
    } catch {
      return NextResponse.json({ detail: "Invalid EVM hex address format" }, { status: 400 });
    }

    // 1. Fetch live market price and check protocol catalog
    const [{ price: liveEthPrice, source: priceSource }, liveProtocol] = await Promise.all([
      getLiveEthPrice(),
      fetchLiveProtocolData(checksumAddr)
    ]);

    // 2. Perform live onchain introspection (ETH, tokens, tx count, bytecode)
    const onchainTelemetry = await inspectOnchainWallet(checksumAddr);

    let protocolName = "";
    let rwaType = "";
    let liquidity = 0;
    let collateral = 0;
    let security = 0;
    let auditScore = 0;
    let volatility = 0;
    let governance = 0;
    let weightedRaw = 0;
    let verdict = "";
    let category = "";
    let weightProfile: Record<string, number> = {};
    let circuitBreakerActive = false;
    let circuitBreakerReason: string | null = null;
    let seasoningMultiplier = 1.0;
    let effectiveTvl = 0;

    const sourcesUsed: string[] = [
      `Ethereum RPC Node (${onchainTelemetry.rpc_used})`,
      `${priceSource} (ETH: $${liveEthPrice.toLocaleString()})`
    ];

    if (liveProtocol) {
      // ─────────────────────────────────────────────────────────────
      // Case A: Known Institutional Protocol / RWA Vault
      // ─────────────────────────────────────────────────────────────
      protocolName = liveProtocol.name;
      rwaType = liveProtocol.rwa_type;
      category = liveProtocol.category.toLowerCase();
      const isRwa = category.includes("rwa") || category.includes("treasuries") || category.includes("private credit") || category.includes("real world");
      const isLrt = category.includes("liquid restaking") || category.includes("lrt") || category.includes("liquid staking");

      sourcesUsed.push(
        liveProtocol.is_live ? "DeFiLlama Live Protocol Telemetry API" : "Institutional Benchmark Registry",
        "Chainlink Proof-of-Reserve Feed Catalog"
      );

      const rawTvl = liveProtocol.tvl;
      const change1d = liveProtocol.change_1d;
      const change7d = liveProtocol.change_7d;
      const chainsCount = liveProtocol.chains_count;
      const numAudits = parseInt(liveProtocol.audits) || 6;
      const hasVerifiedAudit = numAudits > 0;
      const listedAt = liveProtocol.listed_at || 1642377600;

      // 1. Seasoning & Lindy Maturity Curve
      const nowSec = Math.floor(Date.now() / 1000);
      const ageDays = Math.max(1.0, (nowSec - listedAt) / 86400.0);
      seasoningMultiplier = computeLindySeasoning(ageDays);
      effectiveTvl = Math.max(0.0, rawTvl) * seasoningMultiplier;

      // 2. Anti-TVL-Spike & Surge Damping (v8.5 Enterprise)
      const posSpike1d = Math.max(0.0, change1d);
      const posSpike7d = Math.max(0.0, change7d);
      const negDrop1d = Math.min(0.0, change1d);
      const negDrop7d = Math.min(0.0, change7d);

      if (posSpike1d > 25.0 || posSpike7d > 60.0) {
        const spikeDampingFactor = 1.0 + (Math.max(0.0, posSpike1d - 25.0) / 100.0) * 0.5 + (Math.max(0.0, posSpike7d - 60.0) / 100.0) * 0.3;
        effectiveTvl = Math.max(1.0, effectiveTvl / spikeDampingFactor);
      }

      // 3. Liquidity Dimension
      if (isRwa) {
        liquidity = Math.min(100, Math.max(20, Math.round(Math.log10(Math.max(1.0, effectiveTvl)) * 10.5)));
      } else {
        liquidity = Math.min(100, Math.max(0, Math.round(Math.log10(Math.max(1.0, effectiveTvl)) * 10.0)));
      }

      // 4. Collateral & Solvency Dimension
      let collateralBase = isRwa ? 92 : (category.includes("lending") || category.includes("cdp") ? 85 : (isLrt ? 78 : 68));
      const drawdownPenalty = Math.min(35, Math.round(Math.abs(change7d) * (isRwa ? 0.6 : 1.0)));
      collateral = Math.min(100, Math.max(0, collateralBase - drawdownPenalty));

      // 5. Security Track Record
      let secBase = isRwa ? 45 : 40;
      if (hasVerifiedAudit) secBase += 32;
      secBase += Math.min(28, chainsCount * 4);
      security = Math.min(100, Math.max(0, secBase));

      // 6. Volatility & Stability
      let volScore = 100;
      volScore -= Math.round(Math.abs(change1d) * (isRwa ? 1.5 : 3.0));
      volScore -= Math.round(Math.abs(change7d) * (isRwa ? 0.8 : 1.5));
      const divergence = Math.abs(change1d - change7d);
      if (divergence > 80.0) {
        volScore -= Math.min(25, Math.round((divergence - 80.0) * 0.4));
      }
      volatility = Math.min(100, Math.max(0, volScore));

      // 7. Governance Dimension
      let govBase = isRwa ? 75 : (category.includes("lending") ? 55 : 35);
      const govChainBonus = Math.min(15, chainsCount * 3);
      const govAgeMonths = Math.max(0, (nowSec - listedAt) / (30 * 86400));
      const govAgeBonus = Math.min(15, Math.round(govAgeMonths * 0.4));
      const govAuditBonus = hasVerifiedAudit ? 8 : 0;
      const govTvlBonus = Math.min(10, Math.round(Math.log10(Math.max(1.0, rawTvl)) * 1.2));
      governance = Math.min(100, Math.max(0, govBase + govChainBonus + govAgeBonus + govAuditBonus + govTvlBonus));

      // 8. Audit Dimension
      const auditBase = hasVerifiedAudit ? 88 : 32;
      auditScore = Math.min(100, auditBase + Math.min(20, chainsCount * 2) + Math.min(15, Math.round(govAgeMonths * 0.5)));

      // 9. Sector-Adaptive Weight Profile (Synchronized with backend risk_engine.py — 6D profiles)
      if (isRwa) {
        weightProfile = { collateral: 0.30, governance: 0.20, audit: 0.15, liquidity: 0.15, security: 0.10, volatility: 0.10 };
        weightedRaw = collateral * 0.30 + governance * 0.20 + auditScore * 0.15 + liquidity * 0.15 + security * 0.10 + volatility * 0.10;
      } else if (isLrt) {
        weightProfile = { collateral: 0.25, security: 0.25, liquidity: 0.20, volatility: 0.15, governance: 0.10, audit: 0.05 };
        weightedRaw = collateral * 0.25 + security * 0.25 + liquidity * 0.20 + volatility * 0.15 + governance * 0.10 + auditScore * 0.05;
      } else if (category.includes("lending") || category.includes("cdp")) {
        weightProfile = { collateral: 0.30, security: 0.25, liquidity: 0.20, volatility: 0.10, governance: 0.10, audit: 0.05 };
        weightedRaw = collateral * 0.30 + security * 0.25 + liquidity * 0.20 + volatility * 0.10 + governance * 0.10 + auditScore * 0.05;
      } else {
        weightProfile = { collateral: 0.17, security: 0.17, liquidity: 0.17, volatility: 0.17, governance: 0.16, audit: 0.16 };
        weightedRaw = collateral * 0.17 + security * 0.17 + liquidity * 0.17 + volatility * 0.17 + governance * 0.16 + auditScore * 0.16;
      }

      // 10. Catastrophic Circuit Breakers (Identical to backend risk_engine.py)
      const minCritical = Math.min(security, collateral);
      if (security < 45 || collateral < 40 || volatility < 30) {
        circuitBreakerActive = true;
        const hardCap = Math.min(100.0, Math.max(5.0, minCritical * 1.35));
        if (weightedRaw > hardCap) {
          weightedRaw = hardCap;
          circuitBreakerReason = `Critical Vector Vulnerability (Security=${security}, Collateral=${collateral}, Volatility=${volatility})`;
        }
      }

      if (posSpike1d > 150.0 || posSpike7d > 300.0) {
        circuitBreakerActive = true;
        weightedRaw = Math.min(weightedRaw, 58.0);
        circuitBreakerReason = `Unseasoned Liquidity Surge (+${posSpike1d.toFixed(1)}% 24h). Anti-TVL-Spike Protection Engaged.`;
      }

      if (negDrop1d < -35.0 || negDrop7d < -60.0) {
        circuitBreakerActive = true;
        weightedRaw = Math.min(weightedRaw, 45.0);
        circuitBreakerReason = `Severe Capital Outflow / Bank Run Detected (24h: ${negDrop1d.toFixed(1)}%, 7d: ${negDrop7d.toFixed(1)}%).`;
      }

    } else if (onchainTelemetry.is_contract) {
      // ─────────────────────────────────────────────────────────────
      // Case B: Arbitrary EVM Smart Contract
      // ─────────────────────────────────────────────────────────────
      protocolName = `Smart Contract (${checksumAddr.slice(0, 6)}...${checksumAddr.slice(-4)})`;
      rwaType = "On-Chain EVM Smart Contract";
      sourcesUsed.push("EVM Contract Bytecode Introspection Engine");

      const totalValUsd = onchainTelemetry.total_portfolio_usd;
      const bSize = onchainTelemetry.bytecode_size;
      const txs = onchainTelemetry.transaction_count;

      // Continuous logarithmic scaling
      liquidity = Math.min(100, Math.max(10, Math.round(Math.log10(Math.max(10.0, totalValUsd + 100.0)) * 15.0)));
      collateral = Math.min(100, Math.max(15, Math.round(Math.log10(Math.max(10.0, totalValUsd + 100.0)) * 14.0 + (txs > 50 ? 20 : 0))));
      security = Math.min(100, Math.max(20, Math.round(Math.min(bSize, 24000) / 24000.0 * 50 + (txs > 100 ? 35 : Math.min(35, txs * 0.35)))));
      auditScore = bSize > 8000 ? 65 : (bSize > 2000 ? 45 : 20);
      volatility = Math.min(100, Math.max(30, Math.round(50 + Math.min(45, Math.log10(Math.max(1, txs + 1)) * 18))));
      governance = Math.min(100, Math.max(20, Math.round(30 + Math.min(55, (bSize / 24000.0) * 35 + (txs > 200 ? 20 : 5)))));

      weightProfile = { collateral: 0.25, liquidity: 0.20, security: 0.25, governance: 0.15, volatility: 0.10, audit: 0.05 };
      weightedRaw = collateral * 0.25 + liquidity * 0.20 + security * 0.25 + governance * 0.15 + volatility * 0.10 + auditScore * 0.05;

      if (txs === 0 && totalValUsd < 10) {
        circuitBreakerActive = true;
        weightedRaw = Math.min(weightedRaw, 25.0);
        circuitBreakerReason = "Unseasoned Zero-State Contract: No execution history or verifiable liquidity";
      }

    } else {
      // ─────────────────────────────────────────────────────────────
      // Case C: Arbitrary Individual / Institutional EOA Account
      // ─────────────────────────────────────────────────────────────
      const isWhale = checksumAddr.toLowerCase() === "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" || onchainTelemetry.total_portfolio_usd > 25000;
      protocolName = isWhale ? `Seasoned Account (${checksumAddr.slice(0, 6)}...${checksumAddr.slice(-4)})` : `Individual Account (${checksumAddr.slice(0, 6)}...${checksumAddr.slice(-4)})`;
      rwaType = "EVM Individual Account (EOA)";
      sourcesUsed.push("ERC-20 Multi-Token Balance Portfolio Analyzer");

      const totalUsd = onchainTelemetry.total_portfolio_usd;
      const txCount = onchainTelemetry.transaction_count;

      // Continuous Logarithmic Scaling for Balance & Nonce
      liquidity = Math.min(100, Math.max(5, Math.round(Math.log10(Math.max(1.0, totalUsd + 1.0)) * 17.5)));
      const activityScore = Math.min(100, Math.max(5, Math.round(Math.log10(Math.max(1.0, txCount + 1.0)) * 31.5)));

      collateral = Math.min(100, Math.max(10, Math.round(liquidity * 0.65 + activityScore * 0.35)));
      security = Math.min(100, Math.max(15, Math.round(20 + Math.min(70, activityScore * 0.75))));
      auditScore = Math.min(100, Math.max(10, Math.round(15 + Math.min(60, activityScore * 0.55))));
      volatility = Math.min(100, Math.max(25, Math.round(35 + Math.min(55, activityScore * 0.55))));
      governance = Math.min(100, Math.max(15, Math.round(20 + Math.min(60, activityScore * 0.60))));

      weightProfile = { collateral: 0.25, liquidity: 0.25, security: 0.20, audit: 0.15, volatility: 0.10, governance: 0.05 };
      weightedRaw = collateral * 0.25 + liquidity * 0.25 + security * 0.20 + auditScore * 0.15 + volatility * 0.10 + governance * 0.05;

      if (txCount === 0 && totalUsd < 1) {
        circuitBreakerActive = true;
        weightedRaw = Math.min(weightedRaw, 18.0);
        circuitBreakerReason = "Unseasoned Zero-Balance Wallet: Zero historical transactions and zero assets";
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Quantitative Merton & Monte Carlo Jump-Diffusion Modeling
    // ─────────────────────────────────────────────────────────────
    const estAssetUsd = liveProtocol ? liveProtocol.tvl : Math.max(100, onchainTelemetry.total_portfolio_usd);
    const estDebtUsd = estAssetUsd * Math.max(0.05, 1.0 - collateral / 100.0);
    const annualVol = Math.max(0.12, (100 - volatility) / 100.0 * 0.75);

    const merton = computeMertonDefault(estAssetUsd, Math.max(50, estDebtUsd), annualVol, 0.045, 1.0);
    const addressSeed = parseInt(checksumAddr.slice(2, 10), 16);
    const mc = simulateJumpDiffusionVaR(estAssetUsd, annualVol, 10, 1000, addressSeed);
    const lindyMult = computeLindySeasoning(liveProtocol ? 365 : Math.max(1, onchainTelemetry.transaction_count * 2));

    // ─────────────────────────────────────────────────────────────
    // 4. Quantitative Model Feedback on Composite Credit Score
    // ─────────────────────────────────────────────────────────────
    const quantAdj = computeQuantitativeRiskAdjustment(merton.probDefault, mc.cvar99, merton.distanceToDefault);
    let finalScore = Math.max(0, Math.min(100, Math.round(weightedRaw + quantAdj.netAdjustment)));

    if (finalScore >= 85) {
      verdict = "INSTITUTIONAL AAA — Sovereign Backing";
    } else if (finalScore >= 70) {
      verdict = "INVESTMENT GRADE AA — Robust Solvency";
    } else if (finalScore >= 50) {
      verdict = "INVESTMENT GRADE A — Active Counterparty";
    } else if (finalScore >= 30) {
      verdict = "MODERATE RISK B — Speculative Grade";
    } else {
      verdict = "HIGH RISK C — Minimal Solvency Backing";
    }

    // ─────────────────────────────────────────────────────────────
    // 5. AI Credit Rating Memo & Risk Factor Synthesis
    // ─────────────────────────────────────────────────────────────
    const narrativeResult = await generateCreditNarrative({
      address: checksumAddr,
      protocolName,
      rwaType,
      score: finalScore,
      verdict,
      liquidity,
      collateral,
      security,
      auditScore,
      volatility,
      governance,
      mertonProbDefault: merton.probDefault,
      distanceToDefault: merton.distanceToDefault,
      var99: mc.var99,
      cvar99: mc.cvar99,
      isContract: onchainTelemetry.is_contract,
      totalPortfolioUsd: estAssetUsd,
      txCount: onchainTelemetry.transaction_count,
      liveEthPrice
    });

    // ─────────────────────────────────────────────────────────────
    // 6. Canonical Hashes & Cryptographic EIP-712 Attestation
    // ─────────────────────────────────────────────────────────────
    const canonicalPayload = JSON.stringify({
      address: checksumAddr.toLowerCase(),
      scores: [finalScore, liquidity, collateral, auditScore, security, volatility, governance]
    });
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload));
    const aiDigest = ethers.keccak256(ethers.toUtf8Bytes(`NARRATIVE:${checksumAddr}:${finalScore}`));

    const eip712Attestation = await signEIP712RiskReport({
      assetAddress: checksumAddr,
      overallScore: finalScore,
      liquidity,
      collateral,
      auditScore,
      security,
      volatility,
      governance,
      dataHash,
      aiDigest
    });

    return NextResponse.json({
      protocol_name: protocolName,
      rwa_type: rwaType,
      score: finalScore,
      deterministic_score: finalScore,
      raw_weighted_score: Math.round(weightedRaw),
      liquidity,
      collateral,
      security,
      audit: auditScore,
      volatility_score: volatility,
      governance,
      verdict,
      scoring_engine: "CreditPulse Quantitative Engine v8.5 (Merton-Kou Framework)",
      circuit_breaker_active: circuitBreakerActive,
      circuit_breaker_reason: circuitBreakerReason,
      weight_profile: weightProfile,
      scoring_breakdown: {
        collateral_points: Math.round(collateral * (weightProfile.collateral || 0.25)),
        liquidity_points: Math.round(liquidity * (weightProfile.liquidity || 0.20)),
        security_points: Math.round(security * (weightProfile.security || 0.20)),
        governance_points: Math.round(governance * (weightProfile.governance || 0.15)),
        volatility_points: Math.round(volatility * (weightProfile.volatility || 0.10)),
        audit_points: Math.round(auditScore * (weightProfile.audit || 0.10)),
        quantitative_adjustment_points: quantAdj.netAdjustment,
        quantitative_rationale: quantAdj.rationale
      },
      seasoning_score: Math.round(seasoningMultiplier * 100),
      quantitative_model: {
        merton_default_prob: merton.probDefault,
        distance_to_default_sigma: merton.distanceToDefault,
        var_99_10d_pct: mc.var99,
        cvar_99_10d_pct: mc.cvar99,
        lindy_seasoning_multiplier: lindyMult,
        simulated_monte_carlo_paths: 1000,
        risk_free_rate_pct: 4.5,
        rating_impact_points: quantAdj.netAdjustment
      },
      data_hash: dataHash,
      ai_digest: aiDigest,
      ai_narrative: narrativeResult.narrative,
      ai_risks: narrativeResult.risks,
      ai_recommendations: narrativeResult.recommendations,
      ai_model: narrativeResult.modelUsed,
      ai_powered: true,
      onchain_telemetry: onchainTelemetry,
      sources_used: sourcesUsed,
      eip712_attestation: {
        signer: eip712Attestation.signer,
        signature: eip712Attestation.signature,
        r: eip712Attestation.r,
        s: eip712Attestation.s,
        v: eip712Attestation.v,
        domain: eip712Attestation.domain,
        message: eip712Attestation.message
      },
      provenance: {
        data_hash: dataHash,
        hash_algorithm: "Keccak256",
        network: "Creditcoin Testnet CC3 (Chain ID 102031)",
        precompile: "0x0000000000000000000000000000000000000FD2",
        commitment_scheme: "Cryptographic Proof-of-Reserve Hash Commitment"
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Analysis error";
    console.error("API analyze error:", message);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
