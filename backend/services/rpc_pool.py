"""
CreditPulse AI — Resilient Multi-Tier RPC Pool Manager
Provides automated failover, latency routing, and health checks across Alchemy, QuickNode, Infura, Cloudflare, and Creditcoin CC3.
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple
from web3 import Web3

logger = logging.getLogger(__name__)

# Configurable multi-provider endpoint pool
DEFAULT_MAINNET_ENDPOINTS = [
    {"name": "Alchemy Dedicated (Config)", "url": os.getenv("ALCHEMY_ETH_RPC", ""), "priority": 1},
    {"name": "QuickNode Dedicated (Config)", "url": os.getenv("QUICKNODE_ETH_RPC", ""), "priority": 1},
    {"name": "Infura Dedicated (Config)", "url": os.getenv("INFURA_ETH_RPC", ""), "priority": 2},
    {"name": "Ethereum PublicNode", "url": "https://ethereum.publicnode.com", "priority": 3},
    {"name": "Ankr Multi-Region", "url": "https://rpc.ankr.com/eth", "priority": 3},
    {"name": "Cloudflare Decentralized", "url": "https://cloudflare-eth.com", "priority": 3},
    {"name": "1RPC Privacy Shield", "url": "https://1rpc.io/eth", "priority": 4},
]

DEFAULT_CREDITCOIN_ENDPOINTS = [
    {"name": "Creditcoin CC3 Testnet Primary", "url": "https://rpc.cc3-testnet.creditcoin.network", "priority": 1},
    {"name": "Creditcoin CC3 Testnet Backup", "url": "https://testnet-rpc.creditcoin.network", "priority": 2},
]

class ResilientRPCPool:
    """Manages high-availability Web3 providers with latency-aware dynamic routing."""

    _instances: Dict[str, "ResilientRPCPool"] = {}

    def __init__(self, chain: str = "ethereum", endpoints: Optional[List[Dict[str, Any]]] = None):
        self.chain = chain
        raw_endpoints = endpoints or (DEFAULT_CREDITCOIN_ENDPOINTS if "creditcoin" in chain.lower() else DEFAULT_MAINNET_ENDPOINTS)
        # Filter out unconfigured empty endpoints
        self.endpoints = [e for e in raw_endpoints if e.get("url")]
        self._health_cache: Dict[str, Dict[str, Any]] = {}
        self._last_probe = 0
        self._probe_ttl = 60 # Re-probe every 60s

    @classmethod
    def get_pool(cls, chain: str = "ethereum") -> "ResilientRPCPool":
        if chain not in cls._instances:
            cls._instances[chain] = cls(chain)
        return cls._instances[chain]

    def probe_all_endpoints(self) -> List[Dict[str, Any]]:
        """Probe all RPC endpoints and rank by latency and block height."""
        now = time.time()
        results = []
        for ep in self.endpoints:
            url = ep["url"]
            name = ep["name"]
            t0 = time.monotonic()
            try:
                w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 3}))
                block_number = w3.eth.block_number
                latency_ms = round((time.monotonic() - t0) * 1000, 1)
                is_healthy = block_number > 0
            except Exception as e:
                block_number = 0
                latency_ms = 9999.0
                is_healthy = False

            stats = {
                "name": name,
                "url": url,
                "priority": ep.get("priority", 3),
                "is_healthy": is_healthy,
                "block_number": block_number,
                "latency_ms": latency_ms,
                "last_probed": int(now)
            }
            self._health_cache[url] = stats
            results.append(stats)

        self._last_probe = now
        # Sort by: healthy first, then priority, then latency
        return sorted(results, key=lambda x: (not x["is_healthy"], x["priority"], x["latency_ms"]))

    def get_best_provider(self) -> Tuple[Web3, str]:
        """Return the fastest healthy Web3 instance with fallback."""
        now = time.time()
        if (now - self._last_probe) > self._probe_ttl or not self._health_cache:
            ranked = self.probe_all_endpoints()
        else:
            ranked = sorted(self._health_cache.values(), key=lambda x: (not x["is_healthy"], x["priority"], x["latency_ms"]))

        for ep in ranked:
            if ep["is_healthy"]:
                try:
                    w3 = Web3(Web3.HTTPProvider(ep["url"], request_kwargs={"timeout": 4}))
                    return w3, ep["url"]
                except Exception:
                    continue

        # Fallback if all probes failed: use first configured endpoint
        fallback_url = self.endpoints[0]["url"] if self.endpoints else "https://ethereum.publicnode.com"
        return Web3(Web3.HTTPProvider(fallback_url)), fallback_url
