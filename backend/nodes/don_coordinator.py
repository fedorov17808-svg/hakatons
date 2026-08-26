"""
CreditPulse AI — Federated DON Consensus Coordinator v7.2.0 (Physical Decentralization)
Aggregates independent oracle validator nodes over HTTP.

Deployment Modes:
- DEMO_LOCAL: All nodes on localhost (hackathon demo). Architecture is production-ready.
- PRODUCTION_DISTRIBUTED: Nodes on independent VPS/cloud instances across regions.

Each node independently fetches data, computes scores, and signs attestations.
The coordinator enforces M-of-N BFT threshold quorum with sorted address verification.
"""

import os
import time
import requests
import concurrent.futures
from typing import List, Dict, Any


class DONCoordinator:
    """Federated Decentralized Oracle Network coordinator with configurable endpoints."""

    # Default localhost endpoints for demo mode
    _DEFAULT_ENDPOINTS = [
        "http://127.0.0.1:8011",
        "http://127.0.0.1:8012",
        "http://127.0.0.1:8013",
    ]

    def __init__(self, primary_private_key: str = ""):
        # Read endpoints from environment — allows production multi-VPS deployment
        self.node_endpoints = [
            os.getenv("DON_NODE_1_URL", self._DEFAULT_ENDPOINTS[0]),
            os.getenv("DON_NODE_2_URL", self._DEFAULT_ENDPOINTS[1]),
            os.getenv("DON_NODE_3_URL", self._DEFAULT_ENDPOINTS[2]),
        ]
        # Filter out empty strings from env
        self.node_endpoints = [ep for ep in self.node_endpoints if ep.strip()]

        # Inter-node API key for authentication
        self._don_api_key = os.getenv("DON_API_KEY", "")
        self._auth_headers = {}
        if self._don_api_key:
            self._auth_headers = {"X-DON-API-Key": self._don_api_key}

        # Detect deployment mode
        all_local = all(
            any(local in ep for local in ["127.0.0.1", "localhost", "0.0.0.0"])
            for ep in self.node_endpoints
        )
        self.deployment_mode = "DEMO_LOCAL" if all_local else "PRODUCTION_DISTRIBUTED"

        # Real latency tracking per node
        self._node_latencies: Dict[str, float] = {}

    def get_cluster_status(self) -> Dict[str, Any]:
        """Query all validator nodes and return cluster health with real latency."""
        node_healths = []
        for endpoint in self.node_endpoints:
            start_t = time.monotonic()
            try:
                resp = requests.get(f"{endpoint}/health", timeout=3.0, headers=self._auth_headers)
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                if resp.status_code == 200:
                    health = resp.json()
                    health["measured_latency_ms"] = elapsed_ms
                    node_healths.append(health)
                else:
                    node_healths.append({
                        "status": "OFFLINE",
                        "endpoint": endpoint,
                        "measured_latency_ms": elapsed_ms,
                    })
            except Exception:
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                node_healths.append({
                    "status": "UNREACHABLE",
                    "endpoint": endpoint,
                    "measured_latency_ms": elapsed_ms,
                })

        online_count = len([n for n in node_healths if n.get("status") == "ONLINE"])

        return {
            "total_nodes": len(self.node_endpoints),
            "online_nodes": online_count,
            "required_quorum": 2,
            "cluster_health": "OPTIMAL" if online_count >= 2 else "DEGRADED",
            "consensus_standard": "BFT Threshold Quorum (M-of-N)",
            "deployment_mode": self.deployment_mode,
            "deployment_note": (
                "Demo mode: nodes running on localhost with independent key pairs and "
                "independent score re-computation. Production deployment replaces "
                "DON_NODE_*_URL env vars with distributed VPS instances."
                if self.deployment_mode == "DEMO_LOCAL"
                else "Production mode: nodes distributed across independent infrastructure."
            ),
            "nodes": node_healths,
        }

    def gather_consensus(
        self,
        asset_address: str,
        scores: Dict[str, int],
        data_hash: str,
        min_quorum: int = 2,
        snapshot_time: int = None,
    ) -> Dict[str, Any]:
        """
        Query physically distributed nodes over HTTP, collect signatures,
        enforce quorum, and sort signers in ascending address order.

        Each node independently:
        1. Fetches live oracle data (DeFiLlama, DexScreener, EVM RPC)
        2. Re-computes the deterministic score
        3. Verifies data_hash and score match
        4. Signs only if independent verification passes
        """
        payload = {
            "asset_address": asset_address,
            "scores": {
                "overall": scores.get("overall"),
                "liquidity": scores.get("liquidity"),
                "collateral": scores.get("collateral"),
                "audit": scores.get("audit"),
                "security": scores.get("security"),
                "volatility_score": scores.get("volatility"),
                "governance": scores.get("governance"),
            },
            "data_hash": data_hash,
            "snapshot_time": snapshot_time,
        }

        def fetch_attestation(endpoint):
            start_t = time.monotonic()
            try:
                resp = requests.post(
                    f"{endpoint}/sign_attestation", json=payload, timeout=25.0,
                    headers=self._auth_headers
                )
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                if resp.status_code == 200:
                    result = resp.json()
                    result["node_latency_ms"] = elapsed_ms
                    return result
                else:
                    print(f"Node {endpoint} returned {resp.status_code}: {resp.text}")
                    return None
            except Exception as e:
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                print(f"Node {endpoint} exception ({elapsed_ms}ms): {e}")
                return None

        attestations = []
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=len(self.node_endpoints)
        ) as executor:
            results = executor.map(fetch_attestation, self.node_endpoints)
            for res in results:
                if res:
                    attestations.append(res)

        if len(attestations) < min_quorum:
            raise RuntimeError(
                f"DON quorum failed: gathered {len(attestations)} signatures "
                f"from physical nodes, required {min_quorum}"
            )

        # Pick top min_quorum signatures
        selected = attestations[:min_quorum]

        # Sort in ascending order of signer_address to satisfy CreditPulseASC.sol
        selected.sort(key=lambda a: a["signer_address"].lower())

        signers = [a["signer_address"] for a in selected]
        signatures = [a["signature"] for a in selected]
        msg_hash = selected[0]["message_hash"]

        # Collect which independent data sources each node used
        node_sources = [a.get("sources_used", []) for a in selected]

        return {
            "quorum_met": True,
            "quorum_count": len(selected),
            "total_nodes_responded": len(attestations),
            "total_nodes_configured": len(self.node_endpoints),
            "deployment_mode": self.deployment_mode,
            "signers": signers,
            "signatures": signatures,
            "message_hash": msg_hash,
            "node_latencies_ms": [a.get("node_latency_ms", 0) for a in selected],
            "independent_sources_per_node": node_sources,
            "scores_payload": [
                scores.get("overall", 0),
                scores.get("liquidity", 0),
                scores.get("collateral", 0),
                scores.get("audit", 0),
                scores.get("security", 0),
                scores.get("volatility", 0),
                scores.get("governance", 0),
            ],
        }

    def gather_zktls_consensus(
        self, payload: Dict[str, Any], min_quorum: int = 2
    ) -> Dict[str, Any]:
        """
        Query physically distributed nodes to sign a cryptographic PoR bank reserve
        commitment, collect signatures, enforce quorum, and sort.
        """

        def fetch_zktls(endpoint):
            start_t = time.monotonic()
            try:
                resp = requests.post(
                    f"{endpoint}/sign_zktls_attestation",
                    json=payload,
                    timeout=10.0,
                    headers=self._auth_headers
                )
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                if resp.status_code == 200:
                    result = resp.json()
                    result["node_latency_ms"] = elapsed_ms
                    return result
                else:
                    print(f"PoR Node {endpoint} returned {resp.status_code}: {resp.text}")
                    return None
            except Exception as e:
                elapsed_ms = round((time.monotonic() - start_t) * 1000, 1)
                self._node_latencies[endpoint] = elapsed_ms
                print(f"PoR Node {endpoint} exception ({elapsed_ms}ms): {e}")
                return None

        attestations = []
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=len(self.node_endpoints)
        ) as executor:
            results = executor.map(fetch_zktls, self.node_endpoints)
            for res in results:
                if res:
                    attestations.append(res)

        if len(attestations) < min_quorum:
            raise RuntimeError(
                f"Cryptographic PoR DON quorum failed: gathered {len(attestations)} "
                f"signatures from physical nodes, required {min_quorum}"
            )

        # Pick top min_quorum signatures
        selected = attestations[:min_quorum]

        # Sort by signer_address in the signature_payload
        selected.sort(
            key=lambda a: a["signature_payload"]["signer_address"].lower()
        )

        signers = [a["signature_payload"]["signer_address"] for a in selected]
        signatures = [a["signature_payload"]["signature"] for a in selected]
        msg_hash = selected[0]["signature_payload"]["message_hash"]

        # All valid attestations should have the same verification_details
        verification_details = selected[0]["verification_details"]

        return {
            "quorum_met": True,
            "quorum_count": len(selected),
            "total_nodes_responded": len(attestations),
            "deployment_mode": self.deployment_mode,
            "signers": signers,
            "signatures": signatures,
            "message_hash": msg_hash,
            "node_latencies_ms": [a.get("node_latency_ms", 0) for a in selected],
            "verification_details": verification_details,
        }

