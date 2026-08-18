import { expect } from "chai";
import { ethers } from "hardhat";
import { CreditPulseASC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CreditPulseASC", function () {
  let contract: CreditPulseASC;
  let owner: SignerWithAddress;
  let attacker: SignerWithAddress;
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

  const SAMPLE_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-data"));

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();
    assetAddr = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

    const Factory = await ethers.getContractFactory("CreditPulseASC");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ==========================================
  // DEPLOYMENT
  // ==========================================
  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should have version 3.2.0", async function () {
      expect(await contract.VERSION()).to.equal("3.2.0");
    });

    it("should start with 0 reports", async function () {
      expect(await contract.reportCount()).to.equal(0);
      expect(await contract.verifiedProofCount()).to.equal(0);
    });
  });

  // ==========================================
  // saveRiskReport
  // ==========================================
  describe("saveRiskReport", function () {
    it("should save a report and increment reportCount", async function () {
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

      expect(await contract.reportCount()).to.equal(1);
      expect(await contract.getAssetReportCount(assetAddr)).to.equal(1);
    });

    it("should emit ReportSaved event with correct parameters", async function () {
      await expect(
        contract.saveRiskReport(
          assetAddr,
          SAMPLE_SCORES.overall,
          SAMPLE_SCORES.liquidity,
          SAMPLE_SCORES.collateral,
          SAMPLE_SCORES.audit,
          SAMPLE_SCORES.security,
          SAMPLE_SCORES.volatility,
          SAMPLE_SCORES.governance,
          SAMPLE_DATA_HASH
        )
      ).to.emit(contract, "ReportSaved");
    });

    it("should store correct dataHash for verifiable provenance", async function () {
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

      const report = await contract.getRiskReport(assetAddr);
      expect(report.dataHash).to.equal(SAMPLE_DATA_HASH);
      expect(report.crossChainVerified).to.equal(false);
    });
  });

  // ==========================================
  // INPUT VALIDATION (ALL 7 FIELDS)
  // ==========================================
  describe("Input Validation", function () {
    it("should revert on zero address", async function () {
      await expect(
        contract.saveRiskReport(
          ethers.ZeroAddress,
          88, 100, 85, 100, 70, 97, 75,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Invalid asset address");
    });

    it("should revert if overallScore > 100", async function () {
      await expect(
        contract.saveRiskReport(
          assetAddr,
          101, 100, 85, 100, 70, 97, 75,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Overall score exceeds 100");
    });

    it("should revert if liquidity > 100", async function () {
      await expect(
        contract.saveRiskReport(
          assetAddr,
          88, 101, 85, 100, 70, 97, 75,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Liquidity score exceeds 100");
    });

    it("should revert if security > 100", async function () {
      await expect(
        contract.saveRiskReport(
          assetAddr,
          88, 100, 85, 100, 101, 97, 75,
          SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Security score exceeds 100");
    });

    it("should accept edge case: all scores = 0", async function () {
      await contract.saveRiskReport(
        assetAddr, 0, 0, 0, 0, 0, 0, 0, SAMPLE_DATA_HASH
      );
      const report = await contract.getRiskReport(assetAddr);
      expect(report.overallScore).to.equal(0);
    });

    it("should accept edge case: all scores = 100", async function () {
      await contract.saveRiskReport(
        assetAddr, 100, 100, 100, 100, 100, 100, 100, SAMPLE_DATA_HASH
      );
      const report = await contract.getRiskReport(assetAddr);
      expect(report.overallScore).to.equal(100);
    });
  });

  // ==========================================
  // ACCESS CONTROL
  // ==========================================
  describe("Access Control", function () {
    it("should revert if non-owner calls saveRiskReport", async function () {
      await expect(
        contract.connect(attacker).saveRiskReport(
          assetAddr, 88, 100, 85, 100, 70, 97, 75, SAMPLE_DATA_HASH
        )
      ).to.be.revertedWith("Not authorized");
    });

    it("should allow ownership transfer", async function () {
      await contract.transferOwnership(attacker.address);
      expect(await contract.owner()).to.equal(attacker.address);

      await contract.connect(attacker).saveRiskReport(
        assetAddr, 88, 100, 85, 100, 70, 97, 75, SAMPLE_DATA_HASH
      );
      expect(await contract.reportCount()).to.equal(1);
    });

    it("should revert if transferOwnership to zero address", async function () {
      await expect(
        contract.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });
  });

  // ==========================================
  // APPEND-ONLY HISTORY
  // ==========================================
  describe("Append-Only History", function () {
    it("should store multiple reports for same asset", async function () {
      await contract.saveRiskReport(
        assetAddr, 80, 90, 70, 85, 60, 95, 65, SAMPLE_DATA_HASH
      );
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("updated-data"));
      await contract.saveRiskReport(
        assetAddr, 92, 100, 88, 95, 80, 98, 85, hash2
      );

      expect(await contract.getAssetReportCount(assetAddr)).to.equal(2);
      
      const history = await contract.getReportHistory(assetAddr);
      expect(history[0].overallScore).to.equal(80);
      expect(history[1].overallScore).to.equal(92);
      expect(history[0].dataHash).to.equal(SAMPLE_DATA_HASH);
      expect(history[1].dataHash).to.equal(hash2);
    });
  });

  // ==========================================
  // DATA INTEGRITY VERIFICATION
  // ==========================================
  describe("verifyDataIntegrity", function () {
    it("should return true for matching dataHash", async function () {
      await contract.saveRiskReport(
        assetAddr, 88, 100, 85, 100, 70, 97, 75, SAMPLE_DATA_HASH
      );
      const matches = await contract.verifyDataIntegrity(assetAddr, 0, SAMPLE_DATA_HASH);
      expect(matches).to.equal(true);
    });

    it("should return false for non-matching dataHash", async function () {
      await contract.saveRiskReport(
        assetAddr, 88, 100, 85, 100, 70, 97, 75, SAMPLE_DATA_HASH
      );
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
      const matches = await contract.verifyDataIntegrity(assetAddr, 0, wrongHash);
      expect(matches).to.equal(false);
    });

    it("should revert for invalid report index", async function () {
      await expect(
        contract.verifyDataIntegrity(assetAddr, 0, SAMPLE_DATA_HASH)
      ).to.be.revertedWith("Invalid report index");
    });
  });
});
