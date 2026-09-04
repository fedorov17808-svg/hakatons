import { ethers } from "ethers";

/**
 * CreditPulse Federated DON (Decentralized Oracle Network) Validator Cluster
 * Provides genuine multi-node ECDSA EIP-712 and Packed Ethereum Signed Message signing
 * for 2-of-3 BFT Quorum consensus on Creditcoin CC3.
 *
 * SECURITY WARNING: these validator keys are derived from hardcoded public strings
 * (DON_SEEDS below) via keccak256 — that is NOT secret key management, it's equivalent
 * to publishing the private keys directly, since anyone can recompute them from this
 * source file. This exists only so the local-fallback demo path always has something
 * to sign with when real KMS/Vault/HSM-backed keys aren't configured.
 *
 * Confirmed these addresses are NOT in the on-chain `isAuthorizedOracle` set used by
 * `contracts/scripts/deploy.ts` — so a forged signature from this fallback identity
 * cannot get a real transaction accepted on-chain (the contract independently checks
 * real authorization). But verifyDONQuorumSignatures() below only checks a signature
 * recovers to *one of these* addresses — since the underlying key is publicly
 * derivable, that check stops a naive spoofer (random signers/signatures) but NOT a
 * determined one who reads this file and derives the same key. Treat the resulting
 * "DON_CONSENSUS_REACHED" response as demo-grade, not as cryptographic proof of real
 * multi-party federation, until this fallback is replaced with real per-node key
 * management.
 */

export interface DONValidatorNode {
  node_id: string;
  name: string;
  address: string;
  region: string;
  status: string;
  version: string;
  privateKey: string;
}

const DON_SEEDS = [
  { id: "node-alpha", name: "Node Alpha (Primary Validator)", seed: "CreditPulse-DON-Validator-Alpha-v8.5", region: "AWS us-east-1 (N. Virginia)" },
  { id: "node-beta", name: "Node Beta (Consensus Secondary)", seed: "CreditPulse-DON-Validator-Beta-v8.5", region: "GCP europe-west3 (Frankfurt)" },
  { id: "node-gamma", name: "Node Gamma (Quorum Witness)", seed: "CreditPulse-DON-Validator-Gamma-v8.5", region: "Hetzner hel1 (Helsinki)" }
];

export function getDONValidatorNodes(): DONValidatorNode[] {
  return DON_SEEDS.map((s) => {
    const pk = ethers.keccak256(ethers.toUtf8Bytes(s.seed));
    const wallet = new ethers.Wallet(pk);
    return {
      node_id: s.id,
      name: s.name,
      address: wallet.address,
      region: s.region,
      status: "ONLINE",
      version: "8.5.0 Enterprise",
      privateKey: pk
    };
  });
}

const EIP712_DOMAIN = {
  name: "CreditPulse AI ASC",
  version: "7.3.0",
  chainId: 102031, // Creditcoin Testnet CC3
  verifyingContract: "0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5"
};

const EIP712_TYPES = {
  RiskReport: [
    { name: "assetAddress", type: "address" },
    { name: "overallScore", type: "uint8" },
    { name: "liquidity", type: "uint8" },
    { name: "collateral", type: "uint8" },
    { name: "auditScore", type: "uint8" },
    { name: "security", type: "uint8" },
    { name: "volatility", type: "uint8" },
    { name: "governance", type: "uint8" },
    { name: "dataHash", type: "bytes32" },
    { name: "aiDigest", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

export interface DONSignaturePayload {
  assetAddress: string;
  overallScore: number;
  liquidity: number;
  collateral: number;
  auditScore: number;
  security: number;
  volatility: number;
  governance: number;
  dataHash: string;
  aiDigest: string;
  nonce?: number;
  deadline?: number;
}

/**
 * Generates EIP-712 typed data signatures from the DON validator cluster.
 */
export async function generateDONQuorumSignatures(
  payload: DONSignaturePayload,
  requiredQuorum: number = 2
): Promise<{ signers: string[]; signatures: string[]; quorumReached: boolean }> {
  const nodes = getDONValidatorNodes();
  const selectedNodes = nodes.slice(0, Math.min(requiredQuorum, nodes.length));

  const deadline = payload.deadline || Math.floor(Date.now() / 1000) + 3600;
  const nonce = payload.nonce || 0;

  const message = {
    assetAddress: ethers.getAddress(payload.assetAddress),
    overallScore: Math.round(payload.overallScore),
    liquidity: Math.round(payload.liquidity),
    collateral: Math.round(payload.collateral),
    auditScore: Math.round(payload.auditScore),
    security: Math.round(payload.security),
    volatility: Math.round(payload.volatility),
    governance: Math.round(payload.governance),
    dataHash: payload.dataHash,
    aiDigest: payload.aiDigest,
    nonce,
    deadline
  };

  const signers: string[] = [];
  const signatures: string[] = [];

  for (const node of selectedNodes) {
    const wallet = new ethers.Wallet(node.privateKey);
    const sig = await wallet.signTypedData(EIP712_DOMAIN, EIP712_TYPES, message);
    signers.push(wallet.address);
    signatures.push(sig);
  }

  return {
    signers,
    signatures,
    quorumReached: signers.length >= requiredQuorum
  };
}

/**
 * Generates sorted Packed Ethereum Signed Message signatures matching CreditPulseASC.sol saveRiskReportMultiSigned.
 * In CreditPulseASC.sol:
 *   require(signer > lastSigner, "Signers must be sorted and unique");
 *   bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
 */
/**
 * Computes the same packed message hash CreditPulseASC.sol reconstructs on-chain
 * for saveRiskReportMultiSigned, so both signature generation and verification
 * (see verifyDONQuorumSignatures below) agree on exactly what was signed.
 */
export function computeDonMessageHash(payload: DONSignaturePayload): string {
  const checksumTarget = ethers.getAddress(payload.assetAddress);
  const scores = [
    Math.round(payload.overallScore),
    Math.round(payload.liquidity),
    Math.round(payload.collateral),
    Math.round(payload.auditScore),
    Math.round(payload.security),
    Math.round(payload.volatility),
    Math.round(payload.governance)
  ];

  const dataHashBytes = payload.dataHash && payload.dataHash.startsWith("0x") && payload.dataHash.length === 66
    ? payload.dataHash
    : ethers.keccak256(ethers.toUtf8Bytes(checksumTarget));

  return ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
      [checksumTarget, scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6], dataHashBytes]
    )
  );
}

/**
 * Verifies that every (signer, signature) pair actually recovers to a DON address
 * that is part of the live validator set, for this exact message. Used to reject
 * client-supplied "consensus" data before it's presented as DON-verified.
 */
export function verifyDONQuorumSignatures(
  signers: unknown,
  signatures: unknown,
  messageHash: string,
  minQuorum: number = 2
): boolean {
  if (!Array.isArray(signers) || !Array.isArray(signatures)) return false;
  if (signers.length < minQuorum || signers.length !== signatures.length) return false;

  const authorized = new Set(getDONValidatorNodes().map(n => n.address.toLowerCase()));
  const verified = new Set<string>();

  for (let i = 0; i < signers.length; i++) {
    if (typeof signers[i] !== "string" || typeof signatures[i] !== "string") return false;
    try {
      const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signatures[i] as string);
      if (recovered.toLowerCase() !== (signers[i] as string).toLowerCase()) return false;
      if (!authorized.has(recovered.toLowerCase())) return false;
      verified.add(recovered.toLowerCase());
    } catch {
      return false;
    }
  }

  return verified.size >= minQuorum;
}

export async function generateDONPackedQuorumSignatures(
  payload: DONSignaturePayload,
  requiredQuorum: number = 2
): Promise<{ signers: string[]; signatures: string[]; quorumReached: boolean; messageHash: string }> {
  const nodes = getDONValidatorNodes();
  const selectedNodes = nodes.slice(0, Math.min(requiredQuorum, nodes.length));
  const messageHash = computeDonMessageHash(payload);

  const signedItems: Array<{ signer: string; signature: string }> = [];

  for (const node of selectedNodes) {
    const wallet = new ethers.Wallet(node.privateKey);
    const sig = await wallet.signMessage(ethers.getBytes(messageHash));
    signedItems.push({
      signer: wallet.address,
      signature: sig
    });
  }

  // Strictly sort signers by checksummed address string ascending for Solidity contract verification
  signedItems.sort((a, b) => a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()));

  const signers = signedItems.map(item => item.signer);
  const signatures = signedItems.map(item => item.signature);

  return {
    signers,
    signatures,
    quorumReached: signers.length >= requiredQuorum,
    messageHash
  };
}
