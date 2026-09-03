// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/// @title CreditPulseInsurancePool — Institutional Reinsurance & First-Loss Tranche Protocol
/// @notice Provides underwritten liquidity backstops for lending pools integrating CreditPulse ratings
/// @dev Implements a dual-tranche (Junior First-Loss vs. Senior Protected) risk underwriting model (Morpho/Euler curation architecture)
/// @dev Security: Manual reentrancy guard + Pausable + CEI pattern for defense-in-depth
contract CreditPulseInsurancePool is Initializable, OwnableUpgradeable, PausableUpgradeable {

    // ==========================================
    // Reentrancy Guard (manual, OZ v5 upgradeable compat)
    // ==========================================
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    struct Tranche {
        uint256 totalDeposited;
        uint256 totalClaimed;
        uint16 apyBps;          // Annual yield in basis points
        uint16 lossAbsorptionPct; // % of deficit absorbed
    }

    // Tranche 1: Junior (First-Loss Capital) — Absorbs 80% of protocol shortfalls, receives 12% APY
    // Tranche 2: Senior (Protected Capital) — Absorbs 20% of residual shortfalls, receives 4.5% APY
    Tranche public juniorTranche;
    Tranche public seniorTranche;

    mapping(address => uint256) public juniorDeposits;
    mapping(address => uint256) public seniorDeposits;

    address public creditPulseOracle;
    address public authorizedDisputeResolver;

    event TrancheDeposited(address indexed provider, uint8 indexed trancheId, uint256 amount);
    event TrancheWithdrawn(address indexed provider, uint8 indexed trancheId, uint256 amount);
    event DeficitPayoutExecuted(address indexed protocolRecipient, uint256 juniorPaid, uint256 seniorPaid, string incidentRef);

    error InsufficientTrancheLiquidity();
    error UnauthorizedResolver();
    error InvalidTrancheId();
    error WithdrawalCooldownActive();
    error InsufficientDeposit();
    error ZeroAddress();
    error ZeroAmount();

    /// @dev 24-hour withdrawal cooldown to prevent flash-loan drain attacks
    uint256 public constant WITHDRAWAL_COOLDOWN = 24 hours;
    mapping(address => uint256) public lastDepositTimestamp;

    function initialize(address _creditPulseOracle, address _resolver) external initializer {
        if (_creditPulseOracle == address(0) || _resolver == address(0)) revert ZeroAddress();

        __Ownable_init(msg.sender);
        __Pausable_init();

        _reentrancyStatus = _NOT_ENTERED;

        creditPulseOracle = _creditPulseOracle;
        authorizedDisputeResolver = _resolver;

        juniorTranche = Tranche({totalDeposited: 0, totalClaimed: 0, apyBps: 1200, lossAbsorptionPct: 80});
        seniorTranche = Tranche({totalDeposited: 0, totalClaimed: 0, apyBps: 450, lossAbsorptionPct: 20});
    }

    /// @notice Deposit liquidity into Junior (1) or Senior (2) underwriting tranche
    function depositToTranche(uint8 _trancheId) external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();

        if (_trancheId == 1) {
            juniorTranche.totalDeposited += msg.value;
            juniorDeposits[msg.sender] += msg.value;
        } else if (_trancheId == 2) {
            seniorTranche.totalDeposited += msg.value;
            seniorDeposits[msg.sender] += msg.value;
        } else {
            revert InvalidTrancheId();
        }

        lastDepositTimestamp[msg.sender] = block.timestamp;
        emit TrancheDeposited(msg.sender, _trancheId, msg.value);
    }

    /// @notice Withdraw liquidity from Junior (1) or Senior (2) tranche after 24h cooldown
    /// @dev CEI pattern: Checks → Effects → Interactions. nonReentrant prevents reentrancy via .call{value}
    function withdrawFromTranche(uint8 _trancheId, uint256 _amount) external whenNotPaused nonReentrant {
        // CHECKS
        if (_amount == 0) revert ZeroAmount();

        if (block.timestamp < lastDepositTimestamp[msg.sender] + WITHDRAWAL_COOLDOWN) {
            revert WithdrawalCooldownActive();
        }

        // EFFECTS (state changes BEFORE external call)
        if (_trancheId == 1) {
            if (juniorDeposits[msg.sender] < _amount) revert InsufficientDeposit();
            juniorDeposits[msg.sender] -= _amount;
            juniorTranche.totalDeposited -= _amount;
        } else if (_trancheId == 2) {
            if (seniorDeposits[msg.sender] < _amount) revert InsufficientDeposit();
            seniorDeposits[msg.sender] -= _amount;
            seniorTranche.totalDeposited -= _amount;
        } else {
            revert InvalidTrancheId();
        }

        if (_amount > address(this).balance) revert InsufficientTrancheLiquidity();

        // Emit BEFORE external call (CEI)
        emit TrancheWithdrawn(msg.sender, _trancheId, _amount);

        // INTERACTIONS (external call LAST)
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Withdrawal transfer failed");
    }

    /// @notice Execute insurance deficit payout to a damaged lending pool upon verified oracle dispute
    /// @dev nonReentrant + CEI to prevent drain attacks via malicious _protocolRecipient
    function executeDeficitPayout(
        address payable _protocolRecipient,
        uint256 _deficitAmount,
        string calldata _incidentRef
    ) external whenNotPaused nonReentrant {
        if (msg.sender != authorizedDisputeResolver && msg.sender != owner()) {
            revert UnauthorizedResolver();
        }
        if (_protocolRecipient == address(0)) revert ZeroAddress();
        if (_deficitAmount == 0) revert ZeroAmount();

        uint256 juniorShare = (_deficitAmount * juniorTranche.lossAbsorptionPct) / 100;
        uint256 seniorShare = _deficitAmount - juniorShare;

        uint256 contractBalance = address(this).balance;
        if (juniorShare + seniorShare > contractBalance) {
            // Cap payout to available balance, prioritizing junior absorption
            if (juniorShare > contractBalance) {
                juniorShare = contractBalance;
                seniorShare = 0;
            } else {
                seniorShare = contractBalance - juniorShare;
            }
        }

        // EFFECTS before INTERACTIONS
        juniorTranche.totalClaimed += juniorShare;
        seniorTranche.totalClaimed += seniorShare;

        uint256 totalPayout = juniorShare + seniorShare;

        // Emit BEFORE external call (CEI)
        emit DeficitPayoutExecuted(_protocolRecipient, juniorShare, seniorShare, _incidentRef);

        // INTERACTIONS last
        if (totalPayout > 0) {
            (bool success, ) = _protocolRecipient.call{value: totalPayout}("");
            require(success, "Insurance payout transfer failed");
        }
    }

    /// @notice Total underwriting capacity across all tranches
    function totalUnderwritingCapacity() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get individual deposit balance for a provider
    function getProviderBalance(address _provider) external view returns (uint256 junior, uint256 senior) {
        return (juniorDeposits[_provider], seniorDeposits[_provider]);
    }

    /// @notice Pause the contract (owner only, emergency)
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause the contract (owner only)
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
