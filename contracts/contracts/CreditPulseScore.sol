// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CreditPulse AI Risk Scoring Contract
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring protocol for Real-World Assets
/// @dev Mints immutable, cryptographically verifiable risk certificates
contract CreditPulseScore {
    string public constant VERSION = "1.0.0";
    
    address public owner;
    uint256 public reportCount;
    
    mapping(string => uint256) public assetReportCount;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    struct RiskReport {
        string assetAddress;
        uint256 overallScore;
        uint256 liquidity;
        uint256 collateral;
        uint256 auditScore;
        uint256 timestamp;
        address verifiedBy;
    }

    mapping(string => RiskReport) public assetReports;
    
    event ReportSaved(
        string assetAddress, 
        uint256 overallScore, 
        uint256 liquidity, 
        uint256 collateral, 
        uint256 auditScore, 
        address indexed verifiedBy, 
        uint256 timestamp
    );

    /// @notice Initializes the contract and sets the owner
    constructor() {
        owner = msg.sender;
    }

    /// @notice Transfers ownership of the contract
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }

    /// @notice Saves a risk report for an asset
    /// @dev Only the contract owner can call this function
    /// @param _assetAddress The address of the asset being reported
    /// @param _overallScore The overall risk score of the asset
    /// @param _liquidity The liquidity depth score
    /// @param _collateral The collateral quality score
    /// @param _auditScore The audit status score
    function saveRiskReport(
        string memory _assetAddress,
        uint256 _overallScore,
        uint256 _liquidity,
        uint256 _collateral,
        uint256 _auditScore
    ) public onlyOwner {
        require(bytes(_assetAddress).length > 0, "Empty asset address");
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
            timestamp: block.timestamp,
            verifiedBy: msg.sender
        });
        
        reportCount++;
        assetReportCount[_assetAddress]++;

        emit ReportSaved(_assetAddress, _overallScore, _liquidity, _collateral, _auditScore, msg.sender, block.timestamp);
    }

    /// @notice Retrieves the latest risk report for an asset
    /// @param _assetAddress The address of the asset
    /// @return RiskReport The latest risk report for the given asset
    function getReport(string memory _assetAddress) public view returns (RiskReport memory) {
        return assetReports[_assetAddress];
    }
    
    /// @notice Retrieves the total number of reports saved
    /// @return The total number of reports
    function getReportCount() external view returns (uint256) { 
        return reportCount; 
    }
}
