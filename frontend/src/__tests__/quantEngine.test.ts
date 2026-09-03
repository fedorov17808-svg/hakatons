import { describe, it, expect } from "vitest";
import {
  computeMertonDefault,
  simulateJumpDiffusionVaR,
  computeLindySeasoning,
  computeQuantitativeRiskAdjustment
} from "@/lib/quantEngine";
import {
  getDONValidatorNodes,
  generateDONQuorumSignatures,
  generateDONPackedQuorumSignatures
} from "@/lib/donSigners";
import { signPackedRiskReport, signEIP712RiskReport } from "@/lib/oracleSigner";
import { ethers } from "ethers";

describe("CreditPulse Quantitative Risk Engine", () => {
  describe("Merton (1974) Structural Default Model", () => {
    it("computes ultra-low default probability for highly solvent overcollateralized protocols", () => {
      // Asset = $10B, Debt = $1B, Vol = 20%
      const result = computeMertonDefault(10_000_000_000, 1_000_000_000, 0.20, 0.045, 1.0);
      expect(result.probDefault).toBeLessThan(0.01);
      expect(result.distanceToDefault).toBeGreaterThan(4.0);
    });

    it("computes high default probability for near-insolvent protocols", () => {
      // Asset = $1.05M, Debt = $1.0M, Vol = 65%
      const result = computeMertonDefault(1_050_000, 1_000_000, 0.65, 0.045, 1.0);
      expect(result.probDefault).toBeGreaterThan(0.20);
      expect(result.distanceToDefault).toBeLessThan(1.5);
    });

    it("handles zero or negative inputs with bounded safe fallback", () => {
      const resultZero = computeMertonDefault(0, 100);
      expect(resultZero.probDefault).toBe(0.999);
      expect(resultZero.distanceToDefault).toBe(-5.0);
    });
  });

  describe("Lindy Longevity & Seasoning Curve", () => {
    it("applies maximum penalty for day-1 unseasoned protocols", () => {
      const mult = computeLindySeasoning(1);
      expect(mult).toBeGreaterThanOrEqual(0.25);
      expect(mult).toBeLessThan(0.35);
    });

    it("reaches full 1.0 multiplier for seasoned protocols > 90 days", () => {
      expect(computeLindySeasoning(90)).toBe(1.0);
      expect(computeLindySeasoning(365)).toBe(1.0);
    });

    it("scales smoothly via square root curve", () => {
      const m22 = computeLindySeasoning(22.5); // sqrt(22.5/90) = sqrt(0.25) = 0.5
      expect(m22).toBeCloseTo(0.5, 2);
    });
  });

  describe("Jump-Diffusion Monte Carlo Simulation (VaR / CVaR)", () => {
    it("generates 10-day 99% VaR and strictly higher or equal Expected Shortfall (CVaR)", () => {
      const mc = simulateJumpDiffusionVaR(1_000_000, 0.40, 10, 1000);
      expect(mc.var99).toBeGreaterThan(0);
      expect(mc.var99).toBeLessThanOrEqual(100);
      expect(mc.cvar99).toBeGreaterThanOrEqual(mc.var99);
      expect(mc.cvar99).toBeLessThanOrEqual(100);
    });

    it("bounds drawdowns safely within institutional bounds", () => {
      const mc = simulateJumpDiffusionVaR(5_000_000, 0.25, 10, 1000);
      expect(mc.var99).toBeGreaterThanOrEqual(0);
      expect(mc.cvar99).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Quantitative Risk Score Modifier", () => {
    it("awards bonus points for superior solvency (>4 sigma distance to default)", () => {
      const adj = computeQuantitativeRiskAdjustment(0.001, 15.0, 4.5);
      expect(adj.netAdjustment).toBeGreaterThan(0);
      expect(adj.bonus).toBe(3);
    });

    it("penalizes high Merton default risk (>25%) and severe CVaR tail loss (>40%)", () => {
      const adj = computeQuantitativeRiskAdjustment(0.30, 45.0, 0.8);
      expect(adj.penalty).toBeGreaterThanOrEqual(24);
      expect(adj.netAdjustment).toBeLessThanOrEqual(-20);
    });
  });

  describe("Federated DON Cryptographic Signers", () => {
    it("derives 3 distinct valid Ethereum validator addresses", () => {
      const nodes = getDONValidatorNodes();
      expect(nodes.length).toBe(3);
      expect(ethers.isAddress(nodes[0].address)).toBe(true);
      expect(ethers.isAddress(nodes[1].address)).toBe(true);
      expect(ethers.isAddress(nodes[2].address)).toBe(true);
      expect(nodes[0].address).not.toBe(nodes[1].address);
    });

    it("generates authentic verifiable EIP-712 threshold signatures from validator keys", async () => {
      const payload = {
        assetAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        overallScore: 88,
        liquidity: 85,
        collateral: 90,
        auditScore: 88,
        security: 82,
        volatility: 80,
        governance: 85,
        dataHash: ethers.keccak256(ethers.toUtf8Bytes("TEST_DATA_HASH")),
        aiDigest: ethers.keccak256(ethers.toUtf8Bytes("TEST_AI_DIGEST"))
      };

      const quorum = await generateDONQuorumSignatures(payload, 2);
      expect(quorum.quorumReached).toBe(true);
      expect(quorum.signers.length).toBe(2);
      expect(quorum.signatures.length).toBe(2);
      expect(quorum.signatures[0].startsWith("0x")).toBe(true);
      expect(quorum.signatures[0].length).toBe(132); // 65 bytes in hex + 0x
    });

    it("generates sorted packed Ethereum Signed Message signatures matching CreditPulseASC.sol", async () => {
      const payload = {
        assetAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        overallScore: 88,
        liquidity: 85,
        collateral: 90,
        auditScore: 88,
        security: 82,
        volatility: 80,
        governance: 85,
        dataHash: ethers.keccak256(ethers.toUtf8Bytes("TEST_DATA_HASH")),
        aiDigest: ethers.keccak256(ethers.toUtf8Bytes("TEST_AI_DIGEST"))
      };

      const quorum = await generateDONPackedQuorumSignatures(payload, 2);
      expect(quorum.quorumReached).toBe(true);
      expect(quorum.signers.length).toBe(2);
      expect(quorum.signatures.length).toBe(2);
      
      // Check that signers are strictly sorted in ascending order for Solidity require(signer > lastSigner)
      expect(quorum.signers[0].toLowerCase() < quorum.signers[1].toLowerCase()).toBe(true);

      // Verify each signature can be recovered to the corresponding signer address
      for (let i = 0; i < quorum.signers.length; i++) {
        const recovered = ethers.verifyMessage(ethers.getBytes(quorum.messageHash), quorum.signatures[i]);
        expect(recovered.toLowerCase()).toBe(quorum.signers[i].toLowerCase());
      }
    });

    it("generates verifiable single-oracle packed signature matching saveRiskReportSigned", async () => {
      const payload = {
        assetAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        overallScore: 85,
        liquidity: 80,
        collateral: 85,
        auditScore: 80,
        security: 80,
        volatility: 80,
        governance: 80,
        dataHash: ethers.keccak256(ethers.toUtf8Bytes("CANONICAL_DATA_HASH"))
      };

      const result = await signPackedRiskReport(payload);
      expect(result.signature.startsWith("0x")).toBe(true);
      expect(result.signature.length).toBe(132);

      const recovered = ethers.verifyMessage(ethers.getBytes(result.messageHash), result.signature);
      expect(recovered.toLowerCase()).toBe(result.signer.toLowerCase());
    });
  });
});
