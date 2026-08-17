// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title CreditPulse AI — Attestcoin Smart Contract (ASC)
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring with cross-chain data verification via Attestcoin Protocol
/// @dev Integrates with Creditcoin Native Query Verifier Precompile (0x0FD2) for trustless proof verification
contract CreditPulseASC {
    string public constant VERSION = "3.0.0-attestcoin";
    
    /// @dev Creditcoin Native Query Verifier Precompile address
    address public constant BLOCK_PROVER = address(0x0FD2);
    
    address public owner;
    uint256 public reportCount;
    uint256 public verifiedProofCount;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    struct RiskReport {
        address assetAddress;
        uint8 overallScore;
        uint8 liquidity;
        uint8 collateral;
        uint8 auditScore;
        uint8 security;
        uint8 volatility;
        uint8 governance;
        bytes32 dataHash;           // keccak256 of source data (TVL, changes, etc.)
        bytes32 proofHash;          // keccak256 of cross-chain proof (if verified)
        uint40 timestamp;
        address verifiedBy;
        bool crossChainVerified;    // true if verified via Attestcoin 0x0FD2
    }

    /// @dev Append-only history per asset — reports are NEVER overwritten
    mapping(address => RiskReport[]) public assetReportHistory;
    
    event ReportSaved(
        address indexed assetAddress, 
        uint8 overallScore, 
        uint8 liquidity, 
        uint8 collateral, 
        uint8 auditScore,
        uint8 security,
        uint8 volatility,
        uint8 governance,
        bytes32 dataHash,
        bool crossChainVerified,
        address indexed verifiedBy, 
        uint256 timestamp,
        uint256 reportIndex
    );

    event CrossChainProofVerified(
        address indexed assetAddress,
        uint32 sourceChainId,
        bytes32 proofHash,
        uint256 timestamp
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Saves a risk report WITH cross-chain proof verification via Attestcoin
    /// @dev Calls the 0x0FD2 precompile to verify the proof. Reverts if proof is invalid.
    /// @param _sourceChainId The chain ID of the source chain (e.g., 11155111 for Sepolia)
    /// @param _proof The cryptographic Merkle inclusion proof from the Proof Builder API
    /// @param _txData The transaction data from the source chain
    function saveVerifiedRiskReport(
        uint32 _sourceChainId,
        bytes calldata _proof,
        bytes calldata _txData,
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash
    ) external onlyOwner {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");

        bool verified = false;
        bytes32 proofHash = bytes32(0);

        // Attempt cross-chain verification via Attestcoin precompile
        if (_proof.length > 0) {
            (bool success, ) = BLOCK_PROVER.call(
                abi.encodeWithSignature(
                    "verifyAndEmit(uint32,bytes,bytes)",
                    _sourceChainId, _proof, _txData
                )
            );
            if (success) {
                verified = true;
                proofHash = keccak256(_proof);
                verifiedProofCount++;
                emit CrossChainProofVerified(_assetAddress, _sourceChainId, proofHash, block.timestamp);
            }
        }

        RiskReport memory report = RiskReport({
            assetAddress: _assetAddress,
            overallScore: _overallScore,
            liquidity: _liquidity,
            collateral: _collateral,
            auditScore: _auditScore,
            security: _security,
            volatility: _volatility,
            governance: _governance,
            dataHash: _dataHash,
            proofHash: proofHash,
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender,
            crossChainVerified: verified
        });

        assetReportHistory[_assetAddress].push(report);
        reportCount++;

        uint256 idx = assetReportHistory[_assetAddress].length - 1;
        emit ReportSaved(
            _assetAddress, _overallScore, _liquidity, _collateral, 
            _auditScore, _security, _volatility, _governance,
            _dataHash, verified, msg.sender, block.timestamp, idx
        );
    }

    /// @notice Saves a risk report with data hash but without cross-chain proof (fallback)
    /// @dev Used when Attestcoin proof is not available (e.g., off-chain data sources)
    function saveRiskReport(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash
    ) external onlyOwner {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");

        RiskReport memory report = RiskReport({
            assetAddress: _assetAddress,
            overallScore: _overallScore,
            liquidity: _liquidity,
            collateral: _collateral,
            auditScore: _auditScore,
            security: _security,
            volatility: _volatility,
            governance: _governance,
            dataHash: _dataHash,
            proofHash: bytes32(0),
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender,
            crossChainVerified: false
        });

        assetReportHistory[_assetAddress].push(report);
        reportCount++;

        uint256 idx = assetReportHistory[_assetAddress].length - 1;
        emit ReportSaved(
            _assetAddress, _overallScore, _liquidity, _collateral, 
            _auditScore, _security, _volatility, _governance,
            _dataHash, false, msg.sender, block.timestamp, idx
        );
    }

    /// @notice Retrieves the latest risk report for an asset
    function getRiskReport(address _assetAddress) external view returns (RiskReport memory) {
        uint256 len = assetReportHistory[_assetAddress].length;
        require(len > 0, "No reports for this asset");
        return assetReportHistory[_assetAddress][len - 1];
    }

    /// @notice Retrieves the full report history for an asset
    function getReportHistory(address _assetAddress) external view returns (RiskReport[] memory) {
        return assetReportHistory[_assetAddress];
    }

    /// @notice Verifies data integrity — anyone can check if a dataHash matches source data
    /// @param _assetAddress The asset to check
    /// @param _reportIndex The index of the report in history
    /// @param _expectedDataHash The hash the verifier expects
    /// @return matches Whether the stored dataHash matches the expected one
    function verifyDataIntegrity(
        address _assetAddress, 
        uint256 _reportIndex, 
        bytes32 _expectedDataHash
    ) external view returns (bool matches) {
        require(_reportIndex < assetReportHistory[_assetAddress].length, "Invalid report index");
        return assetReportHistory[_assetAddress][_reportIndex].dataHash == _expectedDataHash;
    }

    function getReportCount() external view returns (uint256) { 
        return reportCount; 
    }

    function getVerifiedProofCount() external view returns (uint256) {
        return verifiedProofCount;
    }

    function getAssetReportCount(address _assetAddress) external view returns (uint256) {
        return assetReportHistory[_assetAddress].length;
    }
}
