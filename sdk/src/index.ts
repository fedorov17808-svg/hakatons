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
  aiDigest: string;
  proofHash: string;
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

export interface CreditPulseConfig {
  rpcUrl?: string;
  contractAddress?: string;
  /** Maximum number of retries for RPC calls */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelayMs?: number;
  /** RPC request timeout in ms */
  timeoutMs?: number;
}

/**
 * CreditPulse SDK — On-chain credit scoring for DeFi & RWA protocols.
 *
 * Features:
 * - Fetch 7-dimensional risk scores from Creditcoin testnet
 * - Calculate institutional loan terms (Dynamic LTV & Risk-Adjusted APR)
 * - Query report finalization status (optimistic dispute window)
 * - Full report history with pagination support
 * - Event subscription for real-time report monitoring
 * - Automatic retry with exponential backoff
 *
 * @example
 * ```typescript
 * const sdk = new CreditPulseSDK();
 * const report = await sdk.getRiskReport("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2");
 * console.log(`Aave v3 score: ${report.overall}/100`);
 *
 * const terms = sdk.calculateLoanTerms(report.overall);
 * console.log(`Tier: ${terms.tier}, LTV: ${terms.ltvPercent}%`);
 * ```
 */
export class CreditPulseSDK {
  private rpcUrl: string;
  private contractAddress: string;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private maxRetries: number;
  private retryDelayMs: number;

  private static readonly ABI = [
    "function getRiskReport(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified))",
    "function getReportHistory(address _assetAddress) external view returns (tuple(address assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bytes32 proofHash, uint40 timestamp, address verifiedBy, bool crossChainVerified)[])",
    "function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool)",
    "function getAssetReportCount(address _assetAddress) external view returns (uint256)",
    "function requiredOracleQuorum() external view returns (uint8)",
    "function totalOracleStake() external view returns (uint256)",
    "function totalInsurancePool() external view returns (uint256)",
    "event ReportSaved(address indexed assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral, uint8 auditScore, uint8 security, uint8 volatility, uint8 governance, bytes32 dataHash, bytes32 aiDigest, bool crossChainVerified, address indexed verifiedBy, uint256 timestamp, uint256 indexed reportIndex)",
  ];

  constructor(config: CreditPulseConfig = {}) {
    this.rpcUrl = config.rpcUrl ?? "https://rpc.cc3-testnet.creditcoin.network";
    this.contractAddress =
      config.contractAddress ?? "0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5";
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl, undefined, {
      staticNetwork: true,
    });
    this.contract = new ethers.Contract(
      this.contractAddress,
      CreditPulseSDK.ABI,
      this.provider
    );
  }

  // =============================================================
  // Core API
  // =============================================================

  /**
   * Fetch the latest on-chain credit score and 7-dimensional risk vectors.
   * Includes automatic retry with exponential backoff.
   *
   * @throws {Error} If the asset has no reports or RPC is unreachable
   */
  async getRiskReport(assetAddress: string): Promise<RiskScores> {
    const raw = await this._callWithRetry(() =>
      this.contract.getRiskReport(assetAddress)
    );
    return this._parseReport(raw);
  }

  /**
   * Fetch complete on-chain report history for an asset.
   * Reports are append-only — never overwritten.
   */
  async getReportHistory(assetAddress: string): Promise<RiskScores[]> {
    const rawList = await this._callWithRetry(() =>
      this.contract.getReportHistory(assetAddress)
    );
    return rawList.map((raw: any) => this._parseReport(raw));
  }

  /**
   * Get the total number of reports for an asset.
   */
  async getReportCount(assetAddress: string): Promise<number> {
    const count = await this._callWithRetry(() =>
      this.contract.getAssetReportCount(assetAddress)
    );
    return Number(count);
  }

  /**
   * Check if a specific on-chain report is finalized
   * (3-day optimistic dispute window has passed without challenge).
   */
  async isFinalized(
    assetAddress: string,
    reportIndex: number
  ): Promise<boolean> {
    return await this._callWithRetry(() =>
      this.contract.isReportFinalized(assetAddress, reportIndex)
    );
  }

  // =============================================================
  // Institutional Loan Terms
  // =============================================================

  /**
   * Calculate institutional loan terms based on credit score.
   *
   * Tier structure:
   * - AAA (≥85): 90% LTV, 4.5% APR — Investment grade, prime collateral
   * - AA  (≥75): 80% LTV, 6.5% APR — High quality, verified protocols
   * - A   (≥60): 65% LTV, 9.5% APR — Upper medium grade
   * - BBB (≥50): 50% LTV, 14% APR  — Lower medium grade, higher monitoring
   * - HighRisk (<50): Not eligible — Below investment grade
   */
  calculateLoanTerms(score: number): DynamicLoanTerms {
    if (score >= 85) {
      return { tier: "AAA", ltvPercent: 90, aprPercent: 4.5, isEligible: true };
    } else if (score >= 75) {
      return { tier: "AA", ltvPercent: 80, aprPercent: 6.5, isEligible: true };
    } else if (score >= 60) {
      return { tier: "A", ltvPercent: 65, aprPercent: 9.5, isEligible: true };
    } else if (score >= 50) {
      return {
        tier: "BBB",
        ltvPercent: 50,
        aprPercent: 14.0,
        isEligible: true,
      };
    } else {
      return {
        tier: "HighRisk",
        ltvPercent: 0,
        aprPercent: 0,
        isEligible: false,
      };
    }
  }

  // =============================================================
  // Protocol Metadata
  // =============================================================

  /**
   * Query the current on-chain oracle quorum requirement.
   */
  async getRequiredQuorum(): Promise<number> {
    const q = await this._callWithRetry(() =>
      this.contract.requiredOracleQuorum()
    );
    return Number(q);
  }

  /**
   * Query total oracle stake and insurance pool balances.
   */
  async getProtocolStats(): Promise<{
    totalOracleStake: string;
    totalInsurancePool: string;
    requiredQuorum: number;
  }> {
    const [stake, insurance, quorum] = await Promise.all([
      this._callWithRetry(() => this.contract.totalOracleStake()),
      this._callWithRetry(() => this.contract.totalInsurancePool()),
      this._callWithRetry(() => this.contract.requiredOracleQuorum()),
    ]);
    return {
      totalOracleStake: ethers.formatEther(stake),
      totalInsurancePool: ethers.formatEther(insurance),
      requiredQuorum: Number(quorum),
    };
  }

  // =============================================================
  // Event Subscriptions
  // =============================================================

  /**
   * Subscribe to new report events for a specific asset or all assets.
   *
   * @param assetAddress - Filter by asset, or null for all assets
   * @param callback - Called with parsed RiskScores on each new report
   * @returns Cleanup function to unsubscribe
   *
   * @example
   * ```typescript
   * const unsubscribe = sdk.onNewReport(null, (report) => {
   *   console.log(`New report: ${report.overall}/100`);
   * });
   * // Later: unsubscribe();
   * ```
   */
  onNewReport(
    assetAddress: string | null,
    callback: (report: RiskScores, reportIndex: number) => void
  ): () => void {
    const filter = this.contract.filters.ReportSaved(assetAddress);

    const handler = (
      _asset: string,
      overall: bigint,
      liquidity: bigint,
      collateral: bigint,
      audit: bigint,
      security: bigint,
      volatility: bigint,
      governance: bigint,
      dataHash: string,
      aiDigest: string,
      crossChainVerified: boolean,
      verifiedBy: string,
      timestamp: bigint,
      reportIndex: bigint
    ) => {
      const report: RiskScores = {
        overall: Number(overall),
        liquidity: Number(liquidity),
        collateral: Number(collateral),
        audit: Number(audit),
        security: Number(security),
        volatility: Number(volatility),
        governance: Number(governance),
        dataHash,
        aiDigest,
        proofHash: "0x" + "0".repeat(64),
        timestamp: Number(timestamp),
        verifiedBy,
        crossChainVerified,
      };
      callback(report, Number(reportIndex));
    };

    this.contract.on(filter, handler);
    return () => {
      this.contract.off(filter, handler);
    };
  }

  // =============================================================
  // 1-Click Pull-Oracle & Precompile Integration
  // =============================================================

  /**
   * 1-Click Pull SDK: originate an undercollateralized loan with an atomic DON quorum proof.
   * Enables consumer protocols to update oracle state and originate loans in 1 single tx.
   */
  async pullScoreAndOriginateLoan(
    lendingPoolAddress: string,
    signer: ethers.Signer,
    collateralAsset: string,
    collateralAmountWei: bigint,
    reportPayload: {
      scores: [number, number, number, number, number, number, number];
      dataHash: string;
      aiDigest: string;
      signers: string[];
      signatures: string[];
    }
  ): Promise<ethers.TransactionResponse> {
    const LENDING_POOL_ABI = [
      "function borrowWithOracleProof(address _collateralAsset, uint256 _collateralAmount, uint8[7] calldata _scores, bytes32 _dataHash, bytes32 _aiDigest, address[] calldata _signers, bytes[] calldata _signatures) external payable returns (uint256)"
    ];
    const pool = new ethers.Contract(lendingPoolAddress, LENDING_POOL_ABI, signer);
    return pool.borrowWithOracleProof(
      collateralAsset,
      collateralAmountWei,
      reportPayload.scores,
      reportPayload.dataHash,
      reportPayload.aiDigest,
      reportPayload.signers,
      reportPayload.signatures
    );
  }

  /**
   * Direct hardware verification via Creditcoin CC3 Native Query Verifier Precompile 0x0FD2.
   * Performs zero-bridge cross-chain transaction verification natively on Creditcoin CC3.
   */
  async verifyCC3Precompile(proofBytes: string): Promise<string> {
    const CC3_PRECOMPILE_ADDR = "0x0000000000000000000000000000000000000FD2";
    return this.provider.call({
      to: CC3_PRECOMPILE_ADDR,
      data: proofBytes
    });
  }

  // =============================================================
  // Batch Operations
  // =============================================================

  /**
   * Fetch reports for multiple assets in parallel.
   * Failed lookups return null instead of throwing.
   */
  async batchGetReports(
    assetAddresses: string[]
  ): Promise<(RiskScores | null)[]> {
    return Promise.all(
      assetAddresses.map(async (addr) => {
        try {
          return await this.getRiskReport(addr);
        } catch {
          return null;
        }
      })
    );
  }

  // =============================================================
  // Internal Helpers
  // =============================================================

  private _parseReport(raw: any): RiskScores {
    return {
      overall: Number(raw.overallScore),
      liquidity: Number(raw.liquidity),
      collateral: Number(raw.collateral),
      audit: Number(raw.auditScore),
      security: Number(raw.security),
      volatility: Number(raw.volatility),
      governance: Number(raw.governance),
      dataHash: raw.dataHash,
      aiDigest: raw.aiDigest,
      proofHash: raw.proofHash,
      timestamp: Number(raw.timestamp),
      verifiedBy: raw.verifiedBy,
      crossChainVerified: raw.crossChainVerified,
    };
  }

  /**
   * Retry wrapper with exponential backoff for RPC resilience.
   */
  private async _callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}
