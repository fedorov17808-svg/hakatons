/**
 * CreditPulse AI — Shared Constants, ABI, & Type Definitions
 * Extracted from page.tsx monolith for clean module architecture.
 */

// ─── Network & Contract Configuration ─────────────────────────
export const EXPLORER_URL = "https://creditcoin-testnet.blockscout.com/tx/";
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const CC3_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const CC3_CHAIN_ID = 102031;
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5";
export const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";
export const PROTOCOL_VERSION = "8.5.0";

// ─── Relayer Keys (from env only — never hardcoded) ───────────
export const RELAYER_PK = process.env.PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
export const ORACLE_PK = process.env.ORACLE_PRIVATE_KEY;

// ─── CreditPulseASC Smart Contract ABI (Human-Readable) ───────
export const CONTRACT_ABI = [
  "function saveRiskReportSigned(address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral, uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance, bytes32 _dataHash, bytes calldata _signature) external",
  "function saveRiskReportMultiSigned(address _assetAddress, uint8[7] calldata _scores, bytes32 _dataHash, bytes32 _aiDigest, address[] calldata _signers, bytes[] calldata _signatures) external",
  "function saveRWACertificate(address _assetAddress, uint8 _score, uint16 _reserveRatioBps, bytes32 _porHash, bytes32 _legalEntityDigest) external",
  "function saveRWAZkTLSCertificate(address _assetAddress, uint8 _score, uint16 _reserveRatioBps, bytes32 _zkTlsProofHash, bytes32 _custodianKeyHash, bytes32 _sessionCommitment) external",
  "function challengeReport(address _assetAddress, uint256 _reportIndex, string calldata _evidenceUrl) external payable",
  "function resolveDispute(address _assetAddress, uint256 _reportIndex, bool _upholdChallenge, address _maliciousOracle) external",
  "function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool)",
  "function getReportHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified)[])",
  "function getRWACertificateHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 porHash, bytes32 legalEntityDigest, uint40 timestamp, address attestedBy)[])",
  "function getZkTLSCertificateHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 zkTlsProofHash, bytes32 custodianKeyHash, bytes32 sessionCommitment, uint40 timestamp, address verifiedBy)[])",
  "function getAssetReportCount(address _assetAddress) external view returns (uint256)",
  "function reportCount() external view returns (uint256)",
  "function verifiedProofCount() external view returns (uint256)",
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
  health?: string;
  source?: string;
  latency_ms: number;
}

export interface PresetAsset {
  name: string;
  category: string;
  address: string;
}

// ─── Institutional Benchmark Registry ────────────────────────
export const PRESET_ASSETS: PresetAsset[] = [
  // ── Treasury & Yield-Bearing RWA ──
  { name: "Ondo Finance (OUSG)", category: "Treasury RWA", address: "0xe8684521db5a68778844145ba0a0374d8e95e140" },
  { name: "Mountain Protocol (USDM)", category: "Regulated Yield", address: "0x59d9356e565ab3a36dd77763fc0d87fe93070999" },
  { name: "Backed Finance (bIBTA)", category: "Tokenized Bond", address: "0xca30c93b02514f86d5c86a6e375e3a330b435fb5" },
  { name: "Matrixdock (STBT)", category: "T-Bill Token", address: "0x530824df2599ba50aa25cef81aa3f91b34ab4bbd" },
  // ── Money Markets ──
  { name: "Aave V3 Primary Pool", category: "Money Market", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
  { name: "Compound V3 (cUSDCv3)", category: "Money Market", address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" },
  { name: "Morpho Blue", category: "Money Market", address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" },
  { name: "Spark Protocol", category: "Money Market", address: "0xC13e21B648A5Ee794902342038FF3aDAB66BE987" },
  // ── Private Credit & Lending ──
  { name: "Centrifuge (Tinlake SPV)", category: "Private Credit", address: "0x0412db7b4618e47f9be5e4277b0dfcaeef4534a1" },
  { name: "Maple Finance V2", category: "Institutional Lending", address: "0x33349b282065b0284d756f0577fb39c158f935e6" },
  { name: "Goldfinch Senior Pool", category: "Emerging Market Credit", address: "0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822" },
  { name: "TrueFi (tfUSDC)", category: "Unsecured Lending", address: "0xA991356d261fbaF194463aF6DF8f0464F8f1c742" },
  { name: "Clearpool (cDAI)", category: "Unsecured Lending", address: "0x1F9b6a2130BE5373Da7d0E11622Be4B87394aBC7" },
  // ── Stablecoins & Sovereign ──
  { name: "MakerDAO (Clydesdale SPV)", category: "Sovereign Vault", address: "0x6b175474e89094c44da98b954eedeac495271d0f" },
  { name: "Frax Finance (sFRAX)", category: "Yield Stablecoin", address: "0xa663b02cf0a4b149d2ad41910cb81e23e1c41c32" },
  { name: "Ethena (USDe)", category: "Synthetic Dollar", address: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3" },
  { name: "Usual (USD0)", category: "RWA Stablecoin", address: "0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5" },
  // ── DEXes & Infrastructure ──
  { name: "Uniswap V3 (ETH/USDC)", category: "DEX LP", address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" },
  { name: "Curve Finance (3pool)", category: "Stableswap", address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7" },
  { name: "Pendle Finance", category: "Yield Trading", address: "0x808507121B80c02388fAd14726482e061B8da827" },
  // ── Liquid Staking ──
  { name: "Lido (stETH)", category: "Liquid Staking", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" },
  { name: "Rocket Pool (rETH)", category: "Liquid Staking", address: "0xae78736Cd615f374D3085123A210448E74Fc6393" },
  { name: "Coinbase (cbETH)", category: "Centralized Staking", address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49BBa" },
  // ── Bridges & Cross-Chain ──
  { name: "Across Protocol", category: "Cross-Chain Bridge", address: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5" },
  { name: "Stargate Finance V2", category: "Omnichain Bridge", address: "0xdf0770dF86a8034b3EFEf0A1Bb3c889B8332FF56" },
];

export interface RWAPoRBenchmark {
  supplyUsd: number;
  reservesUsd: number;
  custodian: string;
  spvCik: string;
}

export const RWA_BENCHMARK_REGISTRY: Record<string, RWAPoRBenchmark> = {
  "0xe8684521db5a68778844145ba0a0374d8e95e140": {
    supplyUsd: 550000000,
    reservesUsd: 563750000,
    custodian: "Ankura Trust & Morgan Stanley",
    spvCik: "CIK-0001982741"
  },
  "0x969609f223a2b005189904701bc20b22a00c6d7a": {
    supplyUsd: 450000000,
    reservesUsd: 463500000,
    custodian: "Ankura Trust & First Citizens Bank",
    spvCik: "CIK-0001982741"
  },
  "0x59d9356e565ab3a36dd77763fc0d87fe93070999": {
    supplyUsd: 154000000,
    reservesUsd: 158620000,
    custodian: "Fidelity & Bermuda Monetary Authority",
    spvCik: "BMA-REG-2023-USDM"
  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    supplyUsd: 1250000000,
    reservesUsd: 1280000000,
    custodian: "Synergy / Monetalis SPV (Clonoulty)",
    spvCik: "MIP65-CLYDESDALE-SPV"
  },
  "0x0412db7b4618e47f9be5e4277b0dfcaeef4534a1": {
    supplyUsd: 240000000,
    reservesUsd: 248400000,
    custodian: "Wilmington Trust SPV",
    spvCik: "CIK-0001859012"
  },
  "0xdd50c053c096cb04a3e3362e2b622529ec5f2e8a": {
    supplyUsd: 115000000,
    reservesUsd: 118450000,
    custodian: "BNY Mellon Singapore & Apex Group",
    spvCik: "MAS-CMS-101183"
  }
};

// ─── Utility Functions ────────────────────────────────────────
export const getButtonGradient = (score: number) => {
  if (score >= 70) return 'from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20';
  if (score >= 40) return 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20';
  return 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20';
};
