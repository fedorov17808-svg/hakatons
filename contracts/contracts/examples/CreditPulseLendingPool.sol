// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/ICreditPulse.sol";

/// @title CreditPulseLendingPool — Reference Dynamic LTV Lending Protocol on Creditcoin CC3
/// @notice Demonstrates how undercollateralized lending protocols utilize CreditPulse on-chain ratings to adjust LTV and interest rates
contract CreditPulseLendingPool {
    ICreditPulse public immutable creditPulseOracle;
    address public owner;

    struct Loan {
        address borrower;
        address collateralAsset;
        uint256 collateralAmount;
        uint256 borrowedAmount;
        uint16 interestRateBps;
        uint8 creditScoreAtBorrow;
        uint40 borrowTimestamp;
        bool isRepaid;
    }

    uint256 public loanCount;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;

    event LoanOriginated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed collateralAsset,
        uint256 borrowedAmount,
        uint8 creditScore,
        uint16 ltvBps,
        uint16 interestRateBps
    );

    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid);

    error InsufficientCreditRating(uint8 actualScore, uint8 requiredMin);
    error InvalidCollateral();
    error LoanAlreadyRepaid();

    constructor(address _creditPulseOracle) {
        creditPulseOracle = ICreditPulse(_creditPulseOracle);
        owner = msg.sender;
    }

    /// @notice Calculates dynamic Loan-to-Value (LTV) and Interest Rate based on CreditPulse on-chain score
    /// @param _collateralAsset Address of the tokenized collateral or RWA SPV
    /// @return ltvBps Loan to Value in basis points (e.g. 8500 = 85%)
    /// @return interestRateBps Annual interest rate in basis points (e.g. 450 = 4.5%)
    /// @return creditScore The current CreditPulse score (0-100)
    function calculateLoanTerms(address _collateralAsset) 
        public 
        view 
        returns (uint16 ltvBps, uint16 interestRateBps, uint8 creditScore) 
    {
        ICreditPulse.RiskReport memory report = creditPulseOracle.getRiskReport(_collateralAsset);
        creditScore = report.overallScore;

        if (creditScore >= 85) {
            // Tier 1: Bluechip / Sovereign RWA
            ltvBps = 9000;         // 90% LTV
            interestRateBps = 450; // 4.5% APR
        } else if (creditScore >= 75) {
            // Tier 2: Institutional Grade
            ltvBps = 8000;         // 80% LTV
            interestRateBps = 650; // 6.5% APR
        } else if (creditScore >= 60) {
            // Tier 3: Moderate Risk
            ltvBps = 6500;         // 65% LTV
            interestRateBps = 950; // 9.5% APR
        } else if (creditScore >= 50) {
            // Tier 4: Speculative / High Volatility
            ltvBps = 5000;          // 50% LTV
            interestRateBps = 1400; // 14.0% APR
        } else {
            // Sub-50: Unacceptable default risk
            revert InsufficientCreditRating(creditScore, 50);
        }
    }

    /// @notice Originate an undercollateralized loan with risk-adjusted terms
    function borrow(address _collateralAsset, uint256 _collateralAmount) external payable returns (uint256 loanId) {
        return _originateLoan(msg.sender, _collateralAsset, _collateralAmount);
    }

    /// @notice Pull-Oracle Loan Origination: atomically updates CreditPulse oracle score with DON quorum proof and originates loan
    /// @dev Eliminates reliance on off-chain keeper transaction subsidies; the borrower subsidizes oracle delivery gas in 1 atomic tx
    function borrowWithOracleProof(
        address _collateralAsset,
        uint256 _collateralAmount,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        address[] calldata _signers,
        bytes[] calldata _signatures
    ) external payable returns (uint256 loanId) {
        // 1. Update oracle state on-demand
        creditPulseOracle.saveRiskReportMultiSigned(
            _collateralAsset,
            _scores,
            _dataHash,
            _aiDigest,
            _signers,
            _signatures
        );

        // 2. Execute loan origination for the true borrower
        return _originateLoan(msg.sender, _collateralAsset, _collateralAmount);
    }

    function _originateLoan(address _borrower, address _collateralAsset, uint256 _collateralAmount) internal returns (uint256 loanId) {
        if (_collateralAmount == 0) revert InvalidCollateral();

        (uint16 ltvBps, uint16 interestRateBps, uint8 score) = calculateLoanTerms(_collateralAsset);

        uint256 maxBorrowable = (_collateralAmount * ltvBps) / 10000;
        
        loanId = ++loanCount;
        loans[loanId] = Loan({
            borrower: _borrower,
            collateralAsset: _collateralAsset,
            collateralAmount: _collateralAmount,
            borrowedAmount: maxBorrowable,
            interestRateBps: interestRateBps,
            creditScoreAtBorrow: score,
            borrowTimestamp: uint40(block.timestamp),
            isRepaid: false
        });

        borrowerLoans[_borrower].push(loanId);

        emit LoanOriginated(
            loanId, 
            _borrower, 
            _collateralAsset, 
            maxBorrowable, 
            score, 
            ltvBps, 
            interestRateBps
        );
    }
}
