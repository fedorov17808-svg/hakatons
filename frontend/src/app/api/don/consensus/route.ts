import { applyRateLimit } from "@/lib/apiSecurity";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { generateDONPackedQuorumSignatures, generateDONQuorumSignatures } from "@/lib/donSigners";

export const dynamic = "force-dynamic";

import { CONTRACT_ADDRESS } from "@/lib/config";

/**
 * DON Node endpoints — real HTTP calls to independent validator servers.
 * Each node independently verifies scores and signs attestations.
 * Falls back to local deterministic signing only if all nodes are unreachable.
 */
const DON_NODE_ENDPOINTS = [
  process.env.DON_NODE_ALPHA_URL || "http://127.0.0.1:8011",
  process.env.DON_NODE_BETA_URL  || "http://127.0.0.1:8012",
  process.env.DON_NODE_GAMMA_URL || "http://127.0.0.1:8013",
];

const DON_API_KEY = process.env.DON_API_KEY || "";

interface NodeAttestation {
  signer_address: string;
  signature: string;
  message_hash: string;
  node_id: string;
  node_latency_ms: number;
  sources_used?: string[];
}

/**
 * Call a single DON node to get its independent attestation.
 * Each node independently fetches data, verifies scores, and signs.
 */
async function fetchNodeAttestation(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<NodeAttestation | null> {
  const startTime = performance.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (DON_API_KEY) headers["X-DON-API-Key"] = DON_API_KEY;

    const resp = await fetch(`${endpoint}/sign_attestation`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // 15s timeout per node
    });

    const latency = Math.round(performance.now() - startTime);

    if (resp.ok) {
      const data = await resp.json();
      return { ...data, node_latency_ms: latency };
    }
    console.warn(`DON node ${endpoint} returned ${resp.status}`);
    return null;
  } catch (e) {
    const latency = Math.round(performance.now() - startTime);
    console.warn(`DON node ${endpoint} unreachable (${latency}ms):`, (e as Error).message);
    return null;
  }
}

/**
 * Attempt distributed DON consensus via real HTTP calls to independent nodes.
 * Returns null if quorum cannot be reached (fewer nodes respond than required).
 */
async function attemptDistributedConsensus(
  payload: Record<string, unknown>,
  minQuorum: number
): Promise<{
  signers: string[];
  signatures: string[];
  messageHash: string;
  nodeLatencies: number[];
  sourcesPerNode: string[][];
  nodesResponded: number;
} | null> {
  // Fetch attestations from all nodes in parallel
  const results = await Promise.all(
    DON_NODE_ENDPOINTS.map(ep => fetchNodeAttestation(ep, payload))
  );

  const attestations = results.filter((r): r is NodeAttestation => r !== null);

  if (attestations.length < minQuorum) {
    return null; // Not enough nodes responded
  }

  // Sort by signer address (ascending) to match CreditPulseASC.sol verification
  const selected = attestations
    .slice(0, minQuorum)
    .sort((a, b) => a.signer_address.toLowerCase().localeCompare(b.signer_address.toLowerCase()));

  return {
    signers: selected.map(a => a.signer_address),
    signatures: selected.map(a => a.signature),
    messageHash: selected[0].message_hash,
    nodeLatencies: selected.map(a => a.node_latency_ms),
    sourcesPerNode: selected.map(a => a.sources_used || []),
    nodesResponded: attestations.length,
  };
}

export async function POST(req: Request) {
  const rl = applyRateLimit(req, 10, 60_000); if (rl) return rl;
  try {
    const body = await req.json();
    const {
      address: targetAddr,
      score,
      liquidity,
      collateral,
      audit,
      security,
      volatility,
      governance,
      data_hash,
      ai_digest,
      quorum = 2,
      format = "packed"
    } = body;

    if (!targetAddr) {
      return NextResponse.json({ detail: "Target asset address is required" }, { status: 400 });
    }

    const checksumTarget = ethers.getAddress(targetAddr);
    const scoreVector = [
      Math.round(score || 0),
      Math.round(liquidity || 0),
      Math.round(collateral || 0),
      Math.round(audit || 0),
      Math.round(security || 0),
      Math.round(volatility || 0),
      Math.round(governance || 0)
    ];

    const dataHashBytes = data_hash && data_hash.startsWith("0x") && data_hash.length === 66
      ? data_hash
      : ethers.keccak256(ethers.toUtf8Bytes(checksumTarget));

    const aiDigestBytes = ai_digest && ai_digest.startsWith("0x") && ai_digest.length === 66
      ? ai_digest
      : ethers.keccak256(ethers.toUtf8Bytes(`DIGEST:${checksumTarget}:${scoreVector[0]}`));

    // Clamp to [1, 3]: there are only 3 DON nodes, and an unbounded/negative value
    // would make quorum-reached checks and array slicing behave incorrectly.
    const minQuorum = Math.min(3, Math.max(1, Math.round(Number(quorum)) || 2));

    // ── Phase 1: Attempt REAL distributed consensus via HTTP ──
    const distributedPayload = {
      asset_address: checksumTarget,
      scores: {
        overall: scoreVector[0],
        liquidity: scoreVector[1],
        collateral: scoreVector[2],
        audit: scoreVector[3],
        security: scoreVector[4],
        volatility_score: scoreVector[5],
        governance: scoreVector[6],
      },
      data_hash: dataHashBytes,
      snapshot_time: Math.floor(Date.now() / 1000),
    };

    const distributed = await attemptDistributedConsensus(distributedPayload, minQuorum);

    if (distributed) {
      // ✅ Real distributed consensus achieved!
      return NextResponse.json({
        success: true,
        consensus_status: "DISTRIBUTED_BFT_QUORUM",
        consensus_mode: "DISTRIBUTED",
        quorum: minQuorum,
        quorumReached: true,
        signers: distributed.signers,
        signatures: distributed.signatures,
        message_hash: distributed.messageHash,
        data_hash: dataHashBytes,
        ai_digest: aiDigestBytes,
        scores: scoreVector,
        node_latencies_ms: distributed.nodeLatencies,
        nodes_responded: distributed.nodesResponded,
        nodes_configured: DON_NODE_ENDPOINTS.length,
        independent_sources: distributed.sourcesPerNode,
        contract_address: CONTRACT_ADDRESS,
        chain_id: 102031,
        network: "Creditcoin Testnet CC3"
      });
    }

    // ── Phase 2: Fallback to local deterministic signing ──
    // Backend DON nodes are unreachable — use local key derivation.
    // This is clearly marked as LOCAL_FALLBACK for transparency.
    const payload = {
      assetAddress: checksumTarget,
      overallScore: scoreVector[0],
      liquidity: scoreVector[1],
      collateral: scoreVector[2],
      auditScore: scoreVector[3],
      security: scoreVector[4],
      volatility: scoreVector[5],
      governance: scoreVector[6],
      dataHash: dataHashBytes,
      aiDigest: aiDigestBytes
    };

    if (format === "eip712") {
      const result = await generateDONQuorumSignatures(payload, minQuorum);
      return NextResponse.json({
        success: true,
        consensus_status: "LOCAL_FALLBACK_QUORUM",
        consensus_mode: "LOCAL_DETERMINISTIC",
        fallback_reason: "DON nodes unreachable — using local key derivation for testnet compatibility",
        quorum: minQuorum,
        quorumReached: result.quorumReached,
        signers: result.signers,
        signatures: result.signatures,
        data_hash: dataHashBytes,
        ai_digest: aiDigestBytes,
        contract_address: CONTRACT_ADDRESS,
        chain_id: 102031
      });
    }

    const result = await generateDONPackedQuorumSignatures(payload, minQuorum);

    return NextResponse.json({
      success: true,
      consensus_status: "LOCAL_FALLBACK_QUORUM",
      consensus_mode: "LOCAL_DETERMINISTIC",
      fallback_reason: "DON nodes unreachable — using local key derivation for testnet compatibility",
      quorum: minQuorum,
      quorumReached: result.quorumReached,
      signers: result.signers,
      signatures: result.signatures,
      message_hash: result.messageHash,
      data_hash: dataHashBytes,
      ai_digest: aiDigestBytes,
      scores: scoreVector,
      contract_address: CONTRACT_ADDRESS,
      chain_id: 102031,
      network: "Creditcoin Testnet CC3"
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "DON Consensus aggregation error";
    console.error("DON consensus error:", message);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
