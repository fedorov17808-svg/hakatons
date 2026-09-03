import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getDONValidatorNodes } from "@/lib/donSigners";
import { CC3_RPC, CONTRACT_ADDRESS } from "@/lib/config";
import { applyRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

/**
 * DON Node endpoints for real health checks.
 * Each node is an independent FastAPI server running on a separate port.
 */
const DON_NODE_ENDPOINTS = [
  { url: process.env.DON_NODE_ALPHA_URL || "http://127.0.0.1:8011", fallbackIndex: 0 },
  { url: process.env.DON_NODE_BETA_URL  || "http://127.0.0.1:8012", fallbackIndex: 1 },
  { url: process.env.DON_NODE_GAMMA_URL || "http://127.0.0.1:8013", fallbackIndex: 2 },
];

const DON_API_KEY = process.env.DON_API_KEY || "";

interface RealNodeHealth {
  node_id: string;
  name: string;
  address: string;
  region: string;
  status: string;
  health: string;
  version: string;
  latency_ms: number;
  last_attestation_block: number;
  role: string;
  source: "LIVE_NODE" | "LOCAL_FALLBACK";
  uptime_seconds?: number;
  attestations_signed?: number;
}

/**
 * Fetch real health status from a DON node via HTTP.
 */
async function fetchNodeHealth(endpoint: string): Promise<Record<string, unknown> | null> {
  const startTime = performance.now();
  try {
    const headers: Record<string, string> = {};
    if (DON_API_KEY) headers["X-DON-API-Key"] = DON_API_KEY;

    const resp = await fetch(`${endpoint}/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    const latency = Math.round((performance.now() - startTime) * 10) / 10;

    if (resp.ok) {
      const data = await resp.json();
      return { ...data, measured_latency_ms: latency, reachable: true };
    }
    return { reachable: false, measured_latency_ms: latency };
  } catch {
    const latency = Math.round((performance.now() - startTime) * 10) / 10;
    return { reachable: false, measured_latency_ms: latency };
  }
}

export async function GET(req: Request) {
  const rateLimitResponse = applyRateLimit(req, 30, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  // Get CC3 block height
  const startT = performance.now();
  let activeBlock = 0;
  let cc3Latency = 0;
  let rpcOnline = true;

  try {
    const provider = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
    activeBlock = await provider.getBlockNumber();
    cc3Latency = Math.round((performance.now() - startT) * 10) / 10;
  } catch {
    rpcOnline = false;
    cc3Latency = Math.round((performance.now() - startT) * 10) / 10;
  }

  // Fetch real health from all DON nodes in parallel
  const healthResults = await Promise.all(
    DON_NODE_ENDPOINTS.map(ep => fetchNodeHealth(ep.url))
  );

  const validatorNodes = getDONValidatorNodes();
  const roles = [
    "Primary Block Prover & EIP-712 Signer",
    "Secondary Consensus Validator",
    "Quorum Witness & Dispute Monitor"
  ];

  const nodes: RealNodeHealth[] = healthResults.map((health, i) => {
    const fallback = validatorNodes[DON_NODE_ENDPOINTS[i].fallbackIndex];
    const isReachable = health?.reachable === true;

    if (isReachable && health) {
      // ✅ REAL node responded — use its actual data
      return {
        node_id: (health.node_id as string) || fallback.node_id,
        name: (health.name as string) || fallback.name,
        address: (health.signer_address as string) || fallback.address,
        region: (health.region as string) || fallback.region,
        status: "ONLINE",
        health: "OPTIMAL",
        version: (health.version as string) || "8.5.0",
        latency_ms: health.measured_latency_ms as number,
        last_attestation_block: (health.last_block as number) || activeBlock,
        role: roles[i],
        source: "LIVE_NODE" as const,
        uptime_seconds: health.uptime_seconds as number | undefined,
        attestations_signed: health.attestations_signed as number | undefined,
      };
    }

    // ❌ Node unreachable — show as OFFLINE with fallback metadata
    return {
      node_id: fallback.node_id,
      name: fallback.name,
      address: fallback.address,
      region: fallback.region,
      status: "OFFLINE",
      health: "UNREACHABLE",
      version: "8.5.0",
      latency_ms: (health?.measured_latency_ms as number) || 0,
      last_attestation_block: 0,
      role: roles[i],
      source: "LOCAL_FALLBACK" as const,
    };
  });

  const onlineCount = nodes.filter(n => n.status === "ONLINE").length;
  const liveNodes = nodes.filter(n => n.source === "LIVE_NODE").length;

  let clusterHealth: string;
  let deploymentMode: string;

  if (liveNodes >= 2) {
    clusterHealth = "OPTIMAL";
    deploymentMode = "DISTRIBUTED_MULTI_NODE";
  } else if (liveNodes === 1) {
    clusterHealth = "DEGRADED";
    deploymentMode = "PARTIAL_DISTRIBUTED";
  } else if (rpcOnline) {
    clusterHealth = "LOCAL_ONLY";
    deploymentMode = "LOCAL_DETERMINISTIC_FALLBACK";
  } else {
    clusterHealth = "OFFLINE";
    deploymentMode = "NO_CONNECTIVITY";
  }

  return NextResponse.json({
    total_nodes: 3,
    online_nodes: onlineCount,
    live_distributed_nodes: liveNodes,
    required_quorum: 2,
    cluster_health: clusterHealth,
    consensus_standard: "BFT Threshold Quorum (2-of-3 ECDSA Non-Malleable)",
    deployment_mode: deploymentMode,
    nodes,
    block_height: activeBlock,
    cc3_rpc_latency_ms: cc3Latency,
    network: "Creditcoin Testnet CC3 (Chain ID 102031)",
    contract_address: CONTRACT_ADDRESS,
    timestamp: Math.floor(Date.now() / 1000)
  });
}
