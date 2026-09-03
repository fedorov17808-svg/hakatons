import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  computeMertonDefault,
  simulateJumpDiffusionVaR,
  computeLindySeasoning,
  computeQuantitativeRiskAdjustment
} from "../lib/quantEngine";
import {
  generateDONPackedQuorumSignatures,
  generateDONQuorumSignatures,
  getDONValidatorNodes
} from "../lib/donSigners";
import {
  signPackedRiskReport,
  signEIP712RiskReport
} from "../lib/oracleSigner";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  PRESET_ASSETS
} from "../lib/config";

describe("E2E Integration Pipeline: CreditPulse AI Core Flow", () => {
  const targetAsset = PRESET_ASSETS[0].address; // Ondo OUSG
  const mockScore = 88;
  const mockLiquidity = 90;
  const mockCollateral = 85;
  const mockAudit = 95;
  const mockSecurity = 88;
  const mockVolatility = 82;
  const mockGovernance = 85;

  const canonicalDataHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ address: targetAsset.toLowerCase(), score: mockScore }))
  );
  const canonicalAiDigest = ethers.keccak256(
    ethers.toUtf8Bytes(`NARRATIVE:${targetAsset}:${mockScore}`)
  );

  // ── Step 1: Quantitative Engine Execution ─────────────────────────
  it("Phase 1: executes Merton Structural Default & Jump-Diffusion VaR models", () => {
    const estAssetUsd = 550000000; // $550M
    const estDebtUsd = 550000000 * 0.15; // 15% debt
    const annualVol = 0.15;

    const merton = computeMertonDefault(estAssetUsd, estDebtUsd, annualVol, 0.045, 1.0);
    expect(merton.probDefault).toBeLessThan(0.01); // Highly solvent
    expect(merton.distanceToDefault).toBeGreaterThan(3.0); // > 3 sigma

    const mc = simulateJumpDiffusionVaR(estAssetUsd, annualVol, 10, 500);
    expect(mc.var99).toBeGreaterThan(0);
    expect(mc.cvar99).toBeGreaterThanOrEqual(mc.var99);

    const lindy = computeLindySeasoning(730); // 2 years
    expect(lindy).toBeGreaterThanOrEqual(1.0);

    const quantAdj = computeQuantitativeRiskAdjustment(merton.probDefault, mc.cvar99, merton.distanceToDefault);
    expect(typeof quantAdj.netAdjustment).toBe("number");
  });

  // ── Step 2: DON Multi-Oracle BFT Quorum Consensus ─────────────────
  it("Phase 2: aggregates 2-of-3 BFT Quorum signatures with ascending address sorting", async () => {
    const payload = {
      assetAddress: targetAsset,
      overallScore: mockScore,
      liquidity: mockLiquidity,
      collateral: mockCollateral,
      auditScore: mockAudit,
      security: mockSecurity,
      volatility: mockVolatility,
      governance: mockGovernance,
      dataHash: canonicalDataHash,
      aiDigest: canonicalAiDigest
    };

    const packedQuorum = await generateDONPackedQuorumSignatures(payload, 2);

    expect(packedQuorum.quorumReached).toBe(true);
    expect(packedQuorum.signers.length).toBe(2);
    expect(packedQuorum.signatures.length).toBe(2);
    expect(packedQuorum.messageHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Verify signers are strictly sorted ascending (as required by CreditPulseASC.sol)
    const addr1 = packedQuorum.signers[0].toLowerCase();
    const addr2 = packedQuorum.signers[1].toLowerCase();
    expect(addr1.localeCompare(addr2)).toBeLessThan(0);

    // Verify ECDSA recovery for each signer signature
    const ethSignedHash = ethers.keccak256(
      ethers.solidityPacked(
        ["string", "bytes32"],
        ["\x19Ethereum Signed Message:\n32", packedQuorum.messageHash]
      )
    );

    for (let i = 0; i < packedQuorum.signers.length; i++) {
      const recovered = ethers.recoverAddress(ethSignedHash, packedQuorum.signatures[i]);
      expect(recovered.toLowerCase()).toBe(packedQuorum.signers[i].toLowerCase());
    }
  });

  // ── Step 3: Contract Calldata Encoding & ABI Compatibility ─────────
  it("Phase 3: encodes contract calldata matching saveRiskReportMultiSigned ABI", async () => {
    const iface = new ethers.Interface(CONTRACT_ABI);
    const scoreVector = [mockScore, mockLiquidity, mockCollateral, mockAudit, mockSecurity, mockVolatility, mockGovernance];

    const nodes = getDONValidatorNodes();
    const sampleSigners = [nodes[0].address, nodes[1].address];
    const sampleSignatures = ["0x" + "11".repeat(65), "0x" + "22".repeat(65)];

    const calldata = iface.encodeFunctionData("saveRiskReportMultiSigned", [
      targetAsset,
      scoreVector,
      canonicalDataHash,
      canonicalAiDigest,
      sampleSigners,
      sampleSignatures
    ]);

    expect(calldata).toMatch(/^0x/);
    expect(calldata.length).toBeGreaterThan(200);

    // Verify selector matches
    const parsed = iface.parseTransaction({ data: calldata });
    expect(parsed?.name).toBe("saveRiskReportMultiSigned");
    expect(parsed?.args[0].toLowerCase()).toBe(targetAsset.toLowerCase());
  });

  // ── Step 4: Dual EIP-712 & Packed Single-Signer Attestation ────────
  it("Phase 4: generates verifiable EIP-712 & Packed attestations for relayer flow", async () => {
    const packedResult = await signPackedRiskReport({
      assetAddress: targetAsset,
      overallScore: mockScore,
      liquidity: mockLiquidity,
      collateral: mockCollateral,
      auditScore: mockAudit,
      security: mockSecurity,
      volatility: mockVolatility,
      governance: mockGovernance,
      dataHash: canonicalDataHash
    });

    expect(packedResult.signer).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(packedResult.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

    const eip712Result = await signEIP712RiskReport({
      assetAddress: targetAsset,
      overallScore: mockScore,
      liquidity: mockLiquidity,
      collateral: mockCollateral,
      auditScore: mockAudit,
      security: mockSecurity,
      volatility: mockVolatility,
      governance: mockGovernance,
      dataHash: canonicalDataHash,
      aiDigest: canonicalAiDigest
    });

    expect(eip712Result.domain.chainId).toBe(102031);
    expect(eip712Result.domain.verifyingContract).toBe(CONTRACT_ADDRESS);
    expect(eip712Result.v === 27 || eip712Result.v === 28).toBe(true);
  });
});
