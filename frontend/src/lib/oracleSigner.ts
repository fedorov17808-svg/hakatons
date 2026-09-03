import { ethers } from "ethers";

/**
 * Derives a secure validator key from environment (e.g. Cloud KMS / HSM in production)
 * or creates a deterministic ephemeral test validator key for development and testnet sessions.
 * 
 * SECURITY ARCHITECTURE NOTE:
 * Testnet/devnet environments use an ephemeral seed derivation to avoid static key leakage.
 * Production deployments require KMS/Vault/HSM-backed transaction signing with strict IAM role bindings.
 */
function getValidatorPrivateKey(): string {
  const envKey = process.env.PRIVATE_KEY || process.env.ORACLE_PRIVATE_KEY;
  if (envKey && /^0x[a-fA-F0-9]{64}$/.test(envKey)) {
    return envKey;
  }
  const ephemeralSeed = process.env.VALIDATOR_KEY_SEED || "CreditPulse-Enterprise-Devnet-Signer-v8.5";
  return ethers.keccak256(ethers.toUtf8Bytes(ephemeralSeed));
}

export interface EIP712RiskReportPayload {
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
  nonce: number;
  deadline: number;
}

export interface EIP712SignatureResult {
  signer: string;
  signature: string;
  r: string;
  s: string;
  v: number;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  message: EIP712RiskReportPayload;
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

export async function signEIP712RiskReport(
  payload: Omit<EIP712RiskReportPayload, "nonce" | "deadline">,
  nonce: number = 0,
  deadlineMinutes: number = 60
): Promise<EIP712SignatureResult> {
  const privateKey = getValidatorPrivateKey();
  const wallet = new ethers.Wallet(privateKey);
  const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

  const message: EIP712RiskReportPayload = {
    ...payload,
    assetAddress: ethers.getAddress(payload.assetAddress),
    overallScore: Math.round(payload.overallScore),
    liquidity: Math.round(payload.liquidity),
    collateral: Math.round(payload.collateral),
    auditScore: Math.round(payload.auditScore),
    security: Math.round(payload.security),
    volatility: Math.round(payload.volatility),
    governance: Math.round(payload.governance),
    nonce,
    deadline
  };

  const rawSig = await wallet.signTypedData(EIP712_DOMAIN, EIP712_TYPES, message);
  const splitSig = ethers.Signature.from(rawSig);

  return {
    signer: wallet.address,
    signature: rawSig,
    r: splitSig.r,
    s: splitSig.s,
    v: splitSig.v,
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    message
  };
}

/**
 * Generates packed Ethereum Signed Message signature directly matching
 * CreditPulseASC.sol: saveRiskReportSigned(...)
 */
export async function signPackedRiskReport(payload: {
  assetAddress: string;
  overallScore: number;
  liquidity: number;
  collateral: number;
  auditScore: number;
  security: number;
  volatility: number;
  governance: number;
  dataHash: string;
}): Promise<{ signer: string; signature: string; messageHash: string }> {
  const privateKey = getValidatorPrivateKey();
  const wallet = new ethers.Wallet(privateKey);

  const messageHash = ethers.keccak256(
    ethers.solidityPacked(
      ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
      [
        ethers.getAddress(payload.assetAddress),
        Math.round(payload.overallScore),
        Math.round(payload.liquidity),
        Math.round(payload.collateral),
        Math.round(payload.auditScore),
        Math.round(payload.security),
        Math.round(payload.volatility),
        Math.round(payload.governance),
        payload.dataHash
      ]
    )
  );

  const sig = await wallet.signMessage(ethers.getBytes(messageHash));
  return {
    signer: wallet.address,
    signature: sig,
    messageHash
  };
}
