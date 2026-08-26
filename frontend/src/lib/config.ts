/**
 * CreditPulse AI — Shared Constants, ABI, & Type Definitions
 * Extracted from page.tsx monolith for clean module architecture.
 */

// ─── Network & Contract Configuration ─────────────────────────
export const EXPLORER_URL = "https://creditcoin-testnet.blockscout.com/tx/";
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const CC3_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x358925c5839a36bB2181786B8763Da0653B0f438";

// ─── CreditPulseASC Smart Contract ABI (Human-Readable) ───────
export const CONTRACT_ABI = [
  "function saveRiskReportSigned(address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral, uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance, bytes32 _dataHash, bytes calldata _signature) external",
  "function saveRiskReportMultiSigned(address _assetAddress, uint8[7] calldata _scores, bytes32 _dataHash, bytes32 _aiDigest, address[] calldata _signers, bytes[] calldata _signatures) external",
  "function saveRWACertificate(address _assetAddress, uint8 _score, uint16 _reserveRatioBps, bytes32 _porHash, bytes32 _legalEntityDigest) external",
  "function saveRWAZkTLSCertificate(address _assetAddress, uint8 _score, uint16 _reserveRatioBps, bytes32 _zkTlsProofHash, bytes32 _custodianKeyHash, bytes32 _sessionCommitment) external",
  "function challengeReport(address _assetAddress, uint256 _reportIndex, string calldata _evidenceUrl) external payable",
  "function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool)",
  "function getReportHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified)[])",
  "function getRWACertificateHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 porHash, bytes32 legalEntityDigest, uint40 timestamp, address attestedBy)[])",
  "function getZkTLSCertificateHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 zkTlsProofHash, bytes32 custodianKeyHash, bytes32 sessionCommitment, uint40 timestamp, address verifiedBy)[])",
  "function getAssetReportCount(address _assetAddress) external view returns (uint256)",
  "function requiredOracleQuorum() external view returns (uint8)",
  "function totalOracleStake() external view returns (uint256)",
  "function totalInsurancePool() external view returns (uint256)"
];

// ─── Type Definitions ─────────────────────────────────────────
export interface OnChainReportItem {
  overallScore: number;
  dataHash: string;
  timestamp: number;
  verifiedBy: string;
  crossChainVerified: boolean;
  proofHash: string;
  isFinalized?: boolean;
}

export interface RWAAttestationData {
  is_solvent: boolean;
  reserve_ratio_bps: number;
  coverage_percent: number;
  status: string;
  por_hash: string;
  legal_entity_digest: string;
  custodian: string;
  spv_registration: string;
  zk_tls_proof_hash?: string;
  session_commitment?: string;
  custodian_key_hash?: string;
  tls_standard?: string;
  proof_type?: string;
}

export interface DONNodeItem {
  node_id: string;
  name: string;
  address: string;
  region: string;
  status: string;
  latency_ms: number;
}

// ─── Preset Asset Addresses ───────────────────────────────────
export const PRESET_ASSETS = [
  { name: "Aave V3", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
  { name: "Compound V3", address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" },
  { name: "Lido stETH", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" },
  { name: "MakerDAO", address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" },
  { name: "Ondo USDY", address: "0x96F6eF951840721AdBF46Ac996b59E0235CB985C" },
];

// ─── Utility Functions ────────────────────────────────────────
export const getButtonGradient = (score: number) => {
  if (score >= 70) return 'from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20';
  if (score >= 40) return 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20';
  return 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20';
};
