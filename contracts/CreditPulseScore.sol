// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreditPulseScore {
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
    event ReportSaved(string indexed assetAddress, uint256 overallScore, address indexed verifiedBy);

    function saveRiskReport(
        string memory _assetAddress,
        uint256 _overallScore,
        uint256 _liquidity,
        uint256 _collateral,
        uint256 _auditScore
    ) public {
        assetReports[_assetAddress] = RiskReport(
            _assetAddress,
            _overallScore,
            _liquidity,
            _collateral,
            _auditScore,
            block.timestamp,
            msg.sender
        );

        emit ReportSaved(_assetAddress, _overallScore, msg.sender);
    }

    function getReport(string memory _assetAddress) public view returns (RiskReport memory) {
        return assetReports[_assetAddress];
    }
}
