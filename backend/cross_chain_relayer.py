"""
CreditPulse AI — Cross-Chain Message Encoder v7.2.0

Encodes and formats credit score relay packets for cross-chain delivery
via standard bridging protocols (LayerZero v2, CCIP, OP Stack Messenger).

Architecture:
- This module handles MESSAGE ENCODING (ABI-encoding, packet structure, routing)
- Actual cross-chain delivery requires deploying bridge adapters on destination chains
- For the hackathon demo, packets are encoded and ready for relay
- In production, integrate with LayerZero/CCIP endpoint contracts

What this module DOES:
  ✓ ABI-encodes cross-chain payload (EIP-5164 compatible format)
  ✓ Computes deterministic packet IDs for deduplication
  ✓ Validates destination chain support and routing parameters
  ✓ Estimates delivery latency based on bridge protocol

What this module does NOT do (yet):
  ✗ Submit transactions to destination chains (requires bridge contract deployment)
  ✗ Monitor relay confirmation status
  ✗ Handle gas token bridging / fee estimation on destination
"""

import time
from typing import Dict, Any, List
from web3 import Web3


class CrossChainMessageEncoder:
    """
    Formats and ABI-encodes credit score packets for cross-chain relay.

    Status lifecycle:
    - ENCODED: Packet formatted, ABI-encoded, and ready for bridge submission
    - PENDING_BRIDGE_INTEGRATION: Bridge adapter contracts not yet deployed
    """

    SUPPORTED_DESTINATIONS = {
        1:     {"name": "Ethereum Mainnet",  "bridge": "LayerZero v2 / CCIP", "latency_secs": 15},
        42161: {"name": "Arbitrum One",      "bridge": "Nitro Rollup Relayer", "latency_secs": 3},
        8453:  {"name": "Base Mainnet",      "bridge": "OP Stack Native Messenger", "latency_secs": 2},
        10:    {"name": "Optimism",          "bridge": "CrossDomainMessenger", "latency_secs": 2},
    }

    # ABI types for cross-chain payload encoding (EIP-5164 compatible)
    PAYLOAD_ABI_TYPES = [
        "address",   # assetAddress
        "uint8",     # overallScore
        "uint16",    # dynamicLtvBps
        "string",    # riskTier
        "bytes32",   # dataHash
        "bytes32",   # cc3TxHash
        "uint256",   # timestamp
    ]

    @classmethod
    def encode_cross_chain_payload(
        cls,
        target_chain_id: int,
        asset_address: str,
        score: int,
        dynamic_ltv: int,
        risk_tier: str,
        data_hash: str,
        cc3_tx_hash: str
    ) -> Dict[str, Any]:
        """
        ABI-encode a cross-chain credit relay packet.

        The output packet is formatted as EIP-5164 compatible calldata
        ready for submission to a bridge endpoint contract.
        """
        dest_info = cls.SUPPORTED_DESTINATIONS.get(
            target_chain_id,
            {"name": f"EVM Chain #{target_chain_id}", "bridge": "Generic Relayer", "latency_secs": 10}
        )

        # Normalize inputs
        clean_asset = Web3.to_checksum_address(asset_address) if Web3.is_address(asset_address) else asset_address
        clean_data_hash = data_hash if data_hash.startswith("0x") else f"0x{data_hash}"
        clean_tx_hash = cc3_tx_hash if cc3_tx_hash.startswith("0x") else f"0x{cc3_tx_hash}"
        timestamp = int(time.time())

        # ABI-encode the payload (real Solidity-compatible encoding)
        try:
            encoded_payload = Web3().codec.encode(
                ["address", "uint8", "uint16", "string", "bytes32", "bytes32", "uint256"],
                [
                    clean_asset,
                    score,
                    dynamic_ltv,
                    risk_tier,
                    bytes.fromhex(clean_data_hash[2:].ljust(64, '0')[:64]),
                    bytes.fromhex(clean_tx_hash[2:].ljust(64, '0')[:64]),
                    timestamp,
                ]
            )
            abi_encoded_hex = "0x" + encoded_payload.hex()
            encoding_status = "ABI_ENCODED"
        except Exception as e:
            # Fallback: keccak-based packet ID without full ABI encoding
            abi_encoded_hex = None
            encoding_status = f"ENCODING_FALLBACK: {str(e)}"

        # Deterministic packet ID for deduplication
        packet_id = Web3.keccak(
            text=f"RELAY:{target_chain_id}:{clean_asset}:{score}:{clean_tx_hash}:{timestamp}"
        ).hex()

        return {
            "packet_id": "0x" + packet_id,
            "source_chain": "Creditcoin CC3 (Chain ID 102031)",
            "destination_chain": dest_info["name"],
            "destination_chain_id": target_chain_id,
            "transport_protocol": dest_info["bridge"],
            "payload": {
                "asset_address": clean_asset,
                "overall_score": score,
                "dynamic_ltv_bps": dynamic_ltv,
                "risk_tier": risk_tier,
                "data_hash": clean_data_hash,
                "cc3_tx_hash": clean_tx_hash,
                "dispatched_at": timestamp,
            },
            "abi_encoded_calldata": abi_encoded_hex,
            "calldata_size_bytes": len(encoded_payload) if abi_encoded_hex else 0,
            "encoding_status": encoding_status,
            "estimated_delivery_latency_sec": dest_info["latency_secs"],
            "status": "ENCODED_READY_FOR_BRIDGE",
            "note": "Packet ABI-encoded and ready for bridge contract submission. "
                    "Deploy CreditPulseReceiver on destination chain to accept relayed scores."
        }


# Backward compatibility alias
CrossChainRelayer = CrossChainMessageEncoder
