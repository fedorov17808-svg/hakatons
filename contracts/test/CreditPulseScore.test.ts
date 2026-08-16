import { expect } from "chai";
import { ethers } from "hardhat";

describe("CreditPulseScore", function () {
  let creditPulseScore: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const CreditPulseScoreFactory = await ethers.getContractFactory("CreditPulseScore");
    creditPulseScore = await CreditPulseScoreFactory.deploy();
  });

  it("Deployment sets correct owner", async function () {
    expect(await creditPulseScore.owner()).to.equal(owner.address);
  });

  it("VERSION returns '1.0.0'", async function () {
    expect(await creditPulseScore.VERSION()).to.equal("1.0.0");
  });

  describe("saveRiskReport", function () {
    it("saveRiskReport by owner succeeds", async function () {
      await expect(creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 60))
        .to.not.be.reverted;
    });

    it("saveRiskReport by non-owner reverts", async function () {
      await expect(
        creditPulseScore.connect(addr1).saveRiskReport("asset1", 90, 80, 70, 60)
      ).to.be.revertedWith("Not authorized");
    });

    it("saveRiskReport with score > 100 reverts", async function () {
      await expect(
        creditPulseScore.saveRiskReport("asset1", 101, 80, 70, 60)
      ).to.be.revertedWith("Score exceeds maximum");
      
      await expect(
        creditPulseScore.saveRiskReport("asset1", 90, 101, 70, 60)
      ).to.be.revertedWith("Liquidity exceeds maximum");

      await expect(
        creditPulseScore.saveRiskReport("asset1", 90, 80, 101, 60)
      ).to.be.revertedWith("Collateral exceeds maximum");

      await expect(
        creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 101)
      ).to.be.revertedWith("Audit score exceeds maximum");
    });

    it("saveRiskReport with empty address reverts", async function () {
      await expect(
        creditPulseScore.saveRiskReport("", 90, 80, 70, 60)
      ).to.be.revertedWith("Empty asset address");
    });

    it("ReportSaved event emitted with correct args", async function () {
      const tx = await creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 60);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(creditPulseScore, "ReportSaved")
        .withArgs("asset1", 90, 80, 70, 60, owner.address, block?.timestamp);
    });

    it("reportCount increments", async function () {
      expect(await creditPulseScore.getReportCount()).to.equal(0n);
      await creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 60);
      expect(await creditPulseScore.getReportCount()).to.equal(1n);
    });

    it("assetReportCount increments per asset", async function () {
      expect(await creditPulseScore.assetReportCount("asset1")).to.equal(0n);
      await creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 60);
      expect(await creditPulseScore.assetReportCount("asset1")).to.equal(1n);
      await creditPulseScore.saveRiskReport("asset1", 85, 75, 65, 55);
      expect(await creditPulseScore.assetReportCount("asset1")).to.equal(2n);
    });
  });

  describe("getReport", function () {
    it("getReport returns correct data", async function () {
      await creditPulseScore.saveRiskReport("asset1", 90, 80, 70, 60);
      const report = await creditPulseScore.getReport("asset1");
      expect(report.assetAddress).to.equal("asset1");
      expect(report.overallScore).to.equal(90n);
      expect(report.liquidity).to.equal(80n);
      expect(report.collateral).to.equal(70n);
      expect(report.auditScore).to.equal(60n);
      expect(report.verifiedBy).to.equal(owner.address);
      expect(report.timestamp).to.be.gt(0n);
    });
  });

  describe("transferOwnership", function () {
    it("transferOwnership works", async function () {
      await creditPulseScore.transferOwnership(addr1.address);
      expect(await creditPulseScore.owner()).to.equal(addr1.address);
    });

    it("transferOwnership to zero address reverts", async function () {
      await expect(
        creditPulseScore.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });
    
    it("transferOwnership by non-owner reverts", async function () {
      await expect(
        creditPulseScore.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWith("Not authorized");
    });
  });
});
