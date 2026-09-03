import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { CC3_RPC, CONTRACT_ADDRESS } from "@/lib/config";
import { applyRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

/**
 * /api/metrics — Operational metrics endpoint.
 * Returns system health, uptime, RPC latency, and protocol stats
 * in a format suitable for status pages and monitoring dashboards.
 */
export async function GET(req: Request) {
  const rateLimitResponse = applyRateLimit(req, 30, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const startTime = Date.now();
  const metrics: Record<string, unknown> = {
    service: "CreditPulse",
    version: "7.3.0",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  };

  // RPC Health Check
  const rpcChecks: Array<{ name: string; url: string; latency_ms: number; status: string; block?: number }> = [];
  
  const rpcEndpoints = [
    { name: "CC3 Testnet", url: CC3_RPC },
    { name: "Ethereum (publicnode)", url: "https://ethereum-rpc.publicnode.com" },
    { name: "Ethereum (cloudflare)", url: "https://cloudflare-eth.com" },
  ];

  for (const rpc of rpcEndpoints) {
    const rpcStart = Date.now();
    try {
      const provider = new ethers.JsonRpcProvider(rpc.url, undefined, { staticNetwork: true });
      const block = await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
      ]);
      rpcChecks.push({
        name: rpc.name,
        url: rpc.url.replace(/\/[a-f0-9]{32,}/gi, "/***"), // mask API keys
        latency_ms: Date.now() - rpcStart,
        status: "operational",
        block: block as number,
      });
    } catch {
      rpcChecks.push({
        name: rpc.name,
        url: rpc.url.replace(/\/[a-f0-9]{32,}/gi, "/***"),
        latency_ms: Date.now() - rpcStart,
        status: "degraded",
      });
    }
  }

  // Contract Health
  let contractStatus = "unknown";
  let reportCount: number | null = null;
  try {
    const cc3 = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
    const code = await cc3.getCode(CONTRACT_ADDRESS);
    if (code && code.length > 10) {
      contractStatus = "deployed";
      const abi = ["function reportCount() view returns (uint256)"];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, cc3);
      reportCount = Number(await contract.reportCount());
    }
  } catch { /* silent */ }

  metrics.rpc_health = rpcChecks;
  metrics.contract = {
    address: CONTRACT_ADDRESS,
    network: "Creditcoin CC3 Testnet (102031)",
    status: contractStatus,
    total_reports: reportCount,
  };

  // API Performance
  metrics.api = {
    response_time_ms: Date.now() - startTime,
    endpoints: {
      analyze: "/api/analyze",
      analyze_stream: "/api/analyze-stream",
      record: "/api/record",
      record_verified: "/api/record-verified",
      don_consensus: "/api/don/consensus",
      attestcoin: "/api/attestcoin/verify",
      stats: "/api/stats/onchain",
      health: "/api/health",
      metrics: "/api/metrics",
    },
    pages: {
      home: "/",
      dashboard: "/dashboard",
      explorer: "/explorer",
    },
  };

  // Overall status
  const allRpcOperational = rpcChecks.every(r => r.status === "operational");
  metrics.status = allRpcOperational && contractStatus === "deployed" ? "operational" : "degraded";

  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-cache, no-store",
      "X-Response-Time": `${Date.now() - startTime}ms`,
    }
  });
}
