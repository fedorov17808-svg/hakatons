// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title CreditPulse AI — Attestcoin Smart Contract (ASC)
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring with cross-chain data verification via Attestcoin Protocol
/// @dev Integrates with Creditcoin Native Query Verifier Precompile (0x0FD2) for trustless proof verification
contract CreditPulseASC {
    string public constant VERSION = "3.2.0";
    
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

    /// @dev Validates all score fields are within [0, 100]
    function _validateScores(
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance
    ) internal pure {
        require(_overallScore <= 100, "Overall score exceeds 100");
        require(_liquidity <= 100, "Liquidity score exceeds 100");
        require(_collateral <= 100, "Collateral score exceeds 100");
        require(_auditScore <= 100, "Audit score exceeds 100");
        require(_security <= 100, "Security score exceeds 100");
        require(_volatility <= 100, "Volatility score exceeds 100");
        require(_governance <= 100, "Governance score exceeds 100");
    }

    /// @notice Saves a risk report WITHOUT cross-chain verification (standard flow)
    /// @param _assetAddress The contract address of the DeFi protocol being scored
    /// @param _overallScore The weighted average score (0-100)
    /// @param _liquidity Liquidity dimension score (0-100)
    /// @param _collateral Collateral dimension score (0-100)
    /// @param _auditScore Audit track record score (0-100)
    /// @param _security Security dimension score (0-100)
    /// @param _volatility Volatility dimension score (0-100)
    /// @param _governance Governance dimension score (0-100)
    /// @param _dataHash keccak256 of the raw DeFiLlama oracle inputs for verifiable provenance
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
        _validateScores(_overallScore, _liquidity, _collateral, _auditScore, _security, _volatility, _governance);

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

    /// @notice Saves a risk report WITH cross-chain proof verification via Attestcoin
    /// @dev Two-step flow: (1) caller verifies proof via 0x0FD2 precompile externally,
    ///      (2) caller passes the resulting queryId/proofHash here.
    ///      This separation is necessary because the precompile uses complex tuple ABI
    ///      that cannot be efficiently encoded via abi.encodeWithSignature.
    /// @param _sourceChainId The chain key of the source chain (e.g., 1 for Sepolia)
    /// @param _proofHash The queryId returned by the precompile's verifyAndEmit() call
    /// @param _assetAddress The contract address of the DeFi protocol being scored
    function saveVerifiedRiskReport(
        uint32 _sourceChainId,
        bytes32 _proofHash,
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
        require(_proofHash != bytes32(0), "Proof hash required for verified report");
        _validateScores(_overallScore, _liquidity, _collateral, _auditScore, _security, _volatility, _governance);

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
            proofHash: _proofHash,
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender,
            crossChainVerified: true
        });

        assetReportHistory[_assetAddress].push(report);
        uint256 idx = assetReportHistory[_assetAddress].length - 1;
        reportCount++;
        verifiedProofCount++;

        emit CrossChainProofVerified(_assetAddress, _sourceChainId, _proofHash, block.timestamp);
        emit ReportSaved(
            _assetAddress, _overallScore, _liquidity, _collateral, 
            _auditScore, _security, _volatility, _governance,
            _dataHash, true, msg.sender, block.timestamp, idx
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

    function getAssetReportCount(address _assetAddress) external view returns (uint256) {
        return assetReportHistory[_assetAddress].length;
    }

    /// @notice Retrieves a paginated slice of report history for an asset (H2 fix)
    /// @param _assetAddress The asset to query
    /// @param _offset Starting index (0-based)
    /// @param _limit Maximum number of reports to return
    /// @return reports Array of reports in the requested range
    function getReportHistoryPaginated(
        address _assetAddress, 
        uint256 _offset, 
        uint256 _limit
    ) external view returns (RiskReport[] memory reports) {
        uint256 total = assetReportHistory[_assetAddress].length;
        if (_offset >= total) {
            return new RiskReport[](0);
        }
        uint256 end = _offset + _limit;
        if (end > total) end = total;
        uint256 size = end - _offset;
        reports = new RiskReport[](size);
        for (uint256 i = 0; i < size; i++) {
            reports[i] = assetReportHistory[_assetAddress][_offset + i];
        }
    }
}
