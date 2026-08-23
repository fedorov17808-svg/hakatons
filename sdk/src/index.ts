import { ethers } from "ethers";

export interface RiskScores {
  overall: number;
  liquidity: number;
  collateral: number;
  audit: number;
  security: number;
  volatility: number;
  governance: number;
  dataHash: string;
  timestamp: number;
  verifiedBy: string;
  crossChainVerified: boolean;
}

export interface DynamicLoanTerms {
  tier: "AAA" | "AA" | "A" | "BBB" | "HighRisk";
  ltvPercent: number;
  aprPercent: number;
  isEligible: boolean;
}

export class CreditPulseSDK {
  private rpcUrl: string;
  private contractAddress: string;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  private static readonly ABI = [
    "function getRiskReport(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified))",
    "function getReportHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified)[])",
    "function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool)"
  ];

  constructor(
    rpcUrl: string = "https://rpc.cc3-testnet.creditcoin.network",
    contractAddress: string = "0x358925c5839a36bB2181786B8763Da0653B0f438"
  ) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.contract = new ethers.Contract(this.contractAddress, CreditPulseSDK.ABI, this.provider);
  }

  /**
   * Fetch the latest on-chain credit score and 7-dimensional risk vectors for any asset
   */
  async getRiskReport(assetAddress: string): Promise<RiskScores> {
    const raw = await this.contract.getRiskReport(assetAddress);
    return {
      overall: Number(raw.overallScore),
      liquidity: Number(raw.liquidity),
      collateral: Number(raw.collateral),
      audit: Number(raw.auditScore),
      security: Number(raw.security),
      volatility: Number(raw.volatility),
      governance: Number(raw.governance),
      dataHash: raw.dataHash,
      timestamp: Number(raw.timestamp),
      verifiedBy: raw.verifiedBy,
      crossChainVerified: raw.crossChainVerified
    };
  }

  /**
   * Calculate institutional loan terms (Dynamic LTV & Risk-Adjusted APR)
   */
  calculateLoanTerms(score: number): DynamicLoanTerms {
    if (score >= 85) {
      return { tier: "AAA", ltvPercent: 90, aprPercent: 4.5, isEligible: true };
    } else if (score >= 75) {
      return { tier: "AA", ltvPercent: 80, aprPercent: 6.5, isEligible: true };
    } else if (score >= 60) {
      return { tier: "A", ltvPercent: 65, aprPercent: 9.5, isEligible: true };
    } else if (score >= 50) {
      return { tier: "BBB", ltvPercent: 50, aprPercent: 14.0, isEligible: true };
    } else {
      return { tier: "HighRisk", ltvPercent: 0, aprPercent: 0, isEligible: false };
    }
  }

  /**
   * Check if a specific on-chain report is finalized (dispute window passed)
   */
  async isFinalized(assetAddress: string, reportIndex: number): Promise<boolean> {
    return await this.contract.isReportFinalized(assetAddress, reportIndex);
  }
}
