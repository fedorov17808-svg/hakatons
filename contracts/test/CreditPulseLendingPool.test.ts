import { expect } from "chai";
import { ethers } from "hardhat";

describe("CreditPulseLendingPool Integration", function () {
  let creditPulse: any;
  let lendingPool: any;
  let mockProver: any;
  let deployer: any;
  let borrower: any;
  let oracle1: any;

  const mockAssetAAA = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave
  const mockAssetLow = "0x000000000000000000000000000000000000dEaD"; // High Risk

  beforeEach(async function () {
    [deployer, borrower, oracle1] = await ethers.getSigners();

    // Deploy MockBlockProver
    const ProverFactory = await ethers.getContractFactory("MockBlockProver");
    mockProver = await ProverFactory.deploy();
    await mockProver.waitForDeployment();

    // Deploy CreditPulseASC
    const ASCFactory = await ethers.getContractFactory("CreditPulseASC");
    creditPulse = await ASCFactory.deploy(await mockProver.getAddress(), oracle1.address);
    await creditPulse.waitForDeployment();

    // Authorize Oracle
    await creditPulse.setOracleAuthorization(deployer.address, true);

    // Deploy CreditPulseLendingPool
    const LendingFactory = await ethers.getContractFactory("CreditPulseLendingPool");
    lendingPool = await LendingFactory.deploy(await creditPulse.getAddress());
    await lendingPool.waitForDeployment();

    // Save a AAA score (88/100) for mockAssetAAA
    const scoresAAA: [number, number, number, number, number, number, number] = [88, 90, 85, 95, 88, 82, 85];
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("AAA_REPORT"));
    const aiDigest = ethers.keccak256(ethers.toUtf8Bytes("AI_DIGEST_AAA"));

    await creditPulse.saveRiskReportSigned(
      mockAssetAAA,
      scoresAAA[0],
      scoresAAA[1],
      scoresAAA[2],
      scoresAAA[3],
      scoresAAA[4],
      scoresAAA[5],
      scoresAAA[6],
      dataHash,
      await generateSignature(deployer, mockAssetAAA, scoresAAA, dataHash)
    );

    // Save a sub-50 score (42/100) for mockAssetLow
    const scoresLow: [number, number, number, number, number, number, number] = [42, 30, 40, 20, 35, 50, 40];
    const dataHashLow = ethers.keccak256(ethers.toUtf8Bytes("LOW_REPORT"));
    await creditPulse.saveRiskReportSigned(
      mockAssetLow,
      scoresLow[0],
      scoresLow[1],
      scoresLow[2],
      scoresLow[3],
      scoresLow[4],
      scoresLow[5],
      scoresLow[6],
      dataHashLow,
      await generateSignature(deployer, mockAssetLow, scoresLow, dataHashLow)
    );
  });

  async function generateSignature(signer: any, asset: string, scores: number[], dataHash: string) {
    const packed = ethers.solidityPackedKeccak256(
      ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
      [asset, scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6], dataHash]
    );
    return signer.signMessage(ethers.getBytes(packed));
  }

  it("should calculate favorable loan terms (90% LTV, 4.5% APR) for AAA rated assets", async function () {
    const [ltvBps, interestRateBps, creditScore] = await lendingPool.calculateLoanTerms(mockAssetAAA);
    expect(creditScore).to.equal(88);
    expect(ltvBps).to.equal(9000); // 90%
    expect(interestRateBps).to.equal(450); // 4.5%
  });

  it("should revert loan origination for assets with sub-50 credit score", async function () {
    await expect(
      lendingPool.calculateLoanTerms(mockAssetLow)
    ).to.be.revertedWithCustomError(lendingPool, "InsufficientCreditRating");
  });

  it("should originate undercollateralized loan with risk-adjusted terms", async function () {
    const collateralAmount = ethers.parseEther("10"); // 10 ETH
    const tx = await lendingPool.connect(borrower).borrow(mockAssetAAA, collateralAmount);
    await tx.wait();

    const loan = await lendingPool.loans(1);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.borrowedAmount).to.equal(ethers.parseEther("9")); // 90% of 10 = 9 ETH
    expect(loan.interestRateBps).to.equal(450);
    expect(loan.creditScoreAtBorrow).to.equal(88);
  });

  it("should atomically update oracle rating and originate loan via borrowWithOracleProof", async function () {
    const newAsset = ethers.getAddress("0x51563f68cc66b7d2db894ca3c224213cb5fe0282");
    const newScores: [number, number, number, number, number, number, number] = [80, 85, 80, 80, 80, 75, 80];
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("PULL_DATA_HASH"));
    const aiDigest = ethers.keccak256(ethers.toUtf8Bytes("AI_DIGEST"));

    await creditPulse.setOracleAuthorization(oracle1.address, true);

    const sig1 = await generateSignature(deployer, newAsset, newScores, dataHash);
    const sig2 = await generateSignature(oracle1, newAsset, newScores, dataHash);

    // Sort signers and signatures in ascending address order as required by contract
    const signersList = [
      { addr: deployer.address, sig: sig1 },
      { addr: oracle1.address, sig: sig2 }
    ].sort((a, b) => (BigInt(a.addr) < BigInt(b.addr) ? -1 : 1));

    const collateral = ethers.parseEther("5");

    const tx = await lendingPool.connect(borrower).borrowWithOracleProof(
      newAsset,
      collateral,
      newScores,
      dataHash,
      aiDigest,
      signersList.map(s => s.addr),
      signersList.map(s => s.sig)
    );
    await tx.wait();

    const loan = await lendingPool.loans(1);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.creditScoreAtBorrow).to.equal(80);
    expect(loan.borrowedAmount).to.equal(ethers.parseEther("4")); // 80% of 5 = 4 ETH
  });
});
