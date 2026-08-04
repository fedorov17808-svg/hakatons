// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreditPulseScore {
    address public owner;

    struct RiskReport {
        uint256 score;
        uint256 timestamp;
        bool isApproved;
    }

    mapping(address => RiskReport) public reports;

    event ScoreUpdated(address indexed asset, uint256 score, bool isApproved);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function updateScore(address _asset, uint256 _score, bool _isApproved) external onlyOwner {
        reports[_asset] = RiskReport(_score, block.timestamp, _isApproved);
        emit ScoreUpdated(_asset, _score, _isApproved);
    }
}
