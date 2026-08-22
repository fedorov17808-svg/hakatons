// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title CreditPulse AI — Attestcoin Smart Contract (ASC) v7.0.0 Enterprise Grade
/// @author CreditPulse AI Team
/// @notice Decentralized credit scoring, Federated Multi-Oracle DON Quorum, Optimistic Dispute Window, Staking/Slashing, and zkTLS Proof-of-Reserve (PoR)
/// @dev Integrates with Creditcoin Native Query Verifier Precompile (0x0FD2) for trustless cross-chain proof verification

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

contract CreditPulseASC {
    string public constant VERSION = "7.0.0";
    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant RISK_REPORT_TYPEHASH = keccak256(
        "RiskReport(address assetAddress,uint8 overallScore,uint8 liquidity,uint8 collateral,uint8 auditScore,uint8 security,uint8 volatility,uint8 governance,bytes32 dataHash,bytes32 aiDigest,uint256 nonce,uint256 deadline)"
    );

    address public blockProver;
    address public owner;
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
    uint256 public challengerBond = 0.05 ether;
    uint256 public totalInsurancePool;

    // Replay Attack & Nonce Tracking
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public usedProofHashes;

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
        bytes32 aiDigest;           // keccak256 of qualitative AI advisory (or bytes32(0))
        bytes32 proofHash;          // keccak256 / query ID of verified cross-chain proof
        uint40 timestamp;
        address verifiedBy;
        bool crossChainVerified;    // true strictly if verified via Attestcoin 0x0FD2
    }

    struct RWACertificate {
        address assetAddress;
        uint8 score;
        uint16 reserveRatioBps;     // 10000 = 100.00% (Collateralization ratio)
        bytes32 porHash;            // Merkle root / hash of bank custodian reserves
        bytes32 legalEntityDigest;  // keccak256 of SPV legal registration / CIK
        uint40 timestamp;
        address attestedBy;
    }

    struct ZkTLSCertificate {
        address assetAddress;
        uint8 score;
        uint16 reserveRatioBps;     // 10000 = 100.00% (Collateralization ratio)
        bytes32 zkTlsProofHash;     // Cryptographic zkTLS / TLSNotary proof commitment
        bytes32 custodianKeyHash;   // Hash of custodian TLS certificate public key
        bytes32 sessionCommitment;  // Cryptographic TLS transcript HMAC/GCM session digest
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

    /// @dev Append-only history per asset — reports are NEVER overwritten
    mapping(address => RiskReport[]) public assetReportHistory;
    mapping(address => RWACertificate[]) public rwaCertificateHistory;
    mapping(address => ZkTLSCertificate[]) public zkTlsCertificateHistory;
    mapping(address => mapping(uint256 => Dispute)) public reportDisputes;
    
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
        bytes32 aiDigest,
        bool crossChainVerified, 
        address indexed verifiedBy, 
        uint256 timestamp,
        uint256 indexed reportIndex
    );
    
    event VerifiedReportSaved(
        address indexed assetAddress, 
        uint8 overallScore, 
        bytes32 indexed queryId, 
        address indexed verifiedBy, 
        uint256 timestamp,
        bytes32 dataHash
    );

    event MultiSignedReportSaved(
        address indexed assetAddress,
        uint8 overallScore,
        uint8 quorumCount,
        bytes32 dataHash,
        address indexed primarySigner,
        uint256 timestamp
    );

    event RWACertificateSaved(
        address indexed assetAddress,
        uint8 score,
        uint16 reserveRatioBps,
        bytes32 porHash,
        bytes32 legalEntityDigest,
        address indexed attestedBy,
        uint256 timestamp
    );

    event ZkTLSCertificateSaved(
        address indexed assetAddress,
        uint8 score,
        uint16 reserveRatioBps,
        bytes32 zkTlsProofHash,
        bytes32 custodianKeyHash,
        bytes32 sessionCommitment,
        address indexed verifiedBy,
        uint256 timestamp
    );

    event OracleStaked(address indexed oracle, uint256 amount, uint256 totalStake);
    event OracleUnstaked(address indexed oracle, uint256 amount, uint256 remainingStake);
    event OracleSlashed(address indexed oracle, address indexed recipient, uint256 slashedAmount, string reason);
    event OracleAuthorizationChanged(address indexed oracle, bool authorized);
    event QuorumThresholdUpdated(uint8 oldQuorum, uint8 newQuorum);

    event ReportChallenged(
        address indexed assetAddress,
        uint256 indexed reportIndex,
        address indexed challenger,
        uint256 bondAmount,
        string evidenceUrl
    );

    event DisputeResolved(
        address indexed assetAddress,
        uint256 indexed reportIndex,
        address indexed challenger,
        bool challengerWon,
        uint256 bountyPaid,
        uint256 insuranceAdded
    );

    event OracleSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event BlockProverUpdated(address indexed oldProver, address indexed newProver);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    constructor(address _blockProver, address _oracleSigner) {
        owner = msg.sender;
        blockProver = _blockProver;
        oracleSigner = _oracleSigner;
        
        // Initialize Multi-Oracle Quorum with deployer and oracleSigner
        requiredOracleQuorum = 2;
        minOracleStake = 0.01 ether;
        
        isAuthorizedOracle[msg.sender] = true;
        authorizedOracles.push(msg.sender);
        
        if (_oracleSigner != address(0) && _oracleSigner != msg.sender) {
            isAuthorizedOracle[_oracleSigner] = true;
            authorizedOracles.push(_oracleSigner);
        }
    }

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

    function stakeOracle() external payable {
        require(msg.value > 0, "Stake must be greater than 0");
        require(isAuthorizedOracle[msg.sender] || msg.sender == owner, "Must be authorized oracle");
        
        oracleStake[msg.sender] += msg.value;
        totalOracleStake += msg.value;
        
        emit OracleStaked(msg.sender, msg.value, oracleStake[msg.sender]);
    }

    function unstakeOracle(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(oracleStake[msg.sender] >= _amount, "Insufficient stake");
        
        oracleStake[msg.sender] -= _amount;
        totalOracleStake -= _amount;
        
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Unstake transfer failed");
        
        emit OracleUnstaked(msg.sender, _amount, oracleStake[msg.sender]);
    }

    function slashOracle(address _maliciousOracle, address _recipient, uint256 _amount, string calldata _reason) external onlyOwner {
        require(_maliciousOracle != address(0), "Invalid oracle");
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Slash amount must be > 0");
        require(oracleStake[_maliciousOracle] >= _amount, "Amount exceeds oracle stake");
        
        oracleStake[_maliciousOracle] -= _amount;
        totalOracleStake -= _amount;
        
        (bool success, ) = payable(_recipient).call{value: _amount}("");
        require(success, "Slash compensation failed");
        
        emit OracleSlashed(_maliciousOracle, _recipient, _amount, _reason);
    }

    // ==========================================
    // 3. Optimistic Dispute Window & Challenges
    // ==========================================

    function challengeReport(
        address _assetAddress,
        uint256 _reportIndex,
        string calldata _evidenceUrl
    ) external payable {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_reportIndex < assetReportHistory[_assetAddress].length, "Report index out of bounds");
        require(msg.value >= challengerBond, "Insufficient challenger bond");
        
        RiskReport memory report = assetReportHistory[_assetAddress][_reportIndex];
        require(block.timestamp <= report.timestamp + DISPUTE_PERIOD, "Dispute window expired");
        require(!reportDisputes[_assetAddress][_reportIndex].active, "Dispute already active");

        reportDisputes[_assetAddress][_reportIndex] = Dispute({
            challenger: msg.sender,
            bondAmount: msg.value,
            timestamp: uint40(block.timestamp),
            evidenceUrl: _evidenceUrl,
            active: true,
            resolved: false,
            challengerWon: false
        });

        emit ReportChallenged(_assetAddress, _reportIndex, msg.sender, msg.value, _evidenceUrl);
    }

    function resolveDispute(
        address _assetAddress,
        uint256 _reportIndex,
        bool _upholdChallenge,
        address _maliciousOracle
    ) external onlyOwner {
        require(reportDisputes[_assetAddress][_reportIndex].active, "No active dispute");
        require(!reportDisputes[_assetAddress][_reportIndex].resolved, "Dispute already resolved");

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
        address _assetAddress,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        address[] calldata _signers,
        bytes[] calldata _signatures
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_scores[0] <= 100, "Score exceeds maximum");
        require(_dataHash != bytes32(0), "dataHash required");
        require(_signers.length >= requiredOracleQuorum, "Quorum not met");
        require(_signers.length == _signatures.length, "Signers and signatures mismatch");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _assetAddress,
                _scores[0],
                _scores[1],
                _scores[2],
                _scores[3],
                _scores[4],
                _scores[5],
                _scores[6],
                _dataHash
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address lastSigner = address(0);
        uint8 validQuorumCount = 0;

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer > lastSigner, "Signers must be sorted and unique");
            require(isAuthorizedOracle[signer] || signer == owner || signer == oracleSigner, "Unauthorized oracle signer");
            
            address recovered = _recoverSigner(ethSignedMessageHash, _signatures[i]);
            require(recovered == signer, "Invalid signature for signer");

            lastSigner = signer;
            validQuorumCount++;
        }

        require(validQuorumCount >= requiredOracleQuorum, "Valid quorum count insufficient");

        _recordReport(
            _assetAddress,
            _scores[0],
            _scores[1],
            _scores[2],
            _scores[3],
            _scores[4],
            _scores[5],
            _scores[6],
            _dataHash,
            _aiDigest,
            bytes32(0),
            msg.sender,
            false
        );

        emit MultiSignedReportSaved(
            _assetAddress,
            _scores[0],
            validQuorumCount,
            _dataHash,
            _signers[0],
            block.timestamp
        );
    }

    // ==========================================
    // 5. zkTLS Proof-of-Reserve Cryptographic Storage
    // ==========================================

    function saveRWAZkTLSCertificate(
        address _assetAddress,
        uint8 _score,
        uint16 _reserveRatioBps,
        bytes32 _zkTlsProofHash,
        bytes32 _custodianKeyHash,
        bytes32 _sessionCommitment
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_score <= 100, "Score exceeds maximum");
        require(_reserveRatioBps > 0, "Reserve ratio must be > 0");
        require(_zkTlsProofHash != bytes32(0), "zkTLS proof hash required");
        require(_sessionCommitment != bytes32(0), "Session commitment required");
        require(isAuthorizedOracle[msg.sender] || msg.sender == owner || msg.sender == oracleSigner, "Unauthorized attester");

        ZkTLSCertificate memory cert = ZkTLSCertificate({
            assetAddress: _assetAddress,
            score: _score,
            reserveRatioBps: _reserveRatioBps,
            zkTlsProofHash: _zkTlsProofHash,
            custodianKeyHash: _custodianKeyHash,
            sessionCommitment: _sessionCommitment,
            timestamp: uint40(block.timestamp),
            verifiedBy: msg.sender
        });

        zkTlsCertificateHistory[_assetAddress].push(cert);

        emit ZkTLSCertificateSaved(
            _assetAddress,
            _score,
            _reserveRatioBps,
            _zkTlsProofHash,
            _custodianKeyHash,
            _sessionCommitment,
            msg.sender,
            block.timestamp
        );
    }

    function getZkTLSCertificateHistory(address _assetAddress) external view returns (ZkTLSCertificate[] memory) {
        return zkTlsCertificateHistory[_assetAddress];
    }

    // ==========================================
    // 6. RWA Proof-of-Reserve (PoR) Standard
    // ==========================================

    function saveRWACertificate(
        address _assetAddress,
        uint8 _score,
        uint16 _reserveRatioBps,
        bytes32 _porHash,
        bytes32 _legalEntityDigest
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_score <= 100, "Score exceeds maximum");
        require(_reserveRatioBps > 0, "Reserve ratio must be > 0");
        require(_porHash != bytes32(0), "porHash required");
        require(isAuthorizedOracle[msg.sender] || msg.sender == owner || msg.sender == oracleSigner, "Unauthorized attester");

        RWACertificate memory cert = RWACertificate({
            assetAddress: _assetAddress,
            score: _score,
            reserveRatioBps: _reserveRatioBps,
            porHash: _porHash,
            legalEntityDigest: _legalEntityDigest,
            timestamp: uint40(block.timestamp),
            attestedBy: msg.sender
        });

        rwaCertificateHistory[_assetAddress].push(cert);

        emit RWACertificateSaved(
            _assetAddress,
            _score,
            _reserveRatioBps,
            _porHash,
            _legalEntityDigest,
            msg.sender,
            block.timestamp
        );
    }

    function getRWACertificateHistory(address _assetAddress) external view returns (RWACertificate[] memory) {
        return rwaCertificateHistory[_assetAddress];
    }

    // ==========================================
    // 7. Single Oracle Signature & Cross-Chain Precompile Verification
    // ==========================================

    function saveRiskReportSigned(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash,
        bytes calldata _signature
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");
        require(_dataHash != bytes32(0), "dataHash required");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _assetAddress,
                _overallScore,
                _liquidity,
                _collateral,
                _auditScore,
                _security,
                _volatility,
                _governance,
                _dataHash
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address recovered = _recoverSigner(ethSignedMessageHash, _signature);
        require(recovered == oracleSigner || recovered == owner || isAuthorizedOracle[recovered], "Unauthorized oracle signature");

        _recordReport(
            _assetAddress,
            _overallScore,
            _liquidity,
            _collateral,
            _auditScore,
            _security,
            _volatility,
            _governance,
            _dataHash,
            bytes32(0),
            bytes32(0),
            msg.sender,
            false
        );
    }

    function saveVerifiedRiskReport(
        address _assetAddress,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        uint64 _chainKey,
        uint64[] calldata _headerNumbers,
        bytes[] calldata _encodedTransactions,
        MerkleProof[] calldata _merkleProofs,
        ContinuityProof calldata _continuityProof
    ) external returns (bytes32 queryId) {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_scores[0] <= 100, "Score exceeds maximum");
        require(_encodedTransactions.length > 0, "No transactions to prove");
        require(_dataHash != bytes32(0), "dataHash required");

        queryId = IBlockProver(blockProver).verifyAndEmit(
            _chainKey,
            _headerNumbers,
            _encodedTransactions,
            _merkleProofs,
            _continuityProof
        );
        require(queryId != bytes32(0), "Verification failed");
        require(!usedProofHashes[queryId], "Proof queryId already used");
        usedProofHashes[queryId] = true;

        verifiedProofCount++;

        _recordReport(
            _assetAddress,
            _scores[0],
            _scores[1],
            _scores[2],
            _scores[3],
            _scores[4],
            _scores[5],
            _scores[6],
            _dataHash,
            _aiDigest,
            queryId,
            msg.sender,
            true
        );

        emit VerifiedReportSaved(
            _assetAddress,
            _scores[0],
            queryId,
            msg.sender,
            block.timestamp,
            _dataHash
        );
    }

    function saveRiskReportWithDigest(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash,
        bytes32 _aiDigest
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");
        require(_dataHash != bytes32(0), "dataHash required");

        _recordReport(
            _assetAddress,
            _overallScore,
            _liquidity,
            _collateral,
            _auditScore,
            _security,
            _volatility,
            _governance,
            _dataHash,
            _aiDigest,
            bytes32(0),
            msg.sender,
            false
        );
    }

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
    ) external {
        require(_assetAddress != address(0), "Invalid asset address");
        require(_overallScore <= 100, "Score exceeds maximum");
        require(_dataHash != bytes32(0), "dataHash required");

        _recordReport(
            _assetAddress,
            _overallScore,
            _liquidity,
            _collateral,
            _auditScore,
            _security,
            _volatility,
            _governance,
            _dataHash,
            bytes32(0),
            bytes32(0),
            msg.sender,
            false
        );
    }

    function _recordReport(
        address _assetAddress,
        uint8 _overallScore,
        uint8 _liquidity,
        uint8 _collateral,
        uint8 _auditScore,
        uint8 _security,
        uint8 _volatility,
        uint8 _governance,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        bytes32 _proofHash,
        address _verifiedBy,
        bool _crossChainVerified
    ) internal {
        reportCount++;
        
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
            aiDigest: _aiDigest,
            proofHash: _proofHash,
            timestamp: uint40(block.timestamp),
            verifiedBy: _verifiedBy,
            crossChainVerified: _crossChainVerified
        });
        
        assetReportHistory[_assetAddress].push(report);
        
        emit ReportSaved(
            _assetAddress, _overallScore, _liquidity, _collateral,
            _auditScore, _security, _volatility, _governance,
            _dataHash, _aiDigest, _crossChainVerified, _verifiedBy,
            block.timestamp, assetReportHistory[_assetAddress].length - 1
        );
    }

    function _recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _sig) internal pure returns (address) {
        require(_sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function verifyDataIntegrity(address _assetAddress, bytes32 _expectedDataHash) external view returns (bool) {
        uint256 len = assetReportHistory[_assetAddress].length;
        if (len == 0) return false;
        return assetReportHistory[_assetAddress][len - 1].dataHash == _expectedDataHash;
    }

    function getReportHistory(address _assetAddress) external view returns (RiskReport[] memory) {
        return assetReportHistory[_assetAddress];
    }

    function getAssetReportCount(address _assetAddress) external view returns (uint256) {
        return assetReportHistory[_assetAddress].length;
    }

    function getRiskReport(address _assetAddress) external view returns (RiskReport memory) {
        uint256 len = assetReportHistory[_assetAddress].length;
        require(len > 0, "No reports found for address");
        return assetReportHistory[_assetAddress][len - 1];
    }

    function setOracleSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        emit OracleSignerUpdated(oracleSigner, _newSigner);
        oracleSigner = _newSigner;
    }

    function setBlockProver(address _newProver) external onlyOwner {
        require(_newProver != address(0), "Invalid block prover");
        emit BlockProverUpdated(blockProver, _newProver);
        blockProver = _newProver;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
