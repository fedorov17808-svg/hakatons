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

    def test_methodology(self):
        """GET /api/methodology — should return scoring methodology."""
        r = self.client.get("/api/methodology")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("version", data)
        self.assertIn("dimensions", data)

    def test_api_stats(self):
        """GET /api/stats — should return global statistics."""
        r = self.client.get("/api/stats")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("version", data)

    def test_attestcoin_status(self):
        """GET /api/attestcoin/status — should return module info."""
        r = self.client.get("/api/attestcoin/status")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("precompile", data)

    # ─── DON Cluster (internal, no external deps) ──────────────

    def test_don_nodes(self):
        """GET /api/don/nodes — should return node list."""
        r = self.client.get("/api/don/nodes")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("nodes", data)
        self.assertIsInstance(data["nodes"], list)

    def test_don_p2p_telemetry(self):
        """GET /api/don/p2p-telemetry — should return mesh topology."""
        r = self.client.get("/api/don/p2p-telemetry")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("mesh_clusters", data)
        self.assertIn("total_configured_peers", data)

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

    # ─── Autonomous Keeper ─────────────────────────────────────

    def test_autonomous_status(self):
        """GET /api/autonomous/status — keeper daemon status."""
        r = self.client.get("/api/autonomous/status")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)
        self.assertIn("scheduler", data)

    # ─── OpenAPI Docs ──────────────────────────────────────────

    def test_openapi_schema_available(self):
        """GET /openapi.json — FastAPI schema."""
        r = self.client.get("/openapi.json")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("openapi", data)
        path_count = len(data["paths"])
        self.assertGreaterEqual(path_count, 10)

    def test_docs_available(self):
        """GET /docs — Swagger UI should be served."""
        r = self.client.get("/docs")
        self.assertEqual(r.status_code, 200)
        self.assertIn("swagger", r.text.lower())


class TestEdgeCasesAndNegativePaths(unittest.TestCase):
    """Negative and edge-case tests for robustness validation."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # ─── 404 / Invalid Routes ──────────────────────────────────

    def test_nonexistent_endpoint_returns_404(self):
        """GET /api/nonexistent — should return 404."""
        r = self.client.get("/api/nonexistent")
        self.assertEqual(r.status_code, 404)

    def test_wrong_method_returns_405(self):
        """DELETE /health — wrong HTTP method should return 405."""
        r = self.client.delete("/health")
        self.assertEqual(r.status_code, 405)

    # ─── Malformed Payloads ────────────────────────────────────

    def test_monte_carlo_missing_required_fields(self):
        """POST /api/quant/monte-carlo with empty body — 422."""
        r = self.client.post("/api/quant/monte-carlo", json={})
        self.assertEqual(r.status_code, 422)

    def test_stress_test_invalid_scenario(self):
        """POST /api/quant/stress-test with invalid scenario — should still work (fallback)."""
        r = self.client.post("/api/quant/stress-test", json={
            "tvl_usd": 1000000,
            "score": 75,
            "scenario": "nonexistent_scenario"
        })
        # Should either 200 with fallback or 400 — both acceptable
        self.assertIn(r.status_code, [200, 400])

    def test_cross_chain_relay_invalid_chain_id(self):
        """POST /api/cross-chain/relay with chain_id=0 — should succeed (encoding only)."""
        r = self.client.post("/api/cross-chain/relay", json={
            "target_chain_id": 0,
            "asset_address": "0x0000000000000000000000000000000000000000",
            "score": 0,
            "dynamic_ltv": 0,
            "risk_tier": "UNKNOWN",
            "data_hash": "0x" + "00" * 32,
            "cc3_tx_hash": "0x" + "00" * 32
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        # Response should contain encoded payload data
        self.assertTrue(len(data) > 0)

    # ─── Boundary Values ───────────────────────────────────────

    def test_monte_carlo_extreme_values(self):
        """POST /api/quant/monte-carlo with extreme TVL — should compute."""
        r = self.client.post("/api/quant/monte-carlo", json={
            "tvl_usd": 999999999999,
            "score": 1,
            "iterations": 100,
            "time_horizon_days": 1
        })
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("metrics", data)
        metrics = data["metrics"]
        self.assertIn("var_95_pct", metrics)

    # ─── Response Structure Validation ─────────────────────────

    def test_health_response_structure(self):
        """GET /health — validate full response schema."""
        r = self.client.get("/health")
        data = r.json()
        self.assertIn("status", data)
        self.assertIn("version", data)
        self.assertIn(data["status"], ["healthy", "operational"])

    def test_methodology_response_completeness(self):
        """GET /api/methodology — should have all scoring dimensions."""
        r = self.client.get("/api/methodology")
        data = r.json()
        self.assertIn("dimensions", data)
        dims = data["dimensions"]
        self.assertGreaterEqual(len(dims), 4, "Should have at least 4 scoring dimensions")


if __name__ == "__main__":
    unittest.main()
