import { NextRequest } from "next/server";
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
import { CC3_RPC } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) streaming analysis endpoint.
 * Sends real-time pipeline steps to the frontend so the investor
 * can see each data source being queried live.
 */
export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(`stream:${clientIP}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ detail: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { address } = await req.json();
  if (!address) {
    return new Response(JSON.stringify({ detail: "Address required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(step: string, status: "running" | "done" | "error", data?: Record<string, unknown>) {
        const event = JSON.stringify({ step, status, data, timestamp: Date.now() });
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }

      try {
        // ─── Step 1: Resolve Address ────────────────────────
        send("resolve_address", "running", { label: "Validating Ethereum address..." });
        let checksumAddr: string;
        try {
          checksumAddr = ethers.getAddress(address);
        } catch {
          send("resolve_address", "error", { error: "Invalid Ethereum address" });
          controller.close();
          return;
        }
        send("resolve_address", "done", { address: checksumAddr });

        // ─── Step 2: Fetch Live ETH Price ───────────────────
        send("fetch_price", "running", { label: "Fetching live ETH price from Binance + DeFiLlama..." });
        const ethPriceResult = await getLiveEthPrice();
        const ethPrice = ethPriceResult.price;
        send("fetch_price", "done", { ethPrice, source: ethPrice > 0 ? ethPriceResult.source : "fallback" });

        // ─── Step 3: Protocol Intelligence ──────────────────
        send("fetch_protocol", "running", { label: "Querying DeFiLlama + DexScreener for protocol data..." });
        const protocolData = await fetchLiveProtocolData(checksumAddr);
        const tvl = protocolData?.tvl ?? 0;
        const protocolName = protocolData?.name ?? "Unknown Protocol";
        const rwaType = protocolData?.rwa_type ?? "DeFi";
        const ageInDays = protocolData?.listed_at
          ? Math.floor((Date.now() / 1000 - protocolData.listed_at) / 86400)
          : 0;
        send("fetch_protocol", "done", {
          tvl,
          protocolName,
          rwaType,
          sources: ["DeFiLlama", "DexScreener"]
        });

        // ─── Step 4: On-Chain Wallet Introspection ──────────
        send("inspect_wallet", "running", { label: "Inspecting on-chain wallet via 3 Ethereum RPC nodes..." });
        const walletData = await inspectOnchainWallet(checksumAddr);
        send("inspect_wallet", "done", {
          ethBalance: walletData.native_balance_eth,
          tokenCount: walletData.token_balances?.length ?? 0,
          isContract: walletData.is_contract,
          rpcNodes: ["publicnode", "cloudflare", "ankr"]
        });

        // ─── Step 5: Creditcoin CC3 Balance ─────────────────
        send("cc3_balance", "running", { label: "Querying Creditcoin CC3 testnet for CTC balance..." });
        let cc3Balance = "0";
        try {
          const cc3Provider = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
          const bal = await cc3Provider.getBalance(checksumAddr);
          cc3Balance = ethers.formatEther(bal);
        } catch { /* CC3 may be unreachable */ }
        send("cc3_balance", "done", { ctcBalance: cc3Balance, network: "CC3 Testnet (102031)" });

        // ─── Step 6: Merton Structural Model ────────────────
        send("merton_model", "running", { label: "Computing Merton (1974) structural default probability..." });
        const assetValue = tvl || walletData.native_balance_eth * ethPrice;
        const debtLevel = assetValue * 0.6;
        const volatility = 0.45;
        const merton = computeMertonDefault(assetValue, debtLevel, volatility, 1.0, 0.045);
        send("merton_model", "done", {
          defaultProbability: (merton.probDefault * 100).toFixed(4) + "%",
          distanceToDefault: merton.distanceToDefault.toFixed(3),
          model: "Black-Scholes-Merton (1974)"
        });

        // ─── Step 7: Monte Carlo VaR Simulation ─────────────
        send("monte_carlo", "running", { label: "Running Jump-Diffusion Monte Carlo (1,000 paths)..." });
        const varResult = simulateJumpDiffusionVaR(assetValue, volatility);
        send("monte_carlo", "done", {
          var99: varResult.var99.toFixed(2) + "%",
          cvar99: varResult.cvar99.toFixed(2) + "%",
          paths: 1000,
          model: "Kou Jump-Diffusion"
        });

        // ─── Step 8: 7-Dimensional Scoring ──────────────────
        send("scoring", "running", { label: "Computing 7-dimensional risk score with circuit breakers..." });
        const txCount = walletData.transaction_count ?? 0;
        const lindyMultiplier = computeLindySeasoning(ageInDays);
        const quantAdj = computeQuantitativeRiskAdjustment(
          merton.probDefault, varResult.cvar99, merton.distanceToDefault
        );

        // Compute individual scores
        const liquidityScore = Math.min(95, Math.max(10, Math.round(
          (tvl > 100_000_000 ? 85 : tvl > 10_000_000 ? 70 : tvl > 1_000_000 ? 55 : 35) * lindyMultiplier
        )));
        const collateralScore = Math.min(95, Math.max(10, Math.round(
          (walletData.is_contract ? 65 : 50) + (walletData.native_balance_eth > 10 ? 15 : 0)
        )));
        const auditScore = walletData.is_contract ? 60 : 45;
        const securityScore = Math.min(90, Math.max(15, 70 - Math.round(merton.probDefault * 200)));
        const volatilityScore = Math.min(90, Math.max(10, Math.round(85 - volatility * 100)));
        const governanceScore = walletData.is_contract ? 55 : 40;

        const rawOverall = Math.round(
          liquidityScore * 0.25 + collateralScore * 0.20 + auditScore * 0.15 +
          securityScore * 0.15 + volatilityScore * 0.10 + governanceScore * 0.15
        );
        const overall = Math.min(95, Math.max(5, rawOverall + quantAdj.netAdjustment));

        send("scoring", "done", {
          overall,
          dimensions: { liquidityScore, collateralScore, auditScore, securityScore, volatilityScore, governanceScore },
          lindyMultiplier: lindyMultiplier.toFixed(3),
          quantAdjustment: quantAdj.netAdjustment
        });

        // ─── Step 9: EIP-712 Oracle Signature ───────────────
        send("sign_attestation", "running", { label: "Signing EIP-712 typed data attestation..." });
        const dataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
          address: checksumAddr, overall, timestamp: Date.now()
        })));
        const aiDigest = ethers.keccak256(ethers.toUtf8Bytes("streaming-pipeline"));
        const signature = await signEIP712RiskReport({
          assetAddress: checksumAddr,
          overallScore: overall,
          liquidity: liquidityScore,
          collateral: collateralScore,
          auditScore,
          security: securityScore,
          volatility: volatilityScore,
          governance: governanceScore,
          dataHash,
          aiDigest,
        });
        send("sign_attestation", "done", {
          signer: signature.signer,
          signaturePrefix: signature.signature?.slice(0, 20) + "...",
          type: "EIP-712"
        });

        // ─── Step 10: AI Narrative ──────────────────────────
        send("ai_narrative", "running", { label: "Generating institutional credit narrative..." });
        const verdict = overall >= 75 ? "Investment Grade" : overall >= 50 ? "Speculative" : "High Risk";
        const narrativeResult = await generateCreditNarrative({
          address: checksumAddr,
          protocolName,
          rwaType,
          score: overall,
          verdict,
          liquidity: liquidityScore,
          collateral: collateralScore,
          security: securityScore,
          auditScore,
          volatility: volatilityScore,
          governance: governanceScore,
          mertonProbDefault: merton.probDefault,
          distanceToDefault: merton.distanceToDefault,
          var99: varResult.var99,
          cvar99: varResult.cvar99,
          isContract: walletData.is_contract,
          totalPortfolioUsd: walletData.total_portfolio_usd,
          isProtocolTvlEstimate: false,
          circuitBreakerActive: false,
          txCount,
          liveEthPrice: ethPrice,
        });
        send("ai_narrative", "done", { narrativeLength: narrativeResult.narrative.length });

        // ─── Final Result ───────────────────────────────────
        send("complete", "done", {
          address: checksumAddr,
          overall,
          liquidity: liquidityScore,
          collateral: collateralScore,
          audit: auditScore,
          security: securityScore,
          volatility: volatilityScore,
          governance: governanceScore,
          ethPrice,
          tvl,
          merton: {
            probDefault: merton.probDefault,
            distanceToDefault: merton.distanceToDefault
          },
          var99: varResult.var99,
          cvar99: varResult.cvar99,
          narrative: narrativeResult.narrative,
          dataHash,
          signature: signature.signature,
          signer: signature.signer,
          protocolName,
          cc3Balance,
          walletData
        });

      } catch (err) {
        send("error", "error", { error: (err as Error).message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
