// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/// @title CreditPulse AI — Attestcoin Smart Contract (ASC) v8.0.0 UUPS Upgradeable
/// @author CreditPulse AI Team
/// @notice UUPS-upgradeable version with Pausable + manual reentrancy guard
/// @dev Uses OpenZeppelin v5 upgradeable patterns. Storage layout compatible with V1.

struct MerkleSibling {
    bytes32 hash;
    bool isLeft;
}

struct MerkleProof {
    bytes32 root;
    MerkleSibling[] siblings;
}

struct ContinuityProof {
    bytes32 lowerEndpointDigest;
    bytes32[] roots;
}

interface IBlockProver {
    function verifyAndEmit(
        uint64 chainKey,
        uint64[] memory headerNumbers,
        bytes[] memory encodedTransactions,
        MerkleProof[] memory merkleProofs,
        ContinuityProof memory continuityProof
    ) external returns (bytes32);
}

contract CreditPulseASCV2 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    PausableUpgradeable
{
    /// @dev Manual reentrancy guard (OZ v5 upgradeable doesn't ship one)
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }
    string public constant VERSION = "8.0.0";

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant RISK_REPORT_TYPEHASH = keccak256(
        "RiskReport(address assetAddress,uint8 overallScore,uint8 liquidity,uint8 collateral,uint8 auditScore,uint8 security,uint8 volatility,uint8 governance,bytes32 dataHash,bytes32 aiDigest,uint256 nonce,uint256 deadline)"
    );

    address public blockProver;
    address public oracleSigner;
    uint256 public reportCount;
    uint256 public verifiedProofCount;
    
    // Multi-Oracle Quorum Settings
    uint8 public requiredOracleQuorum;
    mapping(address => bool) public isAuthorizedOracle;
    address[] public authorizedOracles;

    // Economic Staking & Slashing
    uint256 public minOracleStake;
    uint256 public totalOracleStake;
    mapping(address => uint256) public oracleStake;

    // Optimistic Dispute Window & Insurance Pool
    uint256 public constant DISPUTE_PERIOD = 3 days;
    uint256 public challengerBond;
    uint256 public totalInsurancePool;

    // Replay Attack & Nonce Tracking
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public usedProofHashes;

    modifier onlyAuthorizedOracle() {
        require(
            isAuthorizedOracle[msg.sender] || msg.sender == owner() || msg.sender == oracleSigner,
            "Unauthorized: caller is not an authorized oracle"
        );
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
        bytes32 dataHash;
        bytes32 aiDigest;
        bytes32 proofHash;
        uint40 timestamp;
        address verifiedBy;
        bool crossChainVerified;
    }

    struct RWACertificate {
        address assetAddress;
        uint8 score;
        uint16 reserveRatioBps;
        bytes32 porHash;
        bytes32 legalEntityDigest;
        uint40 timestamp;
        address attestedBy;
    }

    struct ZkTLSCertificate {
        address assetAddress;
        uint8 score;
        uint16 reserveRatioBps;
        bytes32 zkTlsProofHash;
        bytes32 custodianKeyHash;
        bytes32 sessionCommitment;
        uint40 timestamp;
        address verifiedBy;
    }

    struct Dispute {
        address challenger;
        uint256 bondAmount;
        uint40 timestamp;
        string evidenceUrl;
        bool active;
        bool resolved;
        bool challengerWon;
    }

    mapping(address => RiskReport[]) public assetReportHistory;
    mapping(address => RWACertificate[]) public rwaCertificateHistory;
    mapping(address => ZkTLSCertificate[]) public zkTlsCertificateHistory;
    mapping(address => mapping(uint256 => Dispute)) public reportDisputes;

    // ─── Events ───
    event ReportSaved(
        address indexed assetAddress, uint8 overallScore, uint8 liquidity, uint8 collateral,
        uint8 auditScore, uint8 security, uint8 volatility, uint8 governance,
        bytes32 dataHash, bytes32 aiDigest, bool crossChainVerified,
        address indexed verifiedBy, uint256 timestamp, uint256 indexed reportIndex
    );
    event VerifiedReportSaved(address indexed assetAddress, uint8 overallScore, bytes32 indexed queryId, address indexed verifiedBy, uint256 timestamp, bytes32 dataHash);
    event MultiSignedReportSaved(address indexed assetAddress, uint8 overallScore, uint8 quorumCount, bytes32 dataHash, address indexed primarySigner, uint256 timestamp);
    event RWACertificateSaved(address indexed assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 porHash, bytes32 legalEntityDigest, address indexed attestedBy, uint256 timestamp);
    event ZkTLSCertificateSaved(address indexed assetAddress, uint8 score, uint16 reserveRatioBps, bytes32 zkTlsProofHash, bytes32 custodianKeyHash, bytes32 sessionCommitment, address indexed verifiedBy, uint256 timestamp);
    event OracleStaked(address indexed oracle, uint256 amount, uint256 totalStake);
    event OracleUnstaked(address indexed oracle, uint256 amount, uint256 remainingStake);
    event OracleSlashed(address indexed oracle, address indexed recipient, uint256 slashedAmount, string reason);
    event OracleAuthorizationChanged(address indexed oracle, bool authorized);
    event QuorumThresholdUpdated(uint8 oldQuorum, uint8 newQuorum);
    event ReportChallenged(address indexed assetAddress, uint256 indexed reportIndex, address indexed challenger, uint256 bondAmount, string evidenceUrl);
    event DisputeResolved(address indexed assetAddress, uint256 indexed reportIndex, address indexed challenger, bool challengerWon, uint256 bountyPaid, uint256 insuranceAdded);
    event OracleSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event BlockProverUpdated(address indexed oldProver, address indexed newProver);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Replaces constructor for UUPS proxy pattern
    function initialize(address _blockProver, address _oracleSigner) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        _reentrancyStatus = _NOT_ENTERED;

        blockProver = _blockProver;
        oracleSigner = _oracleSigner;
        requiredOracleQuorum = 2;
        minOracleStake = 0.01 ether;
        challengerBond = 0.05 ether;

        isAuthorizedOracle[msg.sender] = true;
        authorizedOracles.push(msg.sender);

        if (_oracleSigner != address(0) && _oracleSigner != msg.sender) {
            isAuthorizedOracle[_oracleSigner] = true;
            authorizedOracles.push(_oracleSigner);
        }
    }

    /// @notice UUPS upgrade authorization — only owner can upgrade
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ==========================================
    // 1. Multi-Oracle DON Quorum Administration
    // ==========================================

    function setOracleAuthorization(address _oracle, bool _authorized) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        if (_authorized && !isAuthorizedOracle[_oracle]) {
            isAuthorizedOracle[_oracle] = true;
            authorizedOracles.push(_oracle);
            emit OracleAuthorizationChanged(_oracle, true);
        } else if (!_authorized && isAuthorizedOracle[_oracle]) {
            isAuthorizedOracle[_oracle] = false;
            for (uint256 i = 0; i < authorizedOracles.length; i++) {
                if (authorizedOracles[i] == _oracle) {
                    authorizedOracles[i] = authorizedOracles[authorizedOracles.length - 1];
                    authorizedOracles.pop();
                    break;
                }
            }
            emit OracleAuthorizationChanged(_oracle, false);
        }
    }

    function setRequiredOracleQuorum(uint8 _newQuorum) external onlyOwner {
        require(_newQuorum >= 1, "Quorum must be at least 1");
        emit QuorumThresholdUpdated(requiredOracleQuorum, _newQuorum);
        requiredOracleQuorum = _newQuorum;
    }

    // ==========================================
    // 2. Economic Staking & Slashing
    // ==========================================

    function stakeOracle() external payable nonReentrant {
        require(msg.value > 0, "Stake must be greater than 0");
        require(isAuthorizedOracle[msg.sender] || msg.sender == owner(), "Must be authorized oracle");
        oracleStake[msg.sender] += msg.value;
        totalOracleStake += msg.value;
        emit OracleStaked(msg.sender, msg.value, oracleStake[msg.sender]);
    }

    function unstakeOracle(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(oracleStake[msg.sender] >= _amount, "Insufficient stake");
        uint256 remainingStake = oracleStake[msg.sender] - _amount;
        if (isAuthorizedOracle[msg.sender]) {
            require(remainingStake == 0 || remainingStake >= minOracleStake, "Remaining stake must be 0 or >= minimum");
        }
        oracleStake[msg.sender] = remainingStake;
        totalOracleStake -= _amount;
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Unstake transfer failed");
        emit OracleUnstaked(msg.sender, _amount, remainingStake);
    }

    function slashOracle(address _maliciousOracle, address _recipient, uint256 _amount, string calldata _reason) external onlyOwner nonReentrant {
        require(_maliciousOracle != address(0) && _recipient != address(0), "Invalid address");
        require(_amount > 0 && oracleStake[_maliciousOracle] >= _amount, "Invalid slash amount");
        oracleStake[_maliciousOracle] -= _amount;
        totalOracleStake -= _amount;
        (bool success, ) = payable(_recipient).call{value: _amount}("");
        require(success, "Slash compensation failed");
        emit OracleSlashed(_maliciousOracle, _recipient, _amount, _reason);
    }

    // ==========================================
    // 3. Optimistic Dispute Window
    // ==========================================

    function challengeReport(address _assetAddress, uint256 _reportIndex, string calldata _evidenceUrl) external payable whenNotPaused nonReentrant {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_reportIndex < assetReportHistory[_assetAddress].length, "Report index out of bounds");
        require(msg.value >= challengerBond, "Insufficient challenger bond");
        RiskReport memory report = assetReportHistory[_assetAddress][_reportIndex];
        require(block.timestamp <= report.timestamp + DISPUTE_PERIOD, "Dispute window expired");
        require(!reportDisputes[_assetAddress][_reportIndex].active, "Dispute already active");
        reportDisputes[_assetAddress][_reportIndex] = Dispute({
            challenger: msg.sender, bondAmount: msg.value, timestamp: uint40(block.timestamp),
            evidenceUrl: _evidenceUrl, active: true, resolved: false, challengerWon: false
        });
        emit ReportChallenged(_assetAddress, _reportIndex, msg.sender, msg.value, _evidenceUrl);
    }

    function resolveDispute(address _assetAddress, uint256 _reportIndex, bool _upholdChallenge, address _maliciousOracle) external onlyOwner nonReentrant {
        require(reportDisputes[_assetAddress][_reportIndex].active, "No active dispute");
        require(!reportDisputes[_assetAddress][_reportIndex].resolved, "Already resolved");
        Dispute storage dispute = reportDisputes[_assetAddress][_reportIndex];
        dispute.resolved = true;
        dispute.active = false;
        dispute.challengerWon = _upholdChallenge;
        if (_upholdChallenge) {
            uint256 slashAmount = 0;
            if (_maliciousOracle != address(0) && oracleStake[_maliciousOracle] > 0) {
                slashAmount = oracleStake[_maliciousOracle] >= challengerBond ? challengerBond : oracleStake[_maliciousOracle];
                oracleStake[_maliciousOracle] -= slashAmount;
                totalOracleStake -= slashAmount;
            }
            uint256 bounty = dispute.bondAmount + (slashAmount / 2);
            uint256 insuranceAddition = slashAmount - (slashAmount / 2);
            totalInsurancePool += insuranceAddition;
            (bool success, ) = payable(dispute.challenger).call{value: bounty}("");
            require(success, "Bounty transfer failed");
            emit DisputeResolved(_assetAddress, _reportIndex, dispute.challenger, true, bounty, insuranceAddition);
        } else {
            totalInsurancePool += dispute.bondAmount;
            emit DisputeResolved(_assetAddress, _reportIndex, dispute.challenger, false, 0, dispute.bondAmount);
        }
    }

    function isReportFinalized(address _assetAddress, uint256 _reportIndex) external view returns (bool) {
        if (_reportIndex >= assetReportHistory[_assetAddress].length) return false;
        RiskReport memory r = assetReportHistory[_assetAddress][_reportIndex];
        return (block.timestamp > r.timestamp + DISPUTE_PERIOD) && !reportDisputes[_assetAddress][_reportIndex].active;
    }

    // ==========================================
    // 4. Multi-Oracle Quorum Submission (DON)
    // ==========================================

    function saveRiskReportMultiSigned(
        address _assetAddress, uint8[7] calldata _scores, bytes32 _dataHash, bytes32 _aiDigest,
        address[] calldata _signers, bytes[] calldata _signatures
    ) external whenNotPaused {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_scores[0] <= 100, "Score exceeds maximum");
        require(_dataHash != bytes32(0), "dataHash required");
        require(_signers.length >= requiredOracleQuorum, "Quorum not met");
        require(_signers.length == _signatures.length, "Signers and signatures mismatch");

        bytes32 messageHash = keccak256(abi.encodePacked(
            _assetAddress, _scores[0], _scores[1], _scores[2], _scores[3], _scores[4], _scores[5], _scores[6], _dataHash
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        address lastSigner = address(0);
        uint8 validQuorumCount = 0;
        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer > lastSigner, "Signers must be sorted and unique");
            require(isAuthorizedOracle[signer] || signer == owner() || signer == oracleSigner, "Unauthorized oracle signer");
            require(_recoverSigner(ethSignedMessageHash, _signatures[i]) == signer, "Invalid signature");
            lastSigner = signer;
            validQuorumCount++;
        }
        require(validQuorumCount >= requiredOracleQuorum, "Valid quorum count insufficient");

        _recordReport(_assetAddress, _scores[0], _scores[1], _scores[2], _scores[3], _scores[4], _scores[5], _scores[6], _dataHash, _aiDigest, bytes32(0), msg.sender, false);
        emit MultiSignedReportSaved(_assetAddress, _scores[0], validQuorumCount, _dataHash, _signers[0], block.timestamp);
    }

    // ==========================================
    // 5. zkTLS Proof-of-Reserve
    // ==========================================

    function saveRWAZkTLSCertificate(
        address _assetAddress, uint8 _score, uint16 _reserveRatioBps,
        bytes32 _zkTlsProofHash, bytes32 _custodianKeyHash, bytes32 _sessionCommitment
    ) external onlyAuthorizedOracle whenNotPaused {
        require(_assetAddress != address(0) && _score <= 100, "Invalid params");
        require(_reserveRatioBps > 0 && _zkTlsProofHash != bytes32(0) && _sessionCommitment != bytes32(0), "Missing proof data");
        zkTlsCertificateHistory[_assetAddress].push(ZkTLSCertificate({
            assetAddress: _assetAddress, score: _score, reserveRatioBps: _reserveRatioBps,
            zkTlsProofHash: _zkTlsProofHash, custodianKeyHash: _custodianKeyHash,
            sessionCommitment: _sessionCommitment, timestamp: uint40(block.timestamp), verifiedBy: msg.sender
        }));
        emit ZkTLSCertificateSaved(_assetAddress, _score, _reserveRatioBps, _zkTlsProofHash, _custodianKeyHash, _sessionCommitment, msg.sender, block.timestamp);
    }

    // ==========================================
    // 6. RWA Proof-of-Reserve (PoR)
    // ==========================================

    function saveRWACertificate(
        address _assetAddress, uint8 _score, uint16 _reserveRatioBps, bytes32 _porHash, bytes32 _legalEntityDigest
    ) external onlyAuthorizedOracle whenNotPaused {
        require(_assetAddress != address(0) && _score <= 100, "Invalid params");
        require(_reserveRatioBps > 0 && _porHash != bytes32(0), "Missing PoR data");
        rwaCertificateHistory[_assetAddress].push(RWACertificate({
            assetAddress: _assetAddress, score: _score, reserveRatioBps: _reserveRatioBps,
            porHash: _porHash, legalEntityDigest: _legalEntityDigest,
            timestamp: uint40(block.timestamp), attestedBy: msg.sender
        }));
        emit RWACertificateSaved(_assetAddress, _score, _reserveRatioBps, _porHash, _legalEntityDigest, msg.sender, block.timestamp);
    }

    // ==========================================
    // 7. Report Saving & Cross-Chain Verification
    // ==========================================

    function saveRiskReportWithDigest(
        address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral,
        uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance,
        bytes32 _dataHash, bytes32 _aiDigest
    ) external onlyAuthorizedOracle whenNotPaused {
        require(_assetAddress != address(0) && _overallScore <= 100 && _dataHash != bytes32(0), "Invalid params");
        _recordReport(_assetAddress, _overallScore, _liquidity, _collateral, _auditScore, _security, _volatility, _governance, _dataHash, _aiDigest, bytes32(0), msg.sender, false);
    }

    function saveRiskReport(
        address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral,
        uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance, bytes32 _dataHash
    ) external onlyAuthorizedOracle whenNotPaused {
        require(_assetAddress != address(0) && _overallScore <= 100 && _dataHash != bytes32(0), "Invalid params");
        _recordReport(_assetAddress, _overallScore, _liquidity, _collateral, _auditScore, _security, _volatility, _governance, _dataHash, bytes32(0), bytes32(0), msg.sender, false);
    }

    // ==========================================
    // 8. Emergency Controls (new in V2)
    // ==========================================

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ==========================================
    // Internal helpers
    // ==========================================

    function _recordReport(
        address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral,
        uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance,
        bytes32 _dataHash, bytes32 _aiDigest, bytes32 _proofHash, address _verifiedBy, bool _crossChainVerified
    ) internal {
        reportCount++;
        assetReportHistory[_assetAddress].push(RiskReport({
            assetAddress: _assetAddress, overallScore: _overallScore, liquidity: _liquidity,
            collateral: _collateral, auditScore: _auditScore, security: _security,
            volatility: _volatility, governance: _governance, dataHash: _dataHash, aiDigest: _aiDigest,
            proofHash: _proofHash, timestamp: uint40(block.timestamp), verifiedBy: _verifiedBy,
            crossChainVerified: _crossChainVerified
        }));
        emit ReportSaved(_assetAddress, _overallScore, _liquidity, _collateral, _auditScore, _security, _volatility, _governance, _dataHash, _aiDigest, _crossChainVerified, _verifiedBy, block.timestamp, assetReportHistory[_assetAddress].length - 1);
    }

    function _recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _sig) internal pure returns (address) {
        require(_sig.length == 65, "Invalid signature length");
        bytes32 r; bytes32 s; uint8 v;
        assembly ("memory-safe") {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid 's'");
        address signer = ecrecover(_ethSignedMessageHash, v, r, s);
        require(signer != address(0), "Invalid signature recovery");
        return signer;
    }

    // ==========================================
    // View functions
    // ==========================================

    function getReportHistory(address _assetAddress) external view returns (RiskReport[] memory) { return assetReportHistory[_assetAddress]; }
    function getAssetReportCount(address _assetAddress) external view returns (uint256) { return assetReportHistory[_assetAddress].length; }
    function getRiskReport(address _assetAddress) external view returns (RiskReport memory) {
        uint256 len = assetReportHistory[_assetAddress].length;
        require(len > 0, "No reports found");
        return assetReportHistory[_assetAddress][len - 1];
    }
    function verifyDataIntegrity(address _assetAddress, bytes32 _expectedDataHash) external view returns (bool) {
        uint256 len = assetReportHistory[_assetAddress].length;
        if (len == 0) return false;
        return assetReportHistory[_assetAddress][len - 1].dataHash == _expectedDataHash;
    }
    function getZkTLSCertificateHistory(address _assetAddress) external view returns (ZkTLSCertificate[] memory) { return zkTlsCertificateHistory[_assetAddress]; }
    function getRWACertificateHistory(address _assetAddress) external view returns (RWACertificate[] memory) { return rwaCertificateHistory[_assetAddress]; }

    // ==========================================
    // Admin
    // ==========================================

    function setOracleSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer");
        emit OracleSignerUpdated(oracleSigner, _newSigner);
        oracleSigner = _newSigner;
    }

    function setBlockProver(address _newProver) external onlyOwner {
        require(_newProver != address(0), "Invalid prover");
        emit BlockProverUpdated(blockProver, _newProver);
        blockProver = _newProver;
    }
}
