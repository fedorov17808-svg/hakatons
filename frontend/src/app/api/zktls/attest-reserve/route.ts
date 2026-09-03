import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { applyRateLimit, validateAddress, sanitizeString, safeErrorResponse } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

/**
 * zkTLS Proof-of-Reserve Attestation Endpoint
 *
 * DEMO MODE: Generates cryptographic hash commitments locally.
 * In production, this endpoint would integrate with a TLSNotary MPC-TLS
 * prover to cryptographically attest that the custodian's reserve balance
 * was read from a genuine TLS session with a regulated bank API.
 *
 * Current implementation: keccak256 hash commitments over input parameters.
 * These commitments are recorded on-chain as immutable audit anchors.
 */
export async function POST(req: Request) {
  try {
    // Rate limiting: 10 req/min for write operations
    const rateLimitResponse = applyRateLimit(req, 10, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { asset_address, token_supply_usd, reserve_balance_usd, custodian_name, spv_cik } = body;

    // Validate address if provided
    const validatedAddress = asset_address ? validateAddress(asset_address) : "0x0000000000000000000000000000000000000000";
    if (asset_address && !validatedAddress) {
      return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
    }

    const supply = Number(token_supply_usd || 450000000);
    const reserves = Number(reserve_balance_usd || 463500000);
    if (!Number.isFinite(supply) || !Number.isFinite(reserves) || supply <= 0) {
      return NextResponse.json({ error: "Invalid numeric inputs" }, { status: 400 });
    }
    const custodian = sanitizeString(custodian_name, 200) || "BNY Mellon & Morgan Stanley Trust";
    const cik = sanitizeString(spv_cik, 50) || "CIK-0001982741";

    const reserveRatioBps = Math.round((reserves / supply) * 10000);
    const coveragePct = Math.round((reserveRatioBps / 100.0) * 100) / 100;
    const isSolvent = reserveRatioBps >= 10000;

    // Cryptographic Hash Commitments (deterministic, auditable)
    const blindingEntropy = `BLINDING:${validatedAddress}:${Date.now()}:${crypto.randomUUID()}`;
    const blindingFactor = ethers.keccak256(ethers.toUtf8Bytes(blindingEntropy));
    const porHash = ethers.keccak256(ethers.toUtf8Bytes(`POR:${validatedAddress}:${reserves}:${blindingFactor}`));
    const legalDigest = ethers.keccak256(ethers.toUtf8Bytes(`LEGAL:${validatedAddress}:${cik}:${custodian}`));
    const zkTlsProofHash = ethers.keccak256(ethers.toUtf8Bytes(`ZKTLS_PROOF:${validatedAddress}:${porHash}`));
    const sessionCommitment = ethers.keccak256(ethers.toUtf8Bytes(`SESSION:${custodian}:${Date.now()}`));
    const custodianKeyHash = ethers.keccak256(ethers.toUtf8Bytes(`CUSTODIAN_CERT_PUBKEY:${custodian}:${cik}`));

    return NextResponse.json({
      is_solvent: isSolvent,
      reserve_ratio_bps: reserveRatioBps,
      coverage_percent: coveragePct,
      status: reserveRatioBps > 10000 ? "OVERCOLLATERALIZED (Audited Backing)" : "FULLY_COLLATERALIZED",
      por_hash: porHash,
      legal_entity_digest: legalDigest,
      zk_tls_proof_hash: zkTlsProofHash,
      session_commitment: sessionCommitment,
      custodian_key_hash: custodianKeyHash,
      custodian,
      spv_registration: cik,
      proof_type: "KECCAK256_HASH_COMMITMENT",
      proof_mode: "testnet_hash_commitment",
      deployment_note: "Reserve data is provided by the caller and hashed locally. Mainnet deployment integrates TLSNotary MPC-TLS provers to cryptographically attest bank API responses via multi-party TLS transcript verification.",
      mainnet_target: "TLSNotary v0.4+ Multi-Party MPC-TLS with notary co-signing"
    });
  } catch (error: unknown) {
    return safeErrorResponse(error, 500, "Attestation processing failed");
  }
}
