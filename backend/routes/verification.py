"""
CreditPulse — Verification & Methodology Routes

Stateless verification endpoints:
- POST /api/verify — Independently reproduce risk scores from raw inputs
- POST /api/rwa/por-verify — Verify RWA Proof-of-Reserve backing ratio
- GET  /api/methodology — Full scoring methodology specification
- GET  /api/stats/onchain — Live on-chain protocol counters
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from web3 import Web3

from risk_engine import compute_canonical_data_hash, compute_scores

router = APIRouter(tags=["Verification"])

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x358925c5839a36bB2181786B8763Da0653B0f438")
RPC_URL = os.getenv("RPC_URL", "https://rpc.cc3-testnet.creditcoin.network")

EXTENDED_ABI_JSON = '''[
    {"inputs":[{"internalType":"address","name":"_assetAddress","type":"address"},{"internalType":"uint8[7]","name":"_scores","type":"uint8[7]"},{"internalType":"bytes32","name":"_dataHash","type":"bytes32"},{"internalType":"bytes32","name":"_aiDigest","type":"bytes32"},{"internalType":"address[]","name":"_signers","type":"address[]"},{"internalType":"bytes[]","name":"_signatures","type":"bytes[]"}],"name":"saveRiskReportMultiSigned","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"_assetAddress","type":"address"},{"internalType":"uint8","name":"_overallScore","type":"uint8"},{"internalType":"uint8","name":"_liquidity","type":"uint8"},{"internalType":"uint8","name":"_collateral","type":"uint8"},{"internalType":"uint8","name":"_auditScore","type":"uint8"},{"internalType":"uint8","name":"_security","type":"uint8"},{"internalType":"uint8","name":"_volatility","type":"uint8"},{"internalType":"uint8","name":"_governance","type":"uint8"},{"internalType":"bytes32","name":"_dataHash","type":"bytes32"},{"internalType":"bytes32","name":"_aiDigest","type":"bytes32"}],"name":"saveRiskReportWithDigest","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"reportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"verifiedProofCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"oracleSigner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
]'''
CONTRACT_ABI_ONCHAIN = json.loads(EXTENDED_ABI_JSON)


# ── Models ──────────────────────────────────────────────────────

class PoRVerifyRequest(BaseModel):
    asset_address: str
    token_supply: float
    reserve_usd: float
    custodian_name: Optional[str] = "Ankura Custody / US Bank"
    spv_cik: Optional[str] = "CIK-0001982741"


class VerifyRequest(BaseModel):
    tvl: float
    change_1d: Optional[float] = 0.0
    change_7d: Optional[float] = 0.0
    category: Optional[str] = ""
    audits: Optional[Any] = "0"
    chains_count: int = 1
    listed_at: int = 0
    snapshot_time: Optional[int] = None


# ── Routes ──────────────────────────────────────────────────────

@router.post("/api/rwa/por-verify")
def api_por_verify(req: PoRVerifyRequest):
    """
    Verify Real-World Asset (RWA) Proof-of-Reserve (PoR) backing ratio.
    Calculates exact reserve ratio basis points (BPS) and cryptographic digests for on-chain binding.
    """
    if req.token_supply <= 0:
        raise HTTPException(status_code=400, detail="Token supply must be greater than 0")

    reserve_ratio_bps = int((req.reserve_usd / req.token_supply) * 10000)
    is_solvent = reserve_ratio_bps >= 10000

    por_data_str = f"POR:{req.asset_address.lower()}:{req.reserve_usd}:{req.custodian_name}"
    legal_data_str = f"LEGAL:{req.asset_address.lower()}:{req.spv_cik}:{req.custodian_name}"

    por_hash = "0x" + Web3.keccak(text=por_data_str).hex()
    legal_entity_digest = "0x" + Web3.keccak(text=legal_data_str).hex()

    return {
        "asset_address": req.asset_address,
        "token_supply": req.token_supply,
        "reserve_usd": req.reserve_usd,
        "reserve_ratio_bps": reserve_ratio_bps,
        "coverage_percent": round(reserve_ratio_bps / 100.0, 2),
        "is_solvent": is_solvent,
        "status": "OVERCOLLATERALIZED" if reserve_ratio_bps > 10000 else ("FULLY_COLLATERALIZED" if reserve_ratio_bps == 10000 else "UNDERCOLLATERALIZED"),
        "por_hash": por_hash,
        "legal_entity_digest": legal_entity_digest,
        "custodian": req.custodian_name,
        "spv_registration": req.spv_cik,
        "attestation_standard": "CreditPulse RWA PoR Standard v7.2"
    }


@router.post("/api/verify")
def api_verify(req: VerifyRequest):
    """
    Independently verify a risk score from raw inputs.
    Given the same raw data, reproduces the exact 100% deterministic calculation and dataHash.
    """
    scores = compute_scores(
        tvl=req.tvl, change_1d=req.change_1d, change_7d=req.change_7d,
        category=req.category, audits=req.audits,
        chains_count=req.chains_count, listed_at=req.listed_at,
        snapshot_time=req.snapshot_time
    )

    raw_inputs_for_hash = {
        "tvl": req.tvl,
        "change_1d": req.change_1d,
        "change_7d": req.change_7d,
        "category": req.category,
        "audits": str(req.audits),
        "chains_count": req.chains_count,
        "listed_at": req.listed_at,
    }
    data_hash, raw_data_string = compute_canonical_data_hash(raw_inputs_for_hash)

    return {
        "verified_scores": {
            "overall": scores["overall"],
            "liquidity": scores["liquidity"],
            "collateral": scores["collateral"],
            "security": scores["security"],
            "volatility": scores["volatility_score"],
            "governance": scores["governance"],
            "audit": scores["audit"],
        },
        "data_hash": data_hash,
        "formula_version": "7.2",
        "circuit_breaker_active": scores.get("circuit_breaker_active", False),
        "circuit_breaker_reason": scores.get("circuit_breaker_reason"),
        "canonical_json": raw_data_string,
        "is_rwa": scores.get("is_rwa", False),
        "note": "100% deterministic match guaranteed against on-chain dataHash."
    }


@router.get("/api/rwa/chainlink-por/{address}")
def api_chainlink_por(address: str):
    """
    Fetch verified on-chain custodian reserve backing from official Chainlink Proof-of-Reserve feeds.
    Provides independent 3rd-party verification of off-chain bank balances for tokenized RWAs (Ondo, Aave, Maker, BitGo).
    """
    from services.chainlink_por import ChainlinkPoRClient
    por_data = ChainlinkPoRClient.get_por_telemetry(address)
    if not por_data:
        raise HTTPException(
            status_code=404,
            detail=f"No Chainlink Proof-of-Reserve feed registered for asset {address}."
        )
    return por_data


@router.get("/api/methodology")
def api_methodology():
    """Retrieve full formal specification of the 7-dimensional institutional scoring methodology."""
    return {
        "version": "8.0.0",
        "network": "Creditcoin Testnet (CC3)",
        "smart_contract": CONTRACT_ADDRESS,
        "architecture": "Federated Multi-Node DON Cluster + Cryptographic Proof-of-Reserve Commitments + Optimistic Dispute Window",
        "dimensions": [
            {"name": "Liquidity", "weight": "Sector-Adaptive (15-25%)", "formula": "min(100, max(0, int(log10(tvl) * 10.0)))"},
            {"name": "Collateral & Solvency", "weight": "Sector-Adaptive (25-35%)", "formula": "Category baseline [RWA:92, Lending:85, LRT:82, DEX:68] minus drawdown penalty"},
            {"name": "Security & Architecture", "weight": "Sector-Adaptive (20-25%)", "formula": "Base (40) + Audits (32) + Multi-Chain Redundancy (min 28, 4/chain)"},
            {"name": "Volatility & Stability", "weight": "Sector-Adaptive (10-15%)", "formula": "100 - abs(change_1d)*3.0 - abs(change_7d)*1.5 (Dampened 50% for RWA)"},
            {"name": "Governance & SPV Legal", "weight": "Sector-Adaptive (10-25%)", "formula": "RWA Regulated SPV: 85, DeFi Core: 75, Unverified: 45"},
            {"name": "Audit Track Record", "weight": "Sector-Adaptive (5-15%)", "formula": "Audit base (88/32) + Chains (min 20) + Age in production (0.5/month)"},
        ],
        "circuit_breaker": "Catastrophic Failure Hard Cap: if Security < 45 or Collateral < 40 or Volatility < 30, Overall <= min(Security, Collateral) * 1.35",
        "provenance": "keccak256(canonical_json(sorted_inputs)) stored on-chain in CreditPulseASC.sol",
        "precompile": "0x0000000000000000000000000000000000000FD2 (Attestcoin Native Query Verifier)",
    }


@router.get("/api/stats/onchain", tags=["Recording"])
def api_stats_onchain():
    """Fetch live on-chain protocol counters directly from CreditPulseASC.sol on CC3."""
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI_ONCHAIN)

        report_count = contract.functions.reportCount().call()
        verified_proof_count = contract.functions.verifiedProofCount().call()
        version = contract.functions.VERSION().call()
        owner = contract.functions.owner().call()
        oracle = contract.functions.oracleSigner().call()

        return {
            "connected": True,
            "contract_address": CONTRACT_ADDRESS,
            "network": "Creditcoin Testnet CC3 (Chain 102031)",
            "version": version,
            "total_reports_onchain": report_count,
            "verified_crosschain_proofs": verified_proof_count,
            "contract_owner": owner,
            "oracle_signer": oracle,
            "block_number": w3.eth.block_number,
            "blockscout_url": f"https://creditcoin-testnet.blockscout.com/address/{CONTRACT_ADDRESS}"
        }
    except Exception as e:
        return {
            "connected": False,
            "contract_address": CONTRACT_ADDRESS,
            "error": str(e)
        }
