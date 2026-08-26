import { expect } from "chai";
import { ethers } from "hardhat";
import { CreditPulseASC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CreditPulseASC — Formal Security & Anti-Malleability Properties", function () {
  let contract: CreditPulseASC;
  let owner: SignerWithAddress;
  let oracleNode1: SignerWithAddress;
  let oracleNode2: SignerWithAddress;
  let oracleNode3: SignerWithAddress;
  let attacker: SignerWithAddress;
  let challenger: SignerWithAddress;

  const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const SECP256K1_HALF_N = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");

  beforeEach(async function () {
    [owner, oracleNode1, oracleNode2, oracleNode3, attacker, challenger] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("CreditPulseASC");
    const blockProver = "0x0000000000000000000000000000000000000FD2";
    contract = (await factory.deploy(blockProver, owner.address)) as unknown as CreditPulseASC;
    await contract.waitForDeployment();

    // Authorize 3 DON oracle nodes and deposit stake
    await contract.setOracleAuthorization(oracleNode1.address, true);
    await contract.setOracleAuthorization(oracleNode2.address, true);
    await contract.setOracleAuthorization(oracleNode3.address, true);

    await contract.connect(oracleNode1).stakeOracle({ value: ethers.parseEther("1.0") });
    await contract.connect(oracleNode2).stakeOracle({ value: ethers.parseEther("1.0") });
    await contract.connect(oracleNode3).stakeOracle({ value: ethers.parseEther("1.0") });
  });

  describe("1. OpenZeppelin ECDSA Signature Malleability (EIP-2) Invariants", function () {
    it("should strictly reject high-s malleable signatures (s > secp256k1_n / 2)", async function () {
      const assetAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
      const scores = [88, 90, 85, 95, 88, 82, 85];
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("canonical_data_payload_v7.2"));
      const aiDigest = ethers.ZeroHash;

      // Pack message hash exactly as contract expects
      const packed = ethers.solidityPacked(
        ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
        [assetAddress, ...scores, dataHash]
      );
      const msgHash = ethers.keccak256(packed);

      // Sign with owner
      const validSig = await owner.signMessage(ethers.getBytes(msgHash));
      const sigBytes = ethers.getBytes(validSig);

      const r = ethers.hexlify(sigBytes.slice(0, 32));
      const sBig = BigInt(ethers.hexlify(sigBytes.slice(32, 64)));
      const v = sigBytes[64];

      // Construct a malleable high-s signature: s' = N - s
      const malleableS = SECP256K1_N - sBig;
      expect(malleableS).to.be.greaterThan(SECP256K1_HALF_N);

      const malleableSBytes = ethers.toBeArray(malleableS);
      const malleableV = v === 27 ? 28 : 27;

      const malleableSig = ethers.concat([
        ethers.getBytes(r),
        malleableSBytes,
        new Uint8Array([malleableV])
      ]);

      // Submitting malleable signature must be strictly reverted by _recoverSigner
      await expect(
        contract.saveRiskReportSigned(
          assetAddress,
          scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6],
          dataHash,
          malleableSig
        )
      ).to.be.revertedWith("Invalid signature 's' value");
    });
  });

  describe("2. Economic Slashing & Balance Invariants", function () {
    it("should preserve stake conservation invariant during slashing", async function () {
      const initialStake = await contract.totalOracleStake();
      expect(initialStake).to.equal(ethers.parseEther("3.0"));

      // Slash oracleNode1 for 0.5 ETH
      const slashAmount = ethers.parseEther("0.5");
      const initialChallengerBal = await ethers.provider.getBalance(challenger.address);

      await contract.connect(owner).slashOracle(oracleNode1.address, challenger.address, slashAmount, "Fraudulent score detected");

      const postStake = await contract.totalOracleStake();
      const oracle1Balance = await contract.oracleStake(oracleNode1.address);
      const postChallengerBal = await ethers.provider.getBalance(challenger.address);

      // Invariant: Total Stake decreased exactly by slash amount
      expect(initialStake - postStake).to.equal(slashAmount);
      expect(oracle1Balance).to.equal(ethers.parseEther("0.5"));
      expect(postChallengerBal - initialChallengerBal).to.equal(slashAmount);
    });

    it("should revert if attempting to slash more than available balance", async function () {
      await expect(
        contract.connect(owner).slashOracle(oracleNode1.address, challenger.address, ethers.parseEther("2.0"), "Exceeds")
      ).to.be.revertedWith("Amount exceeds oracle stake");
    });
  });

  describe("3. Optimistic Dispute Window Security", function () {
    it("should revert dispute challenge if bond is below MIN_CHALLENGE_BOND", async function () {
      // First save a report
      const assetAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
      const scores = [88, 90, 85, 95, 88, 82, 85];
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("canonical_test"));

      const packed = ethers.solidityPacked(
        ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
        [assetAddress, ...scores, dataHash]
      );
      const msgHash = ethers.keccak256(packed);
      const validSig = await owner.signMessage(ethers.getBytes(msgHash));

      await contract.saveRiskReportSigned(
        assetAddress,
        scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6],
        dataHash,
        validSig
      );

      // Challenger attempts with insufficient bond (0.01 ETH vs required 0.05 ETH)
      await expect(
        contract.connect(challenger).challengeReport(assetAddress, 0, "Fake TVL report", {
          value: ethers.parseEther("0.01")
        })
      ).to.be.revertedWith("Insufficient challenger bond");
    });
  });
});
