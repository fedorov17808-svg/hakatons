// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreditPulseScore {
    address public owner;

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
    event ReportSaved(string assetAddress, uint256 overallScore, address indexed verifiedBy);

    constructor() {
        owner = msg.sender;
    }

    function saveRiskReport(
        string memory _assetAddress,
        uint256 _overallScore,
        uint256 _liquidity,
        uint256 _collateral,
        uint256 _auditScore
    ) public onlyOwner {
        assetReports[_assetAddress] = RiskReport({
            assetAddress: _assetAddress,
            overallScore: _overallScore,
            liquidity: _liquidity,
            collateral: _collateral,
            auditScore: _auditScore,
            timestamp: block.timestamp,
            verifiedBy: msg.sender
        });

        emit ReportSaved(_assetAddress, _overallScore, msg.sender);
    }

    function getReport(string memory _assetAddress) public view returns (RiskReport memory) {
        return assetReports[_assetAddress];
    }
}
