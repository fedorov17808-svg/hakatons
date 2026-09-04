import { applyRateLimit, validateAddress } from "@/lib/apiSecurity";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { CC3_RPC, CONTRACT_ADDRESS, RELAYER_PK, PRECOMPILE_ADDRESS } from "@/lib/config";

export const dynamic = "force-dynamic";

const PROOF_BUILDER_URL = "https://prover.cc3-testnet.creditcoin.network";
const PROOF_FETCH_TIMEOUT_MS = 8000;
const MIN_RELAYER_BALANCE = ethers.parseEther("0.001");
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

// Matches saveVerifiedRiskReport on the verified CreditPulseASC deployment
// (contracts/contracts/CreditPulseScore.sol) — binds a cross-chain Merkle +
// continuity proof via the native Creditcoin CC3 Query Verifier Precompile (0x0FD2).
const ASC_VERIFIED_ABI = [
  "function saveVerifiedRiskReport(address _assetAddress, uint8[7] _scores, bytes32 _dataHash, bytes32 _aiDigest, uint64 _chainKey, uint64[] _headerNumbers, bytes[] _encodedTransactions, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings)[] _merkleProofs, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) _continuityProof) external returns (bytes32 queryId)"
];

interface ProverMerkleSibling { hash: string; isLeft: boolean; }
interface ProverTxProof { txBytes: string; merkleProof: { root: string; siblings: ProverMerkleSibling[] }; }
interface ProverProofBatch {
  chainKey: number;
  fromHeader: number;
  merkleProofs: Record<string, Record<string, ProverTxProof>>;
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
}

interface ProofArgs {
  chainKey: number;
  headerNumbers: number[];
  encodedTransactions: string[];
  merkleProofs: { root: string; siblings: { hash: string; isLeft: boolean }[] }[];
  continuityProof: { lowerEndpointDigest: string; roots: string[] };
}

function clampScore(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isBytes32(v: unknown): v is string {
  return typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);
}

async function fetchProofBatch(txHash: string, chainKey = 1): Promise<ProverProofBatch | null> {
  try {
    const res = await fetch(`${PROOF_BUILDER_URL}/api/v1/proof-batch-by-tx/${chainKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([txHash]),
      signal: AbortSignal.timeout(PROOF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as ProverProofBatch;
  } catch (e) {
    console.warn("CC3 Proof Builder unreachable:", (e as Error).message);
    return null;
  }
}

// Reshapes the raw prover response into the exact struct order saveVerifiedRiskReport expects.
function buildProofArgs(batch: ProverProofBatch): ProofArgs | null {
  try {
    const blockNum = Number(batch.fromHeader);
    const merkleForBlock = batch.merkleProofs[String(blockNum)];
    const txKey = Object.keys(merkleForBlock)[0];
    const txProof = merkleForBlock[txKey];
    if (!txProof?.txBytes || !txProof.merkleProof?.root) return null;

    return {
      chainKey: Number(batch.chainKey),
      headerNumbers: [blockNum],
      encodedTransactions: [txProof.txBytes],
      merkleProofs: [{
        root: txProof.merkleProof.root,
        siblings: txProof.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: !!s.isLeft })),
      }],
      continuityProof: {
        lowerEndpointDigest: batch.continuityProof.lowerEndpointDigest,
        roots: batch.continuityProof.roots,
      },
    };
  } catch (e) {
    console.warn("Malformed proof batch from CC3 Proof Builder:", (e as Error).message);
    return null;
  }
}

function describeRevert(err: unknown): string {
  const e = err as { reason?: string; shortMessage?: string; message?: string };
  const raw = e.reason || e.shortMessage || e.message || "unknown error";
  if (/already used|already registered/i.test(raw)) {
    return "This exact cross-chain proof is already bound on-chain (replay-protection: queryId already registered on CreditPulseASC).";
  }
  return `On-chain broadcast rejected: ${raw.slice(0, 200)}`;
}

export async function POST(req: Request) {
  const rl = applyRateLimit(req, 10, 60_000); if (rl) return rl;
  try {
    const body = await req.json();
    const {
      address: rawAddr,
      score, liquidity, collateral, audit, security, volatility, governance,
      data_hash, ai_digest, source_tx_hash,
    } = body;

    const targetAddr = validateAddress(rawAddr);
    if (!targetAddr) {
      return NextResponse.json({ detail: "A valid EVM asset address is required" }, { status: 400 });
    }
    if (typeof source_tx_hash !== "string" || !TX_HASH_REGEX.test(source_tx_hash)) {
      return NextResponse.json({ detail: "Invalid source_tx_hash. Expected 66-character hex (0x...)" }, { status: 400 });
    }

    const checksumTarget = ethers.getAddress(targetAddr);
    const validScore = clampScore(score, 85);
    const scoresArray: [number, number, number, number, number, number, number] = [
      validScore,
      clampScore(liquidity, validScore),
      clampScore(collateral, validScore),
      clampScore(audit, validScore),
      clampScore(security, validScore),
      clampScore(volatility, validScore),
      clampScore(governance, validScore),
    ];
    const dataHash = isBytes32(data_hash) ? data_hash : ethers.keccak256(ethers.toUtf8Bytes(checksumTarget));
    const aiDigest = isBytes32(ai_digest) ? ai_digest : ethers.ZeroHash;

    let provider: ethers.JsonRpcProvider | null = null;
    let blockHeight = 0;
    try {
      provider = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
      blockHeight = await provider.getBlockNumber();
    } catch (e) { console.warn("CC3 RPC unreachable:", (e as Error).message); }

    const proofBatch = await fetchProofBatch(source_tx_hash);
    const proofArgs = proofBatch ? buildProofArgs(proofBatch) : null;

    let realTxHash: string | null = null;
    let executionMode = "Precompile-Linked Cryptographic Attestation (Off-Chain Fallback)";
    let degradeReason: string | null = null;

    if (!proofBatch) {
      degradeReason = "CC3 Proof Builder (prover.cc3-testnet.creditcoin.network) was unreachable or has no proof for this transaction yet.";
    } else if (!proofArgs) {
      degradeReason = "CC3 Proof Builder returned a proof in an unexpected format.";
    }

    if (proofArgs && provider && RELAYER_PK && /^0x[a-fA-F0-9]{64}$/.test(RELAYER_PK)) {
      try {
        const wallet = new ethers.Wallet(RELAYER_PK, provider);
        const balance = await provider.getBalance(wallet.address);
        if (balance > MIN_RELAYER_BALANCE) {
          const contract = new ethers.Contract(CONTRACT_ADDRESS, ASC_VERIFIED_ABI, wallet);
          const tx = await contract.saveVerifiedRiskReport(
            checksumTarget,
            scoresArray,
            dataHash,
            aiDigest,
            proofArgs.chainKey,
            proofArgs.headerNumbers,
            proofArgs.encodedTransactions,
            proofArgs.merkleProofs,
            proofArgs.continuityProof
          );
          realTxHash = tx.hash;
          executionMode = "Live Creditcoin CC3 Precompile Broadcast (0x0FD2)";
        } else {
          degradeReason = "Relayer wallet has insufficient CC3 testnet balance to broadcast.";
        }
      } catch (txErr: unknown) {
        degradeReason = describeRevert(txErr);
        console.warn("saveVerifiedRiskReport broadcast failed:", txErr);
      }
    } else if (proofArgs && !RELAYER_PK) {
      degradeReason = "No relayer key is configured on the server for direct broadcast.";
    }

    // Off-chain fallback: a deterministic commitment, never presented as a real tx hash.
    const attestationCommitment = realTxHash || ethers.keccak256(
      ethers.solidityPacked(
        ["address", "bytes32", "uint256", "bytes32"],
        [checksumTarget, source_tx_hash, blockHeight, dataHash]
      )
    );

    return NextResponse.json({
      success: true,
      status: realTxHash ? "SUCCESS_ONCHAIN_VERIFIED" : "SUCCESS_OFFCHAIN_ATTESTATION",
      isOnchainBroadcast: !!realTxHash,
      executionMode,
      txHash: attestationCommitment,
      onchainTxHash: realTxHash,
      source_tx_hash,
      asset_address: checksumTarget,
      contract_address: CONTRACT_ADDRESS,
      chain_id: 102031,
      network: "Creditcoin Testnet CC3",
      block_height: blockHeight,
      precompile_reference: PRECOMPILE_ADDRESS,
      proof_source: proofArgs ? "live_cc3_prover" : "unavailable",
      ...(degradeReason && { deployment_note: degradeReason }),
      explorer_url: realTxHash
        ? `https://creditcoin-testnet.blockscout.com/tx/${realTxHash}`
        : `https://creditcoin-testnet.blockscout.com/address/${CONTRACT_ADDRESS}`,
      provenance: {
        proof_hash: attestationCommitment,
        target_asset: checksumTarget,
        scores: scoresArray,
        data_hash: dataHash,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Record verified error";
    console.error("API record-verified error:", message);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
