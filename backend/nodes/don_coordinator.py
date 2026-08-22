"""
CreditPulse AI — Federated DON Consensus Coordinator v7.0.1 (Physical Decentralization)
Aggregates independent oracle validator nodes over HTTP.
"""

import requests
from typing import List, Dict, Any

class DONCoordinator:
    def __init__(self, primary_private_key: str = ""):
        # Instead of instantiating nodes locally, we point to their physical HTTP endpoints
        self.node_endpoints = [
            "http://127.0.0.1:8011",
            "http://127.0.0.1:8012",
            "http://127.0.0.1:8013"
        ]

    def get_cluster_status(self) -> Dict[str, Any]:
        node_healths = []
        for endpoint in self.node_endpoints:
            try:
                resp = requests.get(f"{endpoint}/health", timeout=2.0)
                if resp.status_code == 200:
                    node_healths.append(resp.json())
                else:
                    node_healths.append({"status": "OFFLINE", "endpoint": endpoint})
            except Exception:
                node_healths.append({"status": "UNREACHABLE", "endpoint": endpoint})

        return {
            "total_nodes": len(self.node_endpoints),
            "required_quorum": 2,
            "cluster_health": "OPTIMAL" if len([n for n in node_healths if n.get("status") == "ONLINE"]) >= 2 else "DEGRADED",
            "consensus_standard": "BFT Threshold Quorum (M-of-N)",
            "nodes": node_healths
        }

    def gather_consensus(
        self,
        asset_address: str,
        scores: Dict[str, int],
        data_hash: str,
        min_quorum: int = 2,
        snapshot_time: int = None
    ) -> Dict[str, Any]:
        """
        Query physically distributed nodes over HTTP, collect signatures, enforce quorum, and sort.
        """
        attestations = []
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
            "snapshot_time": snapshot_time
        }

        import concurrent.futures

        def fetch_attestation(endpoint):
            try:
                resp = requests.post(f"{endpoint}/sign_attestation", json=payload, timeout=25.0)
                if resp.status_code == 200:
                    return resp.json()
                else:
                    print(f"Node {endpoint} returned {resp.status_code}: {resp.text}")
                    return None
            except Exception as e:
                print(f"Node {endpoint} exception: {e}")
                return None

        attestations = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.node_endpoints)) as executor:
            results = executor.map(fetch_attestation, self.node_endpoints)
            for res in results:
                if res:
                    attestations.append(res)

        if len(attestations) < min_quorum:
            raise RuntimeError(f"DON quorum failed: gathered {len(attestations)} signatures from physical nodes, required {min_quorum}")

        # Pick top min_quorum signatures
        selected = attestations[:min_quorum]
        
        # Sort in ascending order of signer_address to satisfy CreditPulseASC.sol
        selected.sort(key=lambda a: a["signer_address"].lower())

        signers = [a["signer_address"] for a in selected]
        signatures = [a["signature"] for a in selected]
        msg_hash = selected[0]["message_hash"]

        return {
            "quorum_met": True,
            "quorum_count": len(selected),
            "total_nodes_active": len(self.node_endpoints),
            "signers": signers,
            "signatures": signatures,
            "message_hash": msg_hash,
            "scores_payload": [
                scores.get("overall", 0),
                scores.get("liquidity", 0),
                scores.get("collateral", 0),
                scores.get("audit", 0),
                scores.get("security", 0),
                scores.get("volatility", 0),
                scores.get("governance", 0),
            ]
        }

    def gather_zktls_consensus(
        self,
        payload: Dict[str, Any],
        min_quorum: int = 2
    ) -> Dict[str, Any]:
        """
        Query physically distributed nodes over HTTP to sign a zkTLS bank reserve proof, collect signatures, enforce quorum, and sort.
        """
        attestations = []

        for endpoint in self.node_endpoints:
            try:
                resp = requests.post(f"{endpoint}/sign_zktls_attestation", json=payload, timeout=5.0)
                if resp.status_code == 200:
                    attestations.append(resp.json())
            except Exception as e:
                pass # Node failed or unreachable

        if len(attestations) < min_quorum:
            raise RuntimeError(f"zkTLS DON quorum failed: gathered {len(attestations)} signatures from physical nodes, required {min_quorum}")

        # Pick top min_quorum signatures
        selected = attestations[:min_quorum]
        
        # We need to sort by signer_address in the signature_payload
        selected.sort(key=lambda a: a["signature_payload"]["signer_address"].lower())

        signers = [a["signature_payload"]["signer_address"] for a in selected]
        signatures = [a["signature_payload"]["signature"] for a in selected]
        msg_hash = selected[0]["signature_payload"]["message_hash"]
        
        # All valid attestations should have the same verification_details, so we just take the first one
        verification_details = selected[0]["verification_details"]

        return {
            "quorum_met": True,
            "quorum_count": len(selected),
            "total_nodes_active": len(self.node_endpoints),
            "signers": signers,
            "signatures": signatures,
            "message_hash": msg_hash,
            "verification_details": verification_details
        }
