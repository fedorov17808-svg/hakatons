import { expect } from "chai";
import { ethers } from "hardhat";

describe("CreditPulseInsurancePool — First-Loss Underwriting Tranches", function () {
  let insurancePool: any;
  let owner: any;
  let juniorLP: any;
  let seniorLP: any;
  let damagedProtocol: any;
  let resolver: any;

  beforeEach(async function () {
    [owner, juniorLP, seniorLP, damagedProtocol, resolver] = await ethers.getSigners();

    const InsuranceFactory = await ethers.getContractFactory("CreditPulseInsurancePool");
    insurancePool = await InsuranceFactory.deploy();
    await insurancePool.waitForDeployment();

    await insurancePool.initialize(owner.address, resolver.address);
  });

  it("should initialize with correct tranche settings", async function () {
    const junior = await insurancePool.juniorTranche();
    const senior = await insurancePool.seniorTranche();

    expect(junior.lossAbsorptionPct).to.equal(80);
    expect(junior.apyBps).to.equal(1200); // 12% APY

    expect(senior.lossAbsorptionPct).to.equal(20);
    expect(senior.apyBps).to.equal(450);  // 4.5% APY
  });

  it("should accept deposits into Junior and Senior tranches", async function () {
    const juniorDeposit = ethers.parseEther("10");
    const seniorDeposit = ethers.parseEther("40");

    await insurancePool.connect(juniorLP).depositToTranche(1, { value: juniorDeposit });
    await insurancePool.connect(seniorLP).depositToTranche(2, { value: seniorDeposit });

    expect(await insurancePool.totalUnderwritingCapacity()).to.equal(ethers.parseEther("50"));
    expect(await insurancePool.juniorDeposits(juniorLP.address)).to.equal(juniorDeposit);
    expect(await insurancePool.seniorDeposits(seniorLP.address)).to.equal(seniorDeposit);
  });

  it("should execute first-loss deficit payout allocating 80% to Junior tranche", async function () {
    await insurancePool.connect(juniorLP).depositToTranche(1, { value: ethers.parseEther("10") });
    await insurancePool.connect(seniorLP).depositToTranche(2, { value: ethers.parseEther("40") });

    const deficit = ethers.parseEther("5"); // 5 ETH loss
    const balanceBefore = await ethers.provider.getBalance(damagedProtocol.address);

    const tx = await insurancePool.connect(resolver).executeDeficitPayout(
      damagedProtocol.address,
      deficit,
      "INCIDENT-EULER-RECOVERY-01"
    );
    await tx.wait();

    const balanceAfter = await ethers.provider.getBalance(damagedProtocol.address);
    expect(balanceAfter - balanceBefore).to.equal(deficit);

    const junior = await insurancePool.juniorTranche();
    const senior = await insurancePool.seniorTranche();

    expect(junior.totalClaimed).to.equal(ethers.parseEther("4")); // 80% of 5 ETH = 4 ETH
    expect(senior.totalClaimed).to.equal(ethers.parseEther("1")); // 20% of 5 ETH = 1 ETH
  });

  it("should reject deficit payout from unauthorized non-resolver address", async function () {
    await expect(
      insurancePool.connect(juniorLP).executeDeficitPayout(
        damagedProtocol.address,
        ethers.parseEther("1"),
        "UNAUTHORIZED"
      )
    ).to.be.revertedWithCustomError(insurancePool, "UnauthorizedResolver");
  });

  it("should allow withdrawal from Junior tranche after 24h cooldown", async function () {
    const deposit = ethers.parseEther("10");
    await insurancePool.connect(juniorLP).depositToTranche(1, { value: deposit });

    // Fast-forward 25 hours
    await ethers.provider.send("evm_increaseTime", [25 * 3600]);
    await ethers.provider.send("evm_mine", []);

    const balanceBefore = await ethers.provider.getBalance(juniorLP.address);
    const tx = await insurancePool.connect(juniorLP).withdrawFromTranche(1, ethers.parseEther("5"));
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(juniorLP.address);

    expect(balanceAfter - balanceBefore + gasUsed).to.equal(ethers.parseEther("5"));
    expect(await insurancePool.juniorDeposits(juniorLP.address)).to.equal(ethers.parseEther("5"));
  });

  it("should reject withdrawal before 24h cooldown expires", async function () {
    await insurancePool.connect(seniorLP).depositToTranche(2, { value: ethers.parseEther("10") });

    // Try to withdraw immediately (no time skip)
    await expect(
      insurancePool.connect(seniorLP).withdrawFromTranche(2, ethers.parseEther("5"))
    ).to.be.revertedWithCustomError(insurancePool, "WithdrawalCooldownActive");
  });

  it("should reject withdrawal exceeding deposited amount", async function () {
    await insurancePool.connect(juniorLP).depositToTranche(1, { value: ethers.parseEther("5") });

    await ethers.provider.send("evm_increaseTime", [25 * 3600]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      insurancePool.connect(juniorLP).withdrawFromTranche(1, ethers.parseEther("10"))
    ).to.be.revertedWithCustomError(insurancePool, "InsufficientDeposit");
  });

  it("should return correct provider balances via getProviderBalance", async function () {
    await insurancePool.connect(juniorLP).depositToTranche(1, { value: ethers.parseEther("7") });
    await insurancePool.connect(juniorLP).depositToTranche(2, { value: ethers.parseEther("3") });

    const [junior, senior] = await insurancePool.getProviderBalance(juniorLP.address);
    expect(junior).to.equal(ethers.parseEther("7"));
    expect(senior).to.equal(ethers.parseEther("3"));
  });
});
