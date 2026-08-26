"""
CreditPulse AI — HTTP E2E Tests via FastAPI TestClient

Tests the actual HTTP endpoints (request→response cycle).
Focuses on endpoints that don't require external API calls or long timeouts.

All endpoint paths verified against actual app.routes.
"""

import unittest
from fastapi.testclient import TestClient
from app import app


class TestCreditPulseHTTPEndpoints(unittest.TestCase):
    """End-to-end HTTP tests using FastAPI TestClient."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # ─── Health & Info (fast, no external deps) ────────────────

    def test_health_endpoint(self):
        """GET /health — should return 200."""
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)
        print("✅ GET /health — 200 OK")

    def test_methodology(self):
        """GET /api/methodology — should return scoring methodology."""
        r = self.client.get("/api/methodology")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("version", data)
        self.assertIn("dimensions", data)
        print("✅ GET /api/methodology — methodology returned")

    def test_api_stats(self):
        """GET /api/stats — should return global statistics."""
        r = self.client.get("/api/stats")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("version", data)
        print(f"✅ GET /api/stats — version: {data.get('version')}")

    def test_attestcoin_status(self):
        """GET /api/attestcoin/status — should return module info."""
        r = self.client.get("/api/attestcoin/status")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("precompile", data)
        print("✅ GET /api/attestcoin/status — operational")

    # ─── DON Cluster (internal, no external deps) ──────────────

    def test_don_nodes(self):
        """GET /api/don/nodes — should return node list."""
        r = self.client.get("/api/don/nodes")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("nodes", data)
        self.assertIsInstance(data["nodes"], list)
        print(f"✅ GET /api/don/nodes — {len(data['nodes'])} nodes")

    def test_don_p2p_telemetry(self):
        """GET /api/don/p2p-telemetry — should return mesh topology."""
        r = self.client.get("/api/don/p2p-telemetry")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("mesh_clusters", data)
        self.assertIn("total_configured_peers", data)
        print(f"✅ GET /api/don/p2p-telemetry — {data['total_configured_peers']} peers")

    # ─── Cross-Chain Relay (internal ABI encoding) ─────────────

    def test_cross_chain_relay_encoding(self):
        """POST /api/cross-chain/relay — ABI-encoded packet."""
        r = self.client.post("/api/cross-chain/relay", json={
            "target_chain_id": 1,
            "asset_address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
            "score": 85,
            "dynamic_ltv": 90,
            "risk_tier": "AA",
            "data_hash": "0x" + "ab" * 32,
            "cc3_tx_hash": "0x" + "cd" * 32
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ENCODED_READY_FOR_BRIDGE")
        self.assertTrue(data["packet_id"].startswith("0x"))
        self.assertIsNotNone(data.get("abi_encoded_calldata"))
        self.assertEqual(data["destination_chain"], "Ethereum Mainnet")
        print("✅ POST /api/cross-chain/relay — ENCODED_READY_FOR_BRIDGE")

    def test_cross_chain_arbitrum(self):
        """POST /api/cross-chain/relay — Arbitrum destination."""
        r = self.client.post("/api/cross-chain/relay", json={
            "target_chain_id": 42161,
            "asset_address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
            "score": 72,
            "dynamic_ltv": 85,
            "risk_tier": "A",
            "data_hash": "0x" + "11" * 32,
            "cc3_tx_hash": "0x" + "22" * 32
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["destination_chain"], "Arbitrum One")
        print("✅ POST /api/cross-chain/relay (Arbitrum) — correct routing")

    # ─── Autonomous Keeper ─────────────────────────────────────

    def test_autonomous_status(self):
        """GET /api/autonomous/status — keeper daemon status."""
        r = self.client.get("/api/autonomous/status")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)
        self.assertIn("scheduler", data)
        print(f"✅ GET /api/autonomous/status — scheduler: {data.get('scheduler')}")

    # ─── OpenAPI Docs ──────────────────────────────────────────

    def test_openapi_schema_available(self):
        """GET /openapi.json — FastAPI schema."""
        r = self.client.get("/openapi.json")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("openapi", data)
        path_count = len(data["paths"])
        self.assertGreaterEqual(path_count, 10)
        print(f"✅ GET /openapi.json — {path_count} API paths documented")

    def test_docs_available(self):
        """GET /docs — Swagger UI should be served."""
        r = self.client.get("/docs")
        self.assertEqual(r.status_code, 200)
        self.assertIn("swagger", r.text.lower())
        print("✅ GET /docs — Swagger UI available")


if __name__ == "__main__":
    unittest.main()
