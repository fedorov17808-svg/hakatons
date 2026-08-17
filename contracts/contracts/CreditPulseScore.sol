// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title CreditPulse AI Risk Scoring Contract
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring protocol for Real-World Assets
/// @dev Stores append-only risk report history per asset — reports are never overwritten
contract CreditPulseScore {
    string public constant VERSION = "2.0.0";
    
    address public owner;
    uint256 public reportCount;

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
        uint40 timestamp;
        address verifiedBy;
    }

    /// @dev Append-only history: reports are NEVER overwritten
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
        address indexed verifiedBy, 
        uint256 timestamp,
        uint256 reportIndex
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Initializes the contract and sets the owner
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Transfers ownership of the contract
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Saves a risk report for an asset (append-only, never overwrites)
    /// @param _assetAddress The address of the asset being reported
    /// @param _overallScore The overall risk score (0-100)
    /// @param _liquidity The liquidity depth score (0-100)
    /// @param _collateral The collateral quality score (0-100)
    /// @param _auditScore The audit status score (0-100)
    /// @param _security The security posture score (0-100)
    /// @param _volatility The volatility resistance score (0-100)
    /// @param _governance The governance maturity score (0-100)
    function saveRiskReport(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance
    ) public onlyOwner {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100 && _liquidity <= 100 && _collateral <= 100, "Score exceeds maximum");
        require(_auditScore <= 100 && _security <= 100 && _volatility <= 100 && _governance <= 100, "Score exceeds maximum");

        RiskReport memory report = RiskReport({
            assetAddress: _assetAddress,
            overallScore: _overallScore,
            liquidity: _liquidity,
            collateral: _collateral,
            auditScore: _auditScore,
            security: _security,
            volatility: _volatility,
            governance: _governance,
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender
        });

        assetReportHistory[_assetAddress].push(report);
        reportCount++;

        uint256 idx = assetReportHistory[_assetAddress].length - 1;
        emit ReportSaved(
            _assetAddress, _overallScore, _liquidity, _collateral, 
            _auditScore, _security, _volatility, _governance,
            msg.sender, block.timestamp, idx
        );
    }

    /// @notice Retrieves the latest risk report for an asset
    function getRiskReport(address _assetAddress) public view returns (RiskReport memory) {
        uint256 len = assetReportHistory[_assetAddress].length;
        require(len > 0, "No reports for this asset");
        return assetReportHistory[_assetAddress][len - 1];
    }

    /// @notice Retrieves the full report history for an asset
    function getReportHistory(address _assetAddress) external view returns (RiskReport[] memory) {
        return assetReportHistory[_assetAddress];
    }
    
    /// @notice Retrieves the total number of reports saved globally
    function getReportCount() external view returns (uint256) { 
        return reportCount; 
    }

    /// @notice Retrieves the number of reports for a specific asset
    function getAssetReportCount(address _assetAddress) external view returns (uint256) {
        return assetReportHistory[_assetAddress].length;
    }

    /// @notice Retrieves the timestamp of the latest report for an asset
    function getLatestReportTimestamp(address _assetAddress) external view returns (uint256) {
        uint256 len = assetReportHistory[_assetAddress].length;
        require(len > 0, "No reports for this asset");
        return assetReportHistory[_assetAddress][len - 1].timestamp;
    }
}
