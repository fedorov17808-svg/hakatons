// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title CreditPulse AI Risk Scoring Contract
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring protocol for Real-World Assets
/// @dev Mints immutable, cryptographically verifiable risk certificates
contract CreditPulseScore {
    string public constant VERSION = "1.0.0";
    
    address public owner;
    uint256 public reportCount;
    
    mapping(address => uint256) public assetReportCount;

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
        uint40 timestamp;
        address verifiedBy;
    }

    mapping(address => RiskReport) public assetReports;
    
    event ReportSaved(
        address indexed assetAddress, 
        uint8 overallScore, 
        uint8 liquidity, 
        uint8 collateral, 
        uint8 auditScore, 
        address indexed verifiedBy, 
        uint256 timestamp
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

    /// @notice Saves a risk report for an asset
    /// @dev Only the contract owner can call this function
    /// @param _assetAddress The address of the asset being reported
    /// @param _overallScore The overall risk score of the asset
    /// @param _liquidity The liquidity depth score
    /// @param _collateral The collateral quality score
    /// @param _auditScore The audit status score
    function saveRiskReport(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore
    ) public onlyOwner {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");
        require(_liquidity <= 100, "Liquidity exceeds maximum");
        require(_collateral <= 100, "Collateral exceeds maximum");
        require(_auditScore <= 100, "Audit score exceeds maximum");

        assetReports[_assetAddress] = RiskReport({
            assetAddress: _assetAddress,
            overallScore: _overallScore,
            liquidity: _liquidity,
            collateral: _collateral,
            auditScore: _auditScore,
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender
        });
        
        reportCount++;
        assetReportCount[_assetAddress]++;

        emit ReportSaved(_assetAddress, _overallScore, _liquidity, _collateral, _auditScore, msg.sender, block.timestamp);
    }

    /// @notice Retrieves the latest risk report for an asset
    /// @param _assetAddress The address of the asset
    /// @return RiskReport The latest risk report for the given asset
    function getRiskReport(address _assetAddress) public view returns (RiskReport memory) {
        return assetReports[_assetAddress];
    }
    
    /// @notice Retrieves the total number of reports saved
    /// @return The total number of reports
    function getReportCount() external view returns (uint256) { 
        return reportCount; 
    }

    /// @notice Retrieves the timestamp of the latest report for an asset
    /// @param _assetAddress The address of the asset
    /// @return The timestamp of the latest report
    function getLatestReportTimestamp(address _assetAddress) external view returns (uint256) {
        return assetReports[_assetAddress].timestamp;
    }
}
