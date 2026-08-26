"""
CreditPulse AI — Quantitative Risk, BLS Consensus & Cross-Chain Routes

Extracted from app.py monolith into a dedicated FastAPI APIRouter.
Contains: Monte Carlo, Stress Testing, BLS Aggregation, P2P Telemetry, Cross-Chain Relay.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from nodes.bls_quorum import BLSQuorumEngine
from cross_chain_relayer import CrossChainRelayer

router = APIRouter()


# ─── Request Models ────────────────────────────────────────────

class MonteCarloRequest(BaseModel):
    tvl_usd: float
    score: float
    iterations: Optional[int] = 10000
    time_horizon_days: Optional[int] = 30
    daily_volatility: Optional[float] = 0.04


class StressTestRequest(BaseModel):
    tvl_usd: float
    score: float
    scenario: Optional[str] = "black_thursday_2020"


class BLSAggregationRequest(BaseModel):
    message_hash: str
    signatures: List[Dict[str, Any]]


class CrossChainRelayRequest(BaseModel):
    target_chain_id: int
    asset_address: str
    score: int
    dynamic_ltv: int
    risk_tier: str
    data_hash: str
    cc3_tx_hash: str


# ─── Quantitative Risk Endpoints ──────────────────────────────

@router.post("/api/quant/monte-carlo", tags=['Quantitative Risk'])
def api_quant_monte_carlo(req: MonteCarloRequest):
    """
    Execute a 10,000-path Monte Carlo jump-diffusion simulation to calculate
    VaR (Value at Risk 95/99), CVaR (Expected Shortfall), and tail-risk insolvency probabilities.
    """
    from quant_risk import QuantRiskEngine
    return QuantRiskEngine.run_monte_carlo(
        tvl_usd=req.tvl_usd,
        score=req.score,
        iterations=req.iterations or 10000,
        time_horizon_days=req.time_horizon_days or 30,
        daily_volatility=req.daily_volatility or 0.04
    )


@router.post("/api/quant/stress-test", tags=['Quantitative Risk'])
def api_quant_stress_test(req: StressTestRequest):
    """
    Simulate historical financial crisis scenarios (Black Thursday 2020, Terra/LUNA 2022, SVB Depeg 2023).
    """
    from quant_risk import QuantRiskEngine
    return QuantRiskEngine.run_historical_stress_test(
        tvl_usd=req.tvl_usd,
        score=req.score,
        scenario_key=req.scenario or "black_thursday_2020"
    )


# ─── BLS12-381 Consensus Endpoints ────────────────────────────

@router.post("/api/don/bls-aggregate", tags=['DON Consensus'])
def api_don_bls_aggregate(req: BLSAggregationRequest):
    """
    Aggregate M-of-N validator signatures into a single compact BLS12-381 proof.
    """
    try:
        return BLSQuorumEngine.aggregate_signatures(
            message_hash=req.message_hash,
            node_signatures=req.signatures
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/don/p2p-telemetry", tags=['DON Consensus'])
def api_don_p2p_telemetry():
    """
    Retrieve live P2P mesh cluster topology with real latency measurements.
    Performs actual HTTP healthchecks against all validator node endpoints.
    """
    # Import DON coordinator at call time to avoid circular imports
    from nodes.don_coordinator import DONCoordinator
    don_coordinator = DONCoordinator()

    try:
        cluster_status = don_coordinator.get_cluster_status()
        live_latencies = {}
        for node in cluster_status.get("nodes", []):
            node_id = node.get("node_id", "")
            latency = node.get("latency_ms", -1.0)
            if node_id:
                live_latencies[node_id] = latency
    except Exception:
        live_latencies = None

    return BLSQuorumEngine.get_p2p_network_telemetry(live_latencies=live_latencies)


# ─── Cross-Chain Relay Endpoint ────────────────────────────────

@router.post("/api/cross-chain/relay", tags=['Cross-Chain'])
def api_cross_chain_relay(req: CrossChainRelayRequest):
    """
    ABI-encode a cross-chain credit score relay packet for EIP-5164 / LayerZero delivery.
    Returns encoded calldata ready for bridge contract submission.
    """
    return CrossChainRelayer.encode_cross_chain_payload(
        target_chain_id=req.target_chain_id,
        asset_address=req.asset_address,
        score=req.score,
        dynamic_ltv=req.dynamic_ltv,
        risk_tier=req.risk_tier,
        data_hash=req.data_hash,
        cc3_tx_hash=req.cc3_tx_hash
    )
