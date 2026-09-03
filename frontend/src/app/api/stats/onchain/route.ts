import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { applyRateLimit, safeErrorResponse } from "@/lib/apiSecurity";
import { CC3_RPC, CONTRACT_ADDRESS, CONTRACT_ABI, PROTOCOL_VERSION } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Rate limiting: 60 req/min for read-only stats
  const rateLimitResponse = applyRateLimit(req, 60, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const start = performance.now();

  // All values start as null — never return fake data
  let blockNumber: number | null = null;
  let totalReports: number | null = null;
  let verifiedProofs: number | null = null;
  let totalStake: string | null = null;
  let insurancePool: string | null = null;
  let quorum: number | null = null;
  let rpcConnected = false;
  let rpcError: string | null = null;

  try {
    const provider = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
    const contract = new ethers.Contract(CONTRACT_ADDRESS, [
      ...CONTRACT_ABI,
      "function requiredOracleQuorum() external view returns (uint8)"
    ], provider);

    const [bn, rc, vpc, ts, ip, rq] = await Promise.all([
      provider.getBlockNumber(),
      contract.reportCount(),
      contract.verifiedProofCount(),
      contract.totalOracleStake(),
      contract.totalInsurancePool(),
      contract.requiredOracleQuorum()
    ]);

    blockNumber = bn;
    totalReports = Number(rc);
    verifiedProofs = Number(vpc);
    totalStake = ethers.formatEther(ts);
    insurancePool = ethers.formatEther(ip);
    quorum = Number(rq);
    rpcConnected = true;
  } catch (e) {
    rpcError = "RPC connection failed";
    console.warn("Onchain stats RPC failed:", (e as Error).message?.slice(0, 200));
  }

  const rpcLatencyMs = Math.round((performance.now() - start) * 10) / 10;

  return NextResponse.json({
    rpc_connected: rpcConnected,
    rpc_error: rpcError,
    total_reports_onchain: totalReports,
    verified_cross_chain_proofs: verifiedProofs,
    total_oracle_stake_ctc: totalStake,
    insurance_pool_ctc: insurancePool,
    required_quorum: quorum,
    block_number: blockNumber,
    contract_address: CONTRACT_ADDRESS,
    network: "Creditcoin Testnet CC3 (Chain ID 102031)",
    protocol_version: PROTOCOL_VERSION,
    rpc_latency_ms: rpcLatencyMs,
    blockscout_url: `https://creditcoin-testnet.blockscout.com/address/${CONTRACT_ADDRESS}`,
    timestamp: Math.floor(Date.now() / 1000)
  });
}
