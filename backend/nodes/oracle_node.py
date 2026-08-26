"""
CreditPulse AI — Federated Oracle Node Runner v7.2.0
Independent validator instance with isolated cryptographic keyring and state evaluation.
"""

import time
from typing import Dict, Any, Optional
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

class OracleNodeRunner:
    def __init__(self, node_id: str, private_key: str, name: str, region: str = "us-east-1"):
        self.node_id = node_id
        self.private_key = private_key
        self.account = Account.from_key(private_key)
        self.address = self.account.address
        self.name = name
        self.region = region
        self.status = "ONLINE"
        self.uptime_seconds = 86400.0
        self.total_attestations = 0
        self.created_at = int(time.time())
        self._last_attestation_latency_ms: float = 0.0
        self._last_attestation_time: float = 0.0

    def get_health(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "name": self.name,
            "address": self.address,
            "region": self.region,
            "status": self.status,
            "uptime_seconds": round(time.time() - self.created_at + self.uptime_seconds, 1),
            "total_attestations": self.total_attestations,
            "last_attestation_latency_ms": round(self._last_attestation_latency_ms, 1),
            "last_attestation_epoch": self._last_attestation_time,
        }

    def sign_attestation(
        self,
        asset_address: str,
        scores: Dict[str, int],
        data_hash: str
    ) -> Dict[str, Any]:
        """
        Produce a cryptographic signature over canonical asset risk vectors.
        Tracks real computation latency for telemetry.
        """
        start_t = time.monotonic()

        target_addr_bytes = bytes.fromhex(asset_address[2:] if asset_address.startswith("0x") else asset_address)
        data_hash_bytes = bytes.fromhex(data_hash[2:] if data_hash.startswith("0x") else data_hash)

        scores_bytes = bytes([
            scores.get("overall", 0),
            scores.get("liquidity", 0),
            scores.get("collateral", 0),
            scores.get("audit", 0),
            scores.get("security", 0),
            scores.get("volatility", 0),
            scores.get("governance", 0),
        ])

        packed = target_addr_bytes + scores_bytes + data_hash_bytes
        msg_hash = Web3.keccak(packed)

        signable_message = encode_defunct(primitive=msg_hash)
        signed = self.account.sign_message(signable_message)

        self.total_attestations += 1
        elapsed_ms = round((time.monotonic() - start_t) * 1000, 2)
        self._last_attestation_latency_ms = elapsed_ms
        self._last_attestation_time = time.time()

        return {
            "node_id": self.node_id,
            "signer_address": self.address,
            "signature": "0x" + signed.signature.hex(),
            "message_hash": "0x" + msg_hash.hex(),
            "timestamp": int(time.time()),
            "signing_latency_ms": elapsed_ms,
        }

    def sign_zktls_attestation(
        self,
        asset_address: str,
        zk_tls_proof_hash: str
    ) -> Dict[str, Any]:
        """
        Produce a cryptographic signature over a Cryptographic PoR bank reserve commitment hash.
        Tracks real computation latency for telemetry.
        """
        start_t = time.monotonic()

        target_addr_bytes = bytes.fromhex(asset_address[2:] if asset_address.startswith("0x") else asset_address)
        proof_hash_bytes = bytes.fromhex(zk_tls_proof_hash[2:] if zk_tls_proof_hash.startswith("0x") else zk_tls_proof_hash)

        packed = target_addr_bytes + proof_hash_bytes
        msg_hash = Web3.keccak(packed)

        signable_message = encode_defunct(primitive=msg_hash)
        signed = self.account.sign_message(signable_message)

        self.total_attestations += 1
        elapsed_ms = round((time.monotonic() - start_t) * 1000, 2)
        self._last_attestation_latency_ms = elapsed_ms
        self._last_attestation_time = time.time()

        return {
            "node_id": self.node_id,
            "signer_address": self.address,
            "signature": "0x" + signed.signature.hex(),
            "message_hash": "0x" + msg_hash.hex(),
            "timestamp": int(time.time()),
            "signing_latency_ms": elapsed_ms,
        }
