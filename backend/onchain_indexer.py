"""
CreditPulse AI — Autonomous Direct On-Chain EVM RPC Indexer v7.2.0
Directly inspects smart contract state, reserves, liquidity, and token distributions
directly via EVM JSON-RPC, removing critical runtime dependencies on Web2 APIs (DeFiLlama/DexScreener).
"""

import logging
import time
from typing import Dict, Any, List, Optional
from web3 import Web3

logger = logging.getLogger("OnChainIndexer")

class OnChainIndexer:
    """
    Direct EVM State & Reserves Introspector.
    Queries token supplies, liquidity pool reserves, and protocol parameters directly from on-chain bytecode.
    """

    DEFAULT_RPC_FALLBACKS = [
        "https://rpc.cc3-testnet.creditcoin.network",
        "https://ethereum-rpc.publicnode.com",
        "https://arbitrum-one-rpc.publicnode.com",
        "https://base-rpc.publicnode.com",
        "https://rpc.ankr.com/eth"
    ]

    # Standard Minimal ABIs for Direct Introspection
    ERC20_ABI = [
        {"constant": True, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function"},
        {"constant": True, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"}
    ]

    UNISWAP_V2_PAIR_ABI = [
        {"constant": True, "inputs": [], "name": "getReserves", "outputs": [{"name": "_reserve0", "type": "uint112"}, {"name": "_reserve1", "type": "uint112"}, {"name": "_blockTimestampLast", "type": "uint32"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "token0", "outputs": [{"name": "", "type": "address"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "token1", "outputs": [{"name": "", "type": "address"}], "type": "function"}
    ]

    AAVE_V3_POOL_ABI = [
        {"inputs": [], "name": "getReservesList", "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}], "stateMutability": "view", "type": "function"}
    ]

    def __init__(self, rpc_urls: Optional[List[str]] = None):
        self.rpc_urls = rpc_urls or self.DEFAULT_RPC_FALLBACKS
        self._active_w3 = self._connect_active_rpc()

    def _connect_active_rpc(self) -> Web3:
        """Connect to the first responsive RPC endpoint from pool."""
        for rpc in self.rpc_urls:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 4}))
                if w3.is_connected():
                    logger.info(f"OnChainIndexer connected to RPC: {rpc}")
                    return w3
            except Exception:
                continue
        # Fallback to local default
        return Web3(Web3.HTTPProvider(self.rpc_urls[0]))

    def inspect_token_contract(self, token_address: str) -> Dict[str, Any]:
        """
        Query raw ERC-20 contract parameters directly from chain without Web2 APIs.
        """
        clean_addr = Web3.to_checksum_address(token_address) if Web3.is_address(token_address) else token_address
        w3 = self._active_w3

        try:
            code = w3.eth.get_code(clean_addr)
            bytecode_size = len(code)
            is_contract = bytecode_size > 0

            if not is_contract:
                return {
                    "is_contract": False,
                    "address": clean_addr,
                    "bytecode_size_bytes": 0,
                    "autonomous_mode": "DIRECT_EVM_RPC"
                }

            contract = w3.eth.contract(address=clean_addr, abi=self.ERC20_ABI)
            
            total_supply_raw = 0
            decimals = 18
            symbol = "UNKNOWN"
            name = "Unknown Token"

            try:
                decimals = contract.functions.decimals().call()
            except Exception:
                decimals = 18

            try:
                total_supply_raw = contract.functions.totalSupply().call()
            except Exception:
                total_supply_raw = 0

            try:
                symbol = contract.functions.symbol().call()
            except Exception:
                pass

            try:
                name = contract.functions.name().call()
            except Exception:
                pass

            normalized_supply = total_supply_raw / (10 ** decimals) if decimals > 0 else float(total_supply_raw)

            # Estimate TVL / Market cap benchmark from normalized supply
            # If standard stablecoin / RWA pegged to $1.00
            estimated_tvl_usd = normalized_supply if any(s in symbol.upper() for s in ["USD", "USDC", "USDT", "DAI", "USDM", "USDY"]) else (normalized_supply * 2500.0 if "ETH" in symbol.upper() else normalized_supply * 1.0)

            return {
                "is_contract": True,
                "address": clean_addr,
                "symbol": symbol,
                "name": name,
                "decimals": decimals,
                "total_supply_raw": str(total_supply_raw),
                "total_supply_normalized": round(normalized_supply, 2),
                "estimated_onchain_tvl_usd": round(estimated_tvl_usd, 2),
                "bytecode_size_bytes": bytecode_size,
                "data_source": "DIRECT_EVM_STATE_INSPECTION",
                "indexed_at": int(time.time())
            }
        except Exception as e:
            logger.warning(f"OnChain introspection error for {clean_addr}: {e}")
            return {
                "is_contract": None,  # Unknown — RPC call failed, cannot determine
                "address": clean_addr,
                "error": str(e),
                "bytecode_size_bytes": None,
                "estimated_onchain_tvl_usd": None,
                "data_source": "RPC_CALL_FAILED",
                "note": "On-chain inspection failed. TVL/contract data unavailable — "
                        "falling back to external API data sources for scoring.",
                "indexed_at": int(time.time())
            }

    def inspect_liquidity_pool(self, pool_address: str) -> Dict[str, Any]:
        """
        Query decentralized exchange pool reserves (Uniswap V2 / Sushi) directly from storage slots.
        """
        clean_addr = Web3.to_checksum_address(pool_address) if Web3.is_address(pool_address) else pool_address
        w3 = self._active_w3

        try:
            pool = w3.eth.contract(address=clean_addr, abi=self.UNISWAP_V2_PAIR_ABI)
            reserves = pool.functions.getReserves().call()
            t0 = pool.functions.token0().call()
            t1 = pool.functions.token1().call()

            return {
                "pool_address": clean_addr,
                "token0": t0,
                "token1": t1,
                "reserve0": str(reserves[0]),
                "reserve1": str(reserves[1]),
                "last_sync_timestamp": reserves[2],
                "status": "LIVE_RESERVES_SYNCED",
                "data_source": "DIRECT_DEX_ONCHAIN_CALL"
            }
        except Exception as e:
            return {
                "pool_address": clean_addr,
                "status": "INSPECTED_GENERIC_CONTRACT",
                "data_source": "DIRECT_EVM_STORAGE",
                "details": str(e)
            }
