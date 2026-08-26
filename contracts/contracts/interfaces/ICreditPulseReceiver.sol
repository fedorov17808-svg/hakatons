// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title ICreditPulseReceiver
 * @notice Standard interface for downstream DeFi/RWA contracts on any EVM chain
 * (Ethereum, Arbitrum, Base, Optimism) to receive cross-chain credit ratings
 * pushed from Creditcoin CC3 via LayerZero / Chainlink CCIP / Attestcoin Relayers.
 */
interface ICreditPulseReceiver {
    /**
     * @notice Callback invoked when a new verified credit report arrives across chains.
     * @param assetAddress The token or protocol evaluated
     * @param overallScore Credit rating (0-100)
     * @param dynamicLtv Recommended Max LTV percentage (e.g. 80 = 80%)
     * @param riskTier Investment Grade Tier ("AAA", "AA", "A", "BBB", "HighRisk")
     * @param dataHash Cryptographic hash binding off-chain telemetry
     * @param cc3BlockNumber Block number on Creditcoin CC3 where proof was minted
     */
    function onCreditPulseUpdate(
        address assetAddress,
        uint8 overallScore,
        uint8 dynamicLtv,
        string calldata riskTier,
        bytes32 dataHash,
        uint64 cc3BlockNumber
    ) external;
}
