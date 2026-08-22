import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from .oracle_node import OracleNodeRunner
from dotenv import load_dotenv
import time

from risk_engine import (
    get_protocols_cached,
    find_protocol,
    inspect_onchain_contract,
    compute_scores,
    compute_canonical_data_hash,
    get_multi_source_asset_data
)

from zktls.verifier import ZkTLSEngine

# Load from the specific env file passed via environment variable (e.g. ENV_FILE=.env.node1)
env_file = os.getenv("ENV_FILE", ".env")
load_dotenv(env_file, override=True)

app = FastAPI(title=f"CreditPulse Oracle Node - {os.getenv('NODE_NAME', 'unknown')}")

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
async def sign_attestation(req: AttestationRequest):
    try:
        # INDEPENDENT MULTI-SOURCE VERIFICATION
        now_snapshot = req.snapshot_time if req.snapshot_time else int(time.time())
        asset_info = get_multi_source_asset_data(req.asset_address, now_snapshot)
        
        computed_scores = asset_info["scores"]
        computed_data_hash = asset_info["data_hash"]
        
        # We only verify keys that are actually numeric scores
        score_keys_to_verify = ["overall", "liquidity", "collateral", "security", "volatility_score", "governance", "audit"]
        for key in score_keys_to_verify:
            if key in req.scores:
                if computed_scores.get(key) != req.scores[key]:
                    raise ValueError(f"Score mismatch for {key}: node computed {computed_scores.get(key)}, gateway requested {req.scores[key]}")
                    
        if computed_data_hash != req.data_hash:
            raise ValueError(f"Data hash mismatch: node computed {computed_data_hash}, gateway requested {req.data_hash}")
        
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

@app.post("/sign_zktls_attestation")
async def sign_zktls_attestation(req: ZkTLSRARequest):
    try:
        # INDEPENDENT ZKTLS VERIFICATION
        # The node independently runs the zkTLS cryptographic simulator (which normally would be verifying a TLSNotary transcript)
        computed_attestation = ZkTLSEngine.generate_bank_por_attestation(
            asset_address=req.asset_address,
            token_supply_usd=req.token_supply_usd,
            reserve_balance_usd=req.reserve_balance_usd,
            custodian_name=req.custodian_name,
            spv_cik=req.spv_cik,
            account_id_masked=req.account_id_masked,
            snapshot_time=req.snapshot_time
        )
        
        computed_proof_hash = computed_attestation["zk_tls_proof_hash"]
        computed_session = computed_attestation["session_commitment"]
        
        if computed_proof_hash != req.zk_tls_proof_hash:
            raise ValueError(f"zkTLS Proof Hash mismatch: node computed {computed_proof_hash}, gateway requested {req.zk_tls_proof_hash}")
            
        if computed_session != req.session_commitment:
            raise ValueError(f"zkTLS Session Commitment mismatch: node computed {computed_session}, gateway requested {req.session_commitment}")
            
        # Validation passed, sign the zkTLS payload
        attestation = runner.sign_zktls_attestation(
            asset_address=req.asset_address,
            zk_tls_proof_hash=computed_proof_hash
        )
        
        # Include the computed fields in the response for transparency
        return {
            "signature_payload": attestation,
            "verification_details": computed_attestation
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Independent zkTLS validation failed: {str(e)}")

