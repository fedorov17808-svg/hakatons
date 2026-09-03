"""
CreditPulse AI — Gemini Narrative Service v8.0.0

Extracted from app.py — generates institutional AI risk advisory
using Gemini Flash Lite via direct REST (no SDK dependency).
"""

from __future__ import annotations

import json
import logging
import os
import urllib.request
from typing import List, Optional, Tuple

from web3 import Web3

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent"


def generate_risk_narrative(
    protocol_name: str,
    overall: int,
    tvl: float,
    category: str,
    change_1d: float,
    change_7d: float,
    chains_count: int,
    audits: str,
    verdict: str,
) -> Tuple[Optional[str], Optional[str], List[str], str]:
    """Generate institutional qualitative AI risk advisory via Gemini.
    
    The AI narrative is purely qualitative — it does NOT affect the
    deterministic credit score. The score is computed independently
    by the risk engine.
    
    Returns: (narrative_text, error_msg, risks_list, ai_digest_hex)
    """
    if not GEMINI_API_KEY:
        return None, "GEMINI_API_KEY_MISSING", [], "0x" + "0" * 64

    try:
        tvl_b = tvl / 1e9 if tvl > 1e9 else tvl / 1e6
        tvl_unit = "B" if tvl > 1e9 else "M"
        audited_str = (
            "Verified Multi-Audit"
            if str(audits) not in ["0", "2", "", "None", "False"]
            else "Single/Unverified Audit"
        )
        is_rwa = any(
            r in category.lower()
            for r in ["rwa", "treasuries", "private credit", "real world assets"]
        )
        asset_context = (
            "Real-World Asset (RWA) / Tokenized Security"
            if is_rwa
            else "DeFi Protocol"
        )

        prompt = (
            f"You are a senior institutional credit risk officer analyzing a {asset_context}.\n"
            f"Provide qualitative risk factors not captured solely by mechanical TVL.\n\n"
            f"Asset/Protocol: {protocol_name}\n"
            f"Category: {category}\n"
            f"TVL / AUM: ${tvl_b:.2f}{tvl_unit}\n"
            f"24h Flow: {change_1d:+.2f}%\n"
            f"7d Flow: {change_7d:+.2f}%\n"
            f"Multi-Chain Deployment: {chains_count} chains\n"
            f"Audit Security Track: {audited_str}\n"
            f"Deterministic Credit Score: {overall}/100 ({verdict})\n\n"
            f"Return ONLY valid JSON matching this schema:\n"
            f"{{\n"
            f'  "risks": [\n'
            f'    "[HIGH/MED/LOW] Specific risk vector 1 (e.g. Smart Contract, Custody, Governance, Liquidity)",\n'
            f'    "[HIGH/MED/LOW] Specific risk vector 2",\n'
            f'    "[HIGH/MED/LOW] Specific risk vector 3"\n'
            f"  ],\n"
            f'  "narrative": "Concise 2-sentence institutional credit risk evaluation summary (max 65 words)."\n'
            f"}}"
        )

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "maxOutputTokens": 600,
                "temperature": 0.2,
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{_GEMINI_URL}?key={GEMINI_API_KEY}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        parts = result["candidates"][0]["content"]["parts"]
        text = " ".join(p["text"] for p in parts if "text" in p).strip()

        ai_json = json.loads(text)
        risks_list = [
            str(r).strip() for r in ai_json.get("risks", []) if str(r).strip()
        ]
        narrative = str(ai_json.get("narrative", "")).strip()

        ai_digest = (
            "0x" + Web3.keccak(text=narrative).hex()
            if narrative
            else "0x" + "0" * 64
        )
        return narrative, None, risks_list, ai_digest

    except Exception as e:
        logger.warning(f"Gemini narrative generation error: {e}")
        return None, str(e), [], "0x" + "0" * 64
