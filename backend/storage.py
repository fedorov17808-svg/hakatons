"""
CreditPulse AI — Persistent Score Storage (SQLite)
Append-only ledger of all scoring events for audit trail and historical analysis.

Design:
- Write-ahead logging (WAL) for concurrent reads during writes
- Append-only: scores are never updated, only inserted
- Automatic schema migration on startup
- Thread-safe via SQLite WAL mode
"""

import sqlite3
import os
import json
import time
import threading
from typing import Optional, List, Dict, Any

# Default DB path — can be overridden via CREDITPULSE_DB_PATH env var
_DB_PATH = os.getenv("CREDITPULSE_DB_PATH", os.path.join(os.path.dirname(__file__), "data", "scores.db"))
_db_lock = threading.Lock()

SCHEMA_VERSION = 1

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_address TEXT NOT NULL,
    protocol_name TEXT,
    overall INTEGER NOT NULL,
    liquidity INTEGER,
    collateral INTEGER,
    security INTEGER,
    volatility INTEGER,
    governance INTEGER,
    audit INTEGER,
    seasoning_score INTEGER,
    effective_tvl REAL,
    category TEXT,
    data_hash TEXT NOT NULL,
    data_sources TEXT,
    circuit_breaker_active INTEGER DEFAULT 0,
    circuit_breaker_reason TEXT,
    bank_run_detected INTEGER DEFAULT 0,
    liquidity_spike_detected INTEGER DEFAULT 0,
    snapshot_time INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    node_id TEXT DEFAULT 'gateway'
);

CREATE INDEX IF NOT EXISTS idx_score_asset ON score_history(asset_address);
CREATE INDEX IF NOT EXISTS idx_score_time ON score_history(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_score_overall ON score_history(overall);

CREATE TABLE IF NOT EXISTS attestation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_address TEXT NOT NULL,
    quorum_count INTEGER,
    signers TEXT,
    message_hash TEXT,
    deployment_mode TEXT,
    node_latencies TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attest_asset ON attestation_log(asset_address);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);
"""


def _ensure_db() -> sqlite3.Connection:
    """Initialize DB with WAL mode and schema if needed."""
    db_dir = os.path.dirname(_DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(_DB_PATH, timeout=10.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")

    # Check if schema exists
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    )
    if cursor.fetchone() is None:
        conn.executescript(_SCHEMA_SQL)
        conn.execute("INSERT INTO schema_version (version) VALUES (?)", (SCHEMA_VERSION,))
        conn.commit()

    return conn


def record_score(
    asset_address: str,
    protocol_name: str,
    scores: Dict[str, Any],
    data_hash: str,
    data_sources: List[str],
    snapshot_time: int,
    node_id: str = "gateway",
) -> int:
    """
    Persist a scoring event to the append-only ledger.
    Returns the inserted row ID.
    """
    with _db_lock:
        conn = _ensure_db()
        try:
            cursor = conn.execute(
                """INSERT INTO score_history
                (asset_address, protocol_name, overall, liquidity, collateral,
                 security, volatility, governance, audit, seasoning_score,
                 effective_tvl, category, data_hash, data_sources,
                 circuit_breaker_active, circuit_breaker_reason,
                 bank_run_detected, liquidity_spike_detected,
                 snapshot_time, created_at, node_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    asset_address.lower(),
                    protocol_name,
                    scores.get("overall", 0),
                    scores.get("liquidity", 0),
                    scores.get("collateral", 0),
                    scores.get("security", 0),
                    scores.get("volatility_score", 0),
                    scores.get("governance", 0),
                    scores.get("audit", 0),
                    scores.get("seasoning_score", 0),
                    scores.get("effective_tvl", 0.0),
                    scores.get("weight_profile", {}).get("category", ""),
                    data_hash,
                    json.dumps(data_sources),
                    1 if scores.get("circuit_breaker_active") else 0,
                    scores.get("circuit_breaker_reason"),
                    1 if scores.get("bank_run_detected") else 0,
                    1 if scores.get("liquidity_spike_detected") else 0,
                    snapshot_time,
                    int(time.time()),
                    node_id,
                ),
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()


def record_attestation(
    asset_address: str,
    quorum_count: int,
    signers: List[str],
    message_hash: str,
    deployment_mode: str,
    node_latencies: List[float],
) -> int:
    """Persist a DON attestation event."""
    with _db_lock:
        conn = _ensure_db()
        try:
            cursor = conn.execute(
                """INSERT INTO attestation_log
                (asset_address, quorum_count, signers, message_hash,
                 deployment_mode, node_latencies, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    asset_address.lower(),
                    quorum_count,
                    json.dumps(signers),
                    message_hash,
                    deployment_mode,
                    json.dumps(node_latencies),
                    int(time.time()),
                ),
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()


def get_score_history(
    asset_address: str,
    limit: int = 50,
    since_timestamp: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Retrieve scoring history for an asset, newest first."""
    conn = _ensure_db()
    try:
        if since_timestamp:
            cursor = conn.execute(
                """SELECT * FROM score_history
                WHERE asset_address = ? AND snapshot_time >= ?
                ORDER BY snapshot_time DESC LIMIT ?""",
                (asset_address.lower(), since_timestamp, limit),
            )
        else:
            cursor = conn.execute(
                """SELECT * FROM score_history
                WHERE asset_address = ?
                ORDER BY snapshot_time DESC LIMIT ?""",
                (asset_address.lower(), limit),
            )
        columns = [desc[0] for desc in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_score_stats(asset_address: str) -> Dict[str, Any]:
    """Get aggregate statistics for an asset's score history."""
    conn = _ensure_db()
    try:
        cursor = conn.execute(
            """SELECT
                COUNT(*) as total_scores,
                AVG(overall) as avg_overall,
                MIN(overall) as min_overall,
                MAX(overall) as max_overall,
                MIN(snapshot_time) as first_scored_at,
                MAX(snapshot_time) as last_scored_at,
                SUM(circuit_breaker_active) as circuit_breaker_events,
                SUM(bank_run_detected) as bank_run_events
            FROM score_history
            WHERE asset_address = ?""",
            (asset_address.lower(),),
        )
        row = cursor.fetchone()
        if row and row[0] > 0:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return {"total_scores": 0}
    finally:
        conn.close()


def get_global_stats() -> Dict[str, Any]:
    """Get global scoring statistics across all assets."""
    conn = _ensure_db()
    try:
        cursor = conn.execute(
            """SELECT
                COUNT(*) as total_scores,
                COUNT(DISTINCT asset_address) as unique_assets,
                AVG(overall) as avg_overall,
                SUM(circuit_breaker_active) as total_circuit_breakers,
                SUM(bank_run_detected) as total_bank_runs,
                MIN(created_at) as first_event,
                MAX(created_at) as last_event
            FROM score_history"""
        )
        row = cursor.fetchone()
        columns = [desc[0] for desc in cursor.description]
        stats = dict(zip(columns, row))

        # Attestation stats
        cursor2 = conn.execute(
            "SELECT COUNT(*), AVG(quorum_count) FROM attestation_log"
        )
        att_row = cursor2.fetchone()
        stats["total_attestations"] = att_row[0] or 0
        stats["avg_quorum"] = round(att_row[1] or 0, 1)

        return stats
    finally:
        conn.close()
