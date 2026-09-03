"""
Unit tests for storage.py — SQLite persistent scoring ledger.
Tests all CRUD operations with an isolated in-memory database.
"""
import os
import sys
import tempfile
import time

# Override DB path BEFORE importing storage
_test_dir = tempfile.mkdtemp()
os.environ["CREDITPULSE_DB_PATH"] = os.path.join(_test_dir, "test_scores.db")

sys.path.insert(0, os.path.dirname(__file__))
import storage


def test_schema_creation():
    """Schema auto-creates on first access."""
    conn = storage._ensure_db()
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    assert "score_history" in tables, f"score_history not found in {tables}"
    assert "attestation_log" in tables, f"attestation_log not found in {tables}"
    assert "schema_version" in tables, f"schema_version not found in {tables}"


def test_record_score():
    """Insert a scoring event and verify it's persisted."""
    scores = {
        "overall": 72,
        "liquidity": 65,
        "collateral": 80,
        "security": 70,
        "volatility_score": 55,
        "governance": 60,
        "audit": 40,
        "seasoning_score": 85,
        "effective_tvl": 150_000_000.0,
        "weight_profile": {"category": "Lending"},
        "circuit_breaker_active": False,
        "bank_run_detected": False,
        "liquidity_spike_detected": False,
    }
    row_id = storage.record_score(
        asset_address="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        protocol_name="Aave V3",
        scores=scores,
        data_hash="0xabcdef1234567890",
        data_sources=["DeFiLlama", "DexScreener"],
        snapshot_time=int(time.time()),
    )
    assert row_id is not None and row_id > 0, f"Expected positive row_id, got {row_id}"


def test_record_multiple_scores():
    """Insert multiple scores for the same asset."""
    addr = "0xe8684521db5a68778844145ba0a0374d8e95e140"
    for i in range(5):
        storage.record_score(
            asset_address=addr,
            protocol_name="Compound V3",
            scores={"overall": 60 + i * 5, "liquidity": 50 + i * 3},
            data_hash=f"0xhash{i}",
            data_sources=["DeFiLlama"],
            snapshot_time=int(time.time()) + i,
        )

    history = storage.get_score_history(addr, limit=10)
    assert len(history) == 5, f"Expected 5 records, got {len(history)}"
    # Newest first
    assert history[0]["overall"] >= history[-1]["overall"], "Records not in descending order"


def test_get_score_stats():
    """Aggregate stats should compute correctly."""
    addr = "0xe8684521db5a68778844145ba0a0374d8e95e140"
    stats = storage.get_score_stats(addr)
    assert stats["total_scores"] == 5, f"Expected 5, got {stats['total_scores']}"
    assert stats["min_overall"] == 60
    assert stats["max_overall"] == 80
    assert 60 <= stats["avg_overall"] <= 80


def test_record_attestation():
    """Insert and verify an attestation event."""
    row_id = storage.record_attestation(
        asset_address="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        quorum_count=3,
        signers=["node-alpha", "node-beta", "node-gamma"],
        message_hash="0xdeadbeef",
        deployment_mode="production",
        node_latencies=[12.5, 15.3, 11.8],
    )
    assert row_id > 0


def test_global_stats():
    """Global stats should aggregate across all assets."""
    stats = storage.get_global_stats()
    assert stats["total_scores"] >= 6, f"Expected >= 6 total scores, got {stats['total_scores']}"
    assert stats["unique_assets"] >= 2, f"Expected >= 2 unique assets, got {stats['unique_assets']}"
    assert stats["total_attestations"] >= 1


def test_case_insensitive_address():
    """Addresses should be normalized to lowercase."""
    addr_upper = "0x87870BCA3F3FD6335C3F4CE8392D69350B4FA4E2"
    addr_lower = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"
    history = storage.get_score_history(addr_upper)
    assert len(history) > 0, "Should find records with uppercase address"
    history_lower = storage.get_score_history(addr_lower)
    assert len(history) == len(history_lower), "Case-insensitive lookup failed"


def test_empty_history():
    """Querying a non-existent address should return empty results."""
    history = storage.get_score_history("0x0000000000000000000000000000000000000000")
    assert history == [], f"Expected empty list, got {history}"
    stats = storage.get_score_stats("0x0000000000000000000000000000000000000000")
    assert stats["total_scores"] == 0


if __name__ == "__main__":
    test_schema_creation()
    test_record_score()
    test_record_multiple_scores()
    test_get_score_stats()
    test_record_attestation()
    test_global_stats()
    test_case_insensitive_address()
    test_empty_history()
