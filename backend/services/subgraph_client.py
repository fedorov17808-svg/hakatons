"""
CreditPulse AI — Direct Decentralized Protocol Subgraph Client
Directly queries Uniswap V3 and Aave V3 GraphQL Subgraphs to eliminate reliance on centralized third-party aggregators.
"""

import json
import logging
import os
import requests
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Decentralized The Graph decentralized gateway & public endpoints
UNISWAP_V3_SUBGRAPH_URL = os.getenv(
    "UNISWAP_V3_SUBGRAPH_URL",
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
)

AAVE_V3_SUBGRAPH_URL = os.getenv(
    "AAVE_V3_SUBGRAPH_URL",
    "https://api.thegraph.com/subgraphs/name/aave/protocol-v3"
)

SUBGRAPH_TIMEOUT = 5

_SUBGRAPH_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL = 180  # 3 minutes

class SubgraphClient:
    """Institutional-grade direct Subgraph client for on-chain liquidity & reserve telemetry."""

    @classmethod
    def query_uniswap_v3_pool(cls, token_address: str) -> Optional[Dict[str, Any]]:
        """
        Query Uniswap V3 subgraph for top liquidity pools, total value locked (USD),
        24h volume, and fee tier for a given token address.
        """
        now = time.time()
        token_lower = token_address.lower()
        cache_key = f"uni_v3_{token_lower}"

        if cache_key in _SUBGRAPH_CACHE:
            ts, data = _SUBGRAPH_CACHE[cache_key]
            if now - ts < _CACHE_TTL:
                return data

        query = """
        query GetTokenPools($tokenAddr: String!) {
          token(id: $tokenAddr) {
            symbol
            name
            decimals
            totalValueLockedUSD
            volumeUSD
            whitelistPools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
              id
              feeTier
              totalValueLockedUSD
              volumeUSD
              token0 { symbol id }
              token1 { symbol id }
            }
          }
        }
        """
        try:
            resp = requests.post(
                UNISWAP_V3_SUBGRAPH_URL,
                json={"query": query, "variables": {"tokenAddr": token_lower}},
                headers={"Content-Type": "application/json", "User-Agent": "CreditPulse-Oracle/8.0"},
                timeout=SUBGRAPH_TIMEOUT
            )
            if resp.status_code == 200:
                result = resp.json()
                token_data = (result.get("data") or {}).get("token")
                if token_data:
                    tvl_usd = float(token_data.get("totalValueLockedUSD") or 0.0)
                    vol_usd = float(token_data.get("volumeUSD") or 0.0)
                    pools = token_data.get("whitelistPools") or []
                    parsed = {
                        "protocol": "Uniswap V3 (Subgraph Direct)",
                        "symbol": token_data.get("symbol"),
                        "tvl_usd": round(tvl_usd, 2),
                        "volume_usd": round(vol_usd, 2),
                        "pools_count": len(pools),
                        "top_pool_id": pools[0].get("id") if pools else None,
                        "source": "The Graph (Decentralized Subgraph)"
                    }
                    _SUBGRAPH_CACHE[cache_key] = (now, parsed)
                    return parsed
        except Exception as e:
            logger.debug(f"Uniswap V3 Subgraph query error for {token_address}: {e}")
        return None

    @classmethod
    def query_aave_v3_reserves(cls, underlying_address: str) -> Optional[Dict[str, Any]]:
        """
        Query Aave V3 subgraph for reserve liquidity, utilization rate, supply/borrow rates,
        and liquidation threshold for a collateral asset.
        """
        now = time.time()
        token_lower = underlying_address.lower()
        cache_key = f"aave_v3_{token_lower}"

        if cache_key in _SUBGRAPH_CACHE:
            ts, data = _SUBGRAPH_CACHE[cache_key]
            if now - ts < _CACHE_TTL:
                return data

        query = """
        query GetReserve($underlyingAsset: String!) {
          reserves(where: { underlyingAsset: $underlyingAsset }, first: 1) {
            symbol
            name
            decimals
            liquidityRate
            variableBorrowRate
            totalLiquidity
            totalATokenSupply
            totalCurrentVariableDebt
            baseLTVasCollateral
            reserveLiquidationThreshold
            reserveLiquidationBonus
            usageAsCollateralEnabled
            isFrozen
          }
        }
        """
        try:
            resp = requests.post(
                AAVE_V3_SUBGRAPH_URL,
                json={"query": query, "variables": {"underlyingAsset": token_lower}},
                headers={"Content-Type": "application/json", "User-Agent": "CreditPulse-Oracle/8.0"},
                timeout=SUBGRAPH_TIMEOUT
            )
            if resp.status_code == 200:
                result = resp.json()
                reserves = (result.get("data") or {}).get("reserves") or []
                if reserves:
                    r = reserves[0]
                    total_supply = float(r.get("totalATokenSupply") or 0)
                    total_debt = float(r.get("totalCurrentVariableDebt") or 0)
                    utilization = (total_debt / total_supply * 100.0) if total_supply > 0 else 0.0
                    parsed = {
                        "protocol": "Aave V3 (Subgraph Direct)",
                        "symbol": r.get("symbol"),
                        "ltv_pct": float(r.get("baseLTVasCollateral") or 0) / 100.0,
                        "liquidation_threshold_pct": float(r.get("reserveLiquidationThreshold") or 0) / 100.0,
                        "utilization_rate_pct": round(utilization, 2),
                        "collateral_enabled": bool(r.get("usageAsCollateralEnabled")),
                        "is_frozen": bool(r.get("isFrozen")),
                        "source": "The Graph (Aave V3 Subgraph)"
                    }
                    _SUBGRAPH_CACHE[cache_key] = (now, parsed)
                    return parsed
        except Exception as e:
            logger.debug(f"Aave V3 Subgraph query error for {underlying_address}: {e}")
        return None
