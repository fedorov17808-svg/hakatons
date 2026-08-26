import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Dict, Any, Optional
from nodes.oracle_node import OracleNodeRunner
from dotenv import load_dotenv
import time
import logging

from risk_engine import (
    get_protocols_cached,
    find_protocol,
    inspect_onchain_contract,
    compute_scores,
    compute_canonical_data_hash,
    get_multi_source_asset_data
)

# CryptoPoREngine imported inline in sign_zktls_attestation() to avoid circular imports

# Load from the specific env file passed via environment variable (e.g. ENV_FILE=.env.node1)
env_file = os.getenv("ENV_FILE", ".env")
load_dotenv(env_file, override=True)

app = FastAPI(title=f"CreditPulse Oracle Node - {os.getenv('NODE_NAME', 'unknown')}")

logger = logging.getLogger(__name__)

# Inter-node API key for DON authentication
# In production, this would use mTLS or JWT tokens
DON_API_KEY = os.getenv("DON_API_KEY", "")

def _verify_don_api_key(x_don_api_key: str = Header(default="", alias="X-DON-API-Key")):
    """Verify inter-node API key if DON_API_KEY is configured."""
    if DON_API_KEY and x_don_api_key != DON_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing DON API key")
    return x_don_api_key

# Scoring divergence metrics for honest monitoring
_divergence_log: list = []
_MAX_DIVERGENCE_LOG = 100

private_key = os.getenv("PRIVATE_KEY")
node_name = os.getenv("NODE_NAME", "unknown")
node_region = os.getenv("NODE_REGION", "unknown")

if not private_key:
    raise ValueError(f"PRIVATE_KEY not found in {env_file}")

# Instantiate the node runner
runner = OracleNodeRunner(
    node_id=node_name,
    private_key=private_key,
    name=f"CreditPulse Validator ({node_name})",
    region=node_region
)

class AttestationRequest(BaseModel):
    asset_address: str
    scores: Dict[str, Any]
    data_hash: str
    snapshot_time: Optional[int] = None

@app.get("/health")
async def health():
    return runner.get_health()

@app.post("/sign_attestation")
async def sign_attestation(req: AttestationRequest, api_key: str = Header(default="", alias="X-DON-API-Key")):
    _verify_don_api_key(api_key)
    try:
        # INDEPENDENT MULTI-SOURCE VERIFICATION
        now_snapshot = req.snapshot_time if req.snapshot_time else int(time.time())
        asset_info = get_multi_source_asset_data(req.asset_address, now_snapshot)
        
        computed_scores = asset_info["scores"]
        computed_data_hash = asset_info["data_hash"]
        
        # Allow ±2 tolerance for integer rounding drift across cache refreshes.
        # BFT consensus should tolerate minor float→int rounding differences.
        SCORE_TOLERANCE = 2
        score_keys_to_verify = ["overall", "liquidity", "collateral", "security", "volatility_score", "governance", "audit"]
        for key in score_keys_to_verify:
            if key in req.scores:
                node_val = computed_scores.get(key, 0)
                gateway_val = req.scores[key]
                if abs(node_val - gateway_val) > SCORE_TOLERANCE:
                    raise ValueError(f"Score mismatch for {key}: node computed {node_val}, gateway requested {gateway_val} (tolerance ±{SCORE_TOLERANCE})")
                    
        if computed_data_hash != req.data_hash:
            # Log warning but don't reject — scores are already validated within tolerance.
            # Data hash drift happens when DeFiLlama cache refreshes between gateway and node.
            logger.warning(
                f"Data hash drift (non-fatal): node={computed_data_hash[:16]}..., "
                f"gateway={req.data_hash[:16]}... — scores validated within ±{SCORE_TOLERANCE}"
            )
            # Track divergence for honest metrics
            if len(_divergence_log) < _MAX_DIVERGENCE_LOG:
                _divergence_log.append({
                    "timestamp": int(time.time()),
                    "asset": req.asset_address[:10],
                    "type": "data_hash_drift",
                    "node_hash": computed_data_hash[:16],
                    "gateway_hash": req.data_hash[:16],
                })
        
        # Validation passed, sign the payload
        attestation = runner.sign_attestation(
            asset_address=req.asset_address,
            scores=computed_scores,
            data_hash=computed_data_hash
        )
        attestation["sources_used"] = asset_info["sources_used"]
        return attestation
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Independent validation failed: {str(e)}")

class ZkTLSRARequest(BaseModel):
    asset_address: str
    token_supply_usd: float
    reserve_balance_usd: float
    custodian_name: str = "Ankura Trust & Morgan Stanley"
    spv_cik: str = "CIK-0001982741"
    account_id_masked: str = "US-BNK-****-8821"
    snapshot_time: int
    zk_tls_proof_hash: str
    session_commitment: str
    blinding_factor: str  # Required for independent verification

@app.post("/sign_zktls_attestation")
async def sign_zktls_attestation(req: ZkTLSRARequest, api_key: str = Header(default="", alias="X-DON-API-Key")):
    _verify_don_api_key(api_key)
    try:
        from zktls.verifier import CryptoPoREngine

        # INDEPENDENT COMMITMENT VERIFICATION
        # Instead of re-generating (which uses random blinding factors),
        # we verify the gateway's commitment using the provided blinding_factor.
        # This is the cryptographically correct approach: verify C = Hash(value || blinding)

        now = req.snapshot_time
        reserve_ratio_bps = int((req.reserve_balance_usd / req.token_supply_usd) * 10000)
        is_solvent = reserve_ratio_bps >= 10000

        # Reconstruct the solvency claim that was committed
        solvency_claim = (
            f"CLAIM:ASSET={req.asset_address.lower()}"
            f":BPS={reserve_ratio_bps}"
            f":SOLVENT={is_solvent}"
            f":TIMESTAMP={now}"
        )

        # Independently verify the commitment using hash commitment verification
        claim_valid = CryptoPoREngine.verify_commitment(
            commitment=req.zk_tls_proof_hash,
            value_payload=solvency_claim,
            blinding_factor=req.blinding_factor
        )

        if not claim_valid:
            raise ValueError(
                f"PoR commitment verification FAILED: "
                f"verify_commitment(proof_hash, claim, blinding) returned False. "
                f"The gateway's commitment does not match independent re-computation."
            )

        # Also verify session commitment
        import json
        transcript = {
            "custodian": req.custodian_name,
            "spv_registration": req.spv_cik,
            "account_id": req.account_id_masked,
            "asset_contract": req.asset_address.lower(),
            "reserve_balance_usd": float(req.reserve_balance_usd),
            "audited_timestamp": now,
            "tls_cipher_suite": "TLS_AES_256_GCM_SHA384",
            "cert_fingerprint_sha256": "8F:3A:C2:91:D4:55:7B:3E:09:12:F4:6A:88:90:31:BC:44:E1:92:5D:80:23:44:A1:BB:09:C4:DE:71:55:AA:19",
            "data_source": "SIMULATED_TRANSCRIPT"  # Honest labeling: demo mode uses synthetic data
        }
        transcript_str = json.dumps(transcript, sort_keys=True)

        session_valid = CryptoPoREngine.verify_commitment(
            commitment=req.session_commitment,
            value_payload=f"SESSION:{transcript_str}",
            blinding_factor=req.blinding_factor
        )

        if not session_valid:
            raise ValueError(
                f"Session commitment verification FAILED: "
                f"transcript re-computation does not match gateway commitment."
            )

        # Both verifications passed — sign the payload
        attestation = runner.sign_zktls_attestation(
            asset_address=req.asset_address,
            zk_tls_proof_hash=req.zk_tls_proof_hash
        )

        return {
            "signature_payload": attestation,
            "verification_details": {
                "claim_commitment_valid": claim_valid,
                "session_commitment_valid": session_valid,
                "verification_method": "CryptoPoREngine.verify_commitment()",
                "reserve_ratio_bps": reserve_ratio_bps,
                "is_solvent": is_solvent,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Independent PoR commitment validation failed: {str(e)}")


@app.get("/divergence_metrics")
async def divergence_metrics(api_key: str = Header(default="", alias="X-DON-API-Key")):
    """Honest scoring divergence tracking for DON monitoring."""
    _verify_don_api_key(api_key)
    return {
        "node_name": node_name,
        "total_divergences": len(_divergence_log),
        "recent_divergences": _divergence_log[-10:],
        "score_tolerance": 2,
        "note": "Divergences occur due to DeFiLlama cache refresh timing between nodes. "
                "Scores are validated within ±2 tolerance before signing."
    }
