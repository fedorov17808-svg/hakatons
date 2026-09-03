// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title ICreditPulse — Standard Interface for Institutional Credit Scoring on Creditcoin CC3
/// @notice Any DeFi Lending Pool, RWA SPV, or Structured Credit protocol integrates this interface for real-time credit ratings
interface ICreditPulse {
    struct RiskReport {
        address assetAddress;
        uint8 overallScore;
        uint8 liquidity;
        uint8 collateral;
        uint8 auditScore;
        uint8 security;
        uint8 volatility;
        uint8 governance;
        bytes32 dataHash;
        bytes32 aiDigest;
        bytes32 proofHash;
        uint40 timestamp;
        address verifiedBy;
        bool crossChainVerified;
    }

    struct RWACertificate {
        address assetAddress;
        uint8 score;
        uint16 reserveRatioBps;
        bytes32 porHash;
        bytes32 legalEntityDigest;
        uint40 timestamp;
        address attestedBy;
    }

    /// @notice Returns the latest credit risk report for an asset
    function getRiskReport(address _assetAddress) external view returns (RiskReport memory);

    /// @notice Returns whether an asset meets a minimum institutional credit score threshold
    function isCreditworthy(address _assetAddress, uint8 _minScore) external view returns (bool);

    /// @notice Query the latest RWA Proof-of-Reserve certificate
    function getLatestRWACertificate(address _assetAddress) external view returns (RWACertificate memory);

    /// @notice Check if a specific report has cleared the optimistic dispute window
    function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool);

    /// @notice Direct query for overall score (0-100)
    function getOverallScore(address _assetAddress) external view returns (uint8);

    /// @notice Pull-Oracle: Submit signed DON quorum report and update score atomically
    function saveRiskReportMultiSigned(
        address _assetAddress,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        address[] calldata _signers,
        bytes[] calldata _signatures
    ) external;
}
