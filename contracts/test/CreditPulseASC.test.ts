import { expect } from "chai";
import { ethers } from "hardhat";
import { CreditPulseASC, MockBlockProver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CreditPulseASC v7.3.0 Enterprise", function () {
  let contract: CreditPulseASC;
  let mockProver: MockBlockProver;
  let owner: SignerWithAddress;
  let oracle1: SignerWithAddress;
  let oracle2: SignerWithAddress;
  let oracle3: SignerWithAddress;
  let user: SignerWithAddress;
  let attacker: SignerWithAddress;
  let challenger: SignerWithAddress;
  let assetAddr: string;

  const SAMPLE_SCORES = {
    overall: 88,
    liquidity: 100,
    collateral: 85,
    audit: 100,
    security: 70,
    volatility: 97,
    governance: 75,
  };

  const SAMPLE_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-data-hash"));
  const SAMPLE_AI_DIGEST = ethers.keccak256(ethers.toUtf8Bytes("ai-qualitative-digest"));

  beforeEach(async function () {
    [owner, oracle1, oracle2, oracle3, user, attacker, challenger] = await ethers.getSigners();
    assetAddr = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

    // Deploy MockBlockProver
    const ProverFactory = await ethers.getContractFactory("MockBlockProver");
    mockProver = await ProverFactory.deploy();
    await mockProver.waitForDeployment();

    // Deploy CreditPulseASC
    const Factory = await ethers.getContractFactory("CreditPulseASC");
    contract = await Factory.deploy(await mockProver.getAddress(), oracle1.address);
    await contract.waitForDeployment();

    // Authorize additional oracles for DON tests
    await contract.setOracleAuthorization(oracle1.address, true);
    await contract.setOracleAuthorization(oracle2.address, true);
    await contract.setOracleAuthorization(oracle3.address, true);
    await contract.setOracleAuthorization(user.address, true);
  });

  // ==========================================
  // DEPLOYMENT & VERSION
  // ==========================================
  describe("Deployment & Configuration", function () {
    it("should set the deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should have version 7.3.0", async function () {
      expect(await contract.VERSION()).to.equal("7.3.0");
    });

    it("should start with 0 reports", async function () {
      expect(await contract.reportCount()).to.equal(0);
      expect(await contract.verifiedProofCount()).to.equal(0);
    });

    it("should allow owner to update blockProver and emit event", async function () {
      const newProver = attacker.address;
      await expect(contract.setBlockProver(newProver))
        .to.emit(contract, "BlockProverUpdated")
        .withArgs(await mockProver.getAddress(), newProver);
      expect(await contract.blockProver()).to.equal(newProver);
    });

    it("should revert when updating blockProver to zero address", async function () {
      await expect(contract.setBlockProver(ethers.ZeroAddress)).to.be.revertedWith("Invalid block prover");
    });
  });

  // ==========================================
  // ORACLE STAKING & ECONOMIC SLASHING
  // ==========================================
  describe("Oracle Staking & Economic Slashing", function () {
    it("should allow an oracle to deposit stake", async function () {
      const stakeAmount = ethers.parseEther("0.5");
      await expect(contract.connect(user).stakeOracle({ value: stakeAmount }))
        .to.emit(contract, "OracleStaked")
        .withArgs(user.address, stakeAmount, stakeAmount);

      expect(await contract.oracleStake(user.address)).to.equal(stakeAmount);
      expect(await contract.totalOracleStake()).to.equal(stakeAmount);
      expect(await contract.isAuthorizedOracle(user.address)).to.equal(true);
    });

    it("should allow an oracle to unstake partial or full balance", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await contract.connect(user).stakeOracle({ value: stakeAmount });

      const unstakeAmount = ethers.parseEther("0.4");
      await expect(contract.connect(user).unstakeOracle(unstakeAmount))
        .to.emit(contract, "OracleUnstaked")
        .withArgs(user.address, unstakeAmount, ethers.parseEther("0.6"));

      expect(await contract.oracleStake(user.address)).to.equal(ethers.parseEther("0.6"));
      expect(await contract.totalOracleStake()).to.equal(ethers.parseEther("0.6"));
    });

    it("should revert if unstaking more than deposited stake", async function () {
      const stakeAmount = ethers.parseEther("0.2");
      await contract.connect(user).stakeOracle({ value: stakeAmount });

      await expect(contract.connect(user).unstakeOracle(ethers.parseEther("0.5"))).to.be.revertedWith("Insufficient stake");
    });

    it("should allow owner to slash malicious oracle and compensate recipient", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await contract.connect(user).stakeOracle({ value: stakeAmount });

      const slashAmount = ethers.parseEther("0.5");
      const initialBal = await ethers.provider.getBalance(attacker.address);

      await expect(contract.slashOracle(user.address, attacker.address, slashAmount, "Fraudulent score detected"))
        .to.emit(contract, "OracleSlashed")
        .withArgs(user.address, attacker.address, slashAmount, "Fraudulent score detected");

      expect(await contract.oracleStake(user.address)).to.equal(ethers.parseEther("0.5"));
      expect(await ethers.provider.getBalance(attacker.address)).to.equal(initialBal + slashAmount);
    });

    it("should revert if non-owner attempts to slash oracle", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      await contract.connect(user).stakeOracle({ value: stakeAmount });

      await expect(
        contract.connect(attacker).slashOracle(user.address, attacker.address, ethers.parseEther("0.5"), "Attack")
      ).to.be.revertedWith("Not authorized");
    });
  });

  // ==========================================
  // OPTIMISTIC DISPUTE WINDOW & CHALLENGES
  // ==========================================
  describe("Optimistic Dispute Window", function () {
    beforeEach(async function () {
      // Record a sample report
      await contract.saveRiskReport(
        assetAddr,
        SAMPLE_SCORES.overall,
        SAMPLE_SCORES.liquidity,
        SAMPLE_SCORES.collateral,
        SAMPLE_SCORES.audit,
        SAMPLE_SCORES.security,
        SAMPLE_SCORES.volatility,
        SAMPLE_SCORES.governance,
        SAMPLE_DATA_HASH
      );
    });

    it("should allow a bonded challenger to dispute a report within the window", async function () {
      const bond = ethers.parseEther("0.05");
      const evidence = "https://ipfs.io/ipfs/QmEvidenceFraudulentBalance";

      await expect(
        contract.connect(challenger).challengeReport(assetAddr, 0, evidence, { value: bond })
      )
        .to.emit(contract, "ReportChallenged")
        .withArgs(assetAddr, 0, challenger.address, bond, evidence);

      const dispute = await contract.reportDisputes(assetAddr, 0);
      expect(dispute.challenger).to.equal(challenger.address);
      expect(dispute.bondAmount).to.equal(bond);
      expect(dispute.active).to.equal(true);
      expect(dispute.resolved).to.equal(false);
    });

    it("should revert if challenger provides insufficient bond", async function () {
      const lowBond = ethers.parseEther("0.01");
      await expect(
        contract.connect(challenger).challengeReport(assetAddr, 0, "evidence", { value: lowBond })
      ).to.be.revertedWith("Insufficient challenger bond");
    });

    it("should resolve dispute in favor of challenger, paying bounty and insurance", async function () {
      const bond = ethers.parseEther("0.05");
      await contract.connect(challenger).challengeReport(assetAddr, 0, "evidence", { value: bond });

      // Oracle stakes collateral
      await contract.connect(oracle1).stakeOracle({ value: ethers.parseEther("0.1") });

      const challengerPreBal = await ethers.provider.getBalance(challenger.address);

      await expect(contract.resolveDispute(assetAddr, 0, true, oracle1.address))
        .to.emit(contract, "DisputeResolved");

      const dispute = await contract.reportDisputes(assetAddr, 0);
      expect(dispute.resolved).to.equal(true);
      expect(dispute.challengerWon).to.equal(true);

      // Challenger received bond + 50% of slashed stake
      const challengerPostBal = await ethers.provider.getBalance(challenger.address);
      expect(challengerPostBal).to.be.greaterThan(challengerPreBal);
      expect(await contract.totalInsurancePool()).to.be.greaterThan(0);
    });

    it("should resolve dispute against challenger, adding bond to insurance pool", async function () {
      const bond = ethers.parseEther("0.05");
      await contract.connect(challenger).challengeReport(assetAddr, 0, "evidence", { value: bond });

      await expect(contract.resolveDispute(assetAddr, 0, false, ethers.ZeroAddress))
        .to.emit(contract, "DisputeResolved")
        .withArgs(assetAddr, 0, challenger.address, false, 0, bond);

      expect(await contract.totalInsurancePool()).to.equal(bond);
    });

    it("should report non-finalized during dispute window and finalized after window", async function () {
      expect(await contract.isReportFinalized(assetAddr, 0)).to.equal(false);

      // Advance time past 3 days (3 * 24 * 3600 + 10)
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      expect(await contract.isReportFinalized(assetAddr, 0)).to.equal(true);
    });
  });

  // ==========================================
  // CRYPTOGRAPHIC PROOF-OF-RESERVE LEDGER (ABI name: saveRWAZkTLSCertificate)
  // ==========================================
  describe("Cryptographic Proof-of-Reserve (PoR) Ledger", function () {
    it("should allow an authorized oracle to save PoR certificate", async function () {
      const zkTlsProofHash = ethers.keccak256(ethers.toUtf8Bytes("zktls-proof-payload"));
      const custodianKeyHash = ethers.keccak256(ethers.toUtf8Bytes("ankura-trust-rsa-pubkey"));
      const sessionCommitment = ethers.keccak256(ethers.toUtf8Bytes("tls-session-hmac-sha256"));

      await expect(
        contract.saveRWAZkTLSCertificate(
          assetAddr,
          95,
          10450, // 104.50%
          zkTlsProofHash,
          custodianKeyHash,
          sessionCommitment
        )
      ).to.emit(contract, "ZkTLSCertificateSaved");

      const history = await contract.getZkTLSCertificateHistory(assetAddr);
      expect(history.length).to.equal(1);
      expect(history[0].reserveRatioBps).to.equal(10450);
      expect(history[0].zkTlsProofHash).to.equal(zkTlsProofHash);
      expect(history[0].custodianKeyHash).to.equal(custodianKeyHash);
      expect(history[0].sessionCommitment).to.equal(sessionCommitment);
    });
  });

  // ==========================================
  // MULTI-ORACLE DON QUORUM
  // ==========================================
  describe("Multi-Oracle Threshold Quorum (DON)", function () {
    it("should accept report signed by 2-of-3 oracle quorum", async function () {
      const msgHash = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
          [
            assetAddr,
            SAMPLE_SCORES.overall,
            SAMPLE_SCORES.liquidity,
            SAMPLE_SCORES.collateral,
            SAMPLE_SCORES.audit,
            SAMPLE_SCORES.security,
            SAMPLE_SCORES.volatility,
            SAMPLE_SCORES.governance,
            SAMPLE_DATA_HASH
          ]
        )
      );

      const sig1 = await oracle1.signMessage(ethers.getBytes(msgHash));
      const sig2 = await oracle2.signMessage(ethers.getBytes(msgHash));

      // Sort signers in ascending order to satisfy contract sorting requirement
      const signersList = [
        { addr: oracle1.address, sig: sig1 },
        { addr: oracle2.address, sig: sig2 }
      ].sort((a, b) => (a.addr.toLowerCase() < b.addr.toLowerCase() ? -1 : 1));

      const sortedSigners = signersList.map(s => s.addr);
      const sortedSignatures = signersList.map(s => s.sig);

      const scoresArray = [
        SAMPLE_SCORES.overall,
        SAMPLE_SCORES.liquidity,
        SAMPLE_SCORES.collateral,
        SAMPLE_SCORES.audit,
        SAMPLE_SCORES.security,
        SAMPLE_SCORES.volatility,
        SAMPLE_SCORES.governance
      ];

      await expect(
        contract.saveRiskReportMultiSigned(
          assetAddr,
          scoresArray,
          SAMPLE_DATA_HASH,
          SAMPLE_AI_DIGEST,
          sortedSigners,
          sortedSignatures
        )
      ).to.emit(contract, "MultiSignedReportSaved");

      expect(await contract.reportCount()).to.equal(1);
    });
  });

  // ==========================================
  // SINGLE ORACLE SIGNED REPORT
  // ==========================================
  describe("saveRiskReportSigned", function () {
    it("should verify valid signature from oracleSigner", async function () {
      const msgHash = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
          [
            assetAddr,
            SAMPLE_SCORES.overall,
            SAMPLE_SCORES.liquidity,
            SAMPLE_SCORES.collateral,
            SAMPLE_SCORES.audit,
            SAMPLE_SCORES.security,
            SAMPLE_SCORES.volatility,
            SAMPLE_SCORES.governance,
            SAMPLE_DATA_HASH
          ]
        )
      );

      const sig = await oracle1.signMessage(ethers.getBytes(msgHash));

      await expect(
        contract.connect(user).saveRiskReportSigned(
          assetAddr,
          SAMPLE_SCORES.overall,
          SAMPLE_SCORES.liquidity,
          SAMPLE_SCORES.collateral,
          SAMPLE_SCORES.audit,
          SAMPLE_SCORES.security,
          SAMPLE_SCORES.volatility,
          SAMPLE_SCORES.governance,
          SAMPLE_DATA_HASH,
          sig
        )
      ).to.emit(contract, "ReportSaved");

      expect(await contract.reportCount()).to.equal(1);
    });

    it("should revert if signature is from unauthorized signer", async function () {
      const msgHash = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
          [
            assetAddr,
            SAMPLE_SCORES.overall,
            SAMPLE_SCORES.liquidity,
            SAMPLE_SCORES.collateral,
            SAMPLE_SCORES.audit,
            SAMPLE_SCORES.security,
            SAMPLE_SCORES.volatility,
            SAMPLE_SCORES.governance,
            SAMPLE_DATA_HASH
          ]
        )
      );

      const sig = await attacker.signMessage(ethers.getBytes(msgHash));

      await expect(
        contract.connect(user).saveRiskReportSigned(
          assetAddr,
          SAMPLE_SCORES.overall,
          SAMPLE_SCORES.liquidity,
          SAMPLE_SCORES.collateral,
          SAMPLE_SCORES.audit,
          SAMPLE_SCORES.security,
          SAMPLE_SCORES.volatility,
          SAMPLE_SCORES.governance,
          SAMPLE_DATA_HASH,
          sig
        )
      ).to.be.revertedWith("Unauthorized oracle signature");
    });
  });

  // ==========================================
  // PRECOMPILE VERIFIED RISK REPORT
  // ==========================================
  describe("saveVerifiedRiskReport & Proof Binding", function () {
    it("should accept verified risk report and cryptographically bind payload", async function () {
      const dummyContinuity = {
        lowerEndpointDigest: ethers.ZeroHash,
        roots: []
      };

      const scoresArray = [
        SAMPLE_SCORES.overall,
        SAMPLE_SCORES.liquidity,
        SAMPLE_SCORES.collateral,
        SAMPLE_SCORES.audit,
        SAMPLE_SCORES.security,
        SAMPLE_SCORES.volatility,
        SAMPLE_SCORES.governance
      ];

      await expect(
        contract.saveVerifiedRiskReport(
          assetAddr,
          scoresArray,
          SAMPLE_DATA_HASH,
          SAMPLE_AI_DIGEST,
          1,
          [100, 101],
          [ethers.toUtf8Bytes("tx1")],
          [],
          dummyContinuity
        )
      ).to.emit(contract, "VerifiedReportSaved");

      expect(await contract.verifiedProofCount()).to.equal(1);
    });

    it("should revert on duplicate proof reuse (replay attack protection)", async function () {
      const dummyContinuity = {
        lowerEndpointDigest: ethers.ZeroHash,
        roots: []
      };

      const scoresArray = [
        SAMPLE_SCORES.overall,
        SAMPLE_SCORES.liquidity,
        SAMPLE_SCORES.collateral,
        SAMPLE_SCORES.audit,
        SAMPLE_SCORES.security,
        SAMPLE_SCORES.volatility,
        SAMPLE_SCORES.governance
      ];

      await contract.saveVerifiedRiskReport(
        assetAddr,
        scoresArray,
        SAMPLE_DATA_HASH,
        SAMPLE_AI_DIGEST,
        1,
        [100, 101],
        [ethers.toUtf8Bytes("tx1")],
        [],
        dummyContinuity
      );

      // Re-using the same mock proof should revert because queryId is already registered
      await expect(
        contract.saveVerifiedRiskReport(
          assetAddr,
          scoresArray,
          SAMPLE_DATA_HASH,
          SAMPLE_AI_DIGEST,
          1,
          [100, 101],
          [ethers.toUtf8Bytes("tx1")],
          [],
          dummyContinuity
        )
      ).to.be.revertedWith("Proof queryId already used");
    });
  });

  // ==========================================
  // INPUT VALIDATION & INTEGRITY
  // ==========================================
  describe("Input Validation & Integrity", function () {
    it("should revert on zero address", async function () {
      await expect(
        contract.saveRiskReport(
          ethers.ZeroAddress,
          SAMPLE_SCORES.overall,
          SAMPLE_SCORES.liquidity,
          SAMPLE_SCORES.collateral,
          SAMPLE_SCORES.audit,
          SAMPLE_SCORES.security,
          SAMPLE_SCORES.volatility,
          SAMPLE_SCORES.governance,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Invalid asset address");
    });

    it("should revert if score > 100", async function () {
      await expect(
        contract.saveRiskReport(
          assetAddr,
          101,
          SAMPLE_SCORES.liquidity,
          SAMPLE_SCORES.collateral,
          SAMPLE_SCORES.audit,
          SAMPLE_SCORES.security,
          SAMPLE_SCORES.volatility,
          SAMPLE_SCORES.governance,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Score exceeds maximum");
    });

    it("should correctly verify data integrity via verifyDataIntegrity", async function () {
      await contract.saveRiskReport(
        assetAddr,
        SAMPLE_SCORES.overall,
        SAMPLE_SCORES.liquidity,
        SAMPLE_SCORES.collateral,
        SAMPLE_SCORES.audit,
        SAMPLE_SCORES.security,
        SAMPLE_SCORES.volatility,
        SAMPLE_SCORES.governance,
        SAMPLE_DATA_HASH
      );

      expect(await contract.verifyDataIntegrity(assetAddr, SAMPLE_DATA_HASH)).to.equal(true);
      expect(await contract.verifyDataIntegrity(assetAddr, ethers.ZeroHash)).to.equal(false);
    });
  });
});
