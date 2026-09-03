import { ethers } from "ethers";
import { getLiveEthPrice, getLiveBtcPrice } from "./priceOracle";

const ETH_RPCS = [
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com",
  "https://rpc.ankr.com/eth"
];

import { CC3_RPC } from "@/lib/config";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export interface OnChainTelemetryResult {
  is_contract: boolean;
  bytecode_size: number;
  transaction_count: number;
  native_balance_eth: number;
  native_balance_usd: number;
  cc3_native_balance: number;
  token_balances: Array<{ symbol: string; balance: number; usd_value: number }>;
  total_portfolio_usd: number;
  admin_type: string;
  rpc_used: string;
  live_eth_price_usd: number;
  live_btc_price_usd: number;
  price_source: string;
}

export async function inspectOnchainWallet(targetAddress: string): Promise<OnChainTelemetryResult> {
  const checksumAddr = ethers.getAddress(targetAddress);
  
  // Fetch live market prices in parallel
  const [
    { price: ethPrice, source: ethPriceSource },
    { price: btcPrice }
  ] = await Promise.all([
    getLiveEthPrice(),
    getLiveBtcPrice()
  ]);

  const topTokens = [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, usdPrice: 1.0 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, usdPrice: 1.0 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, usdPrice: 1.0 },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, usdPrice: btcPrice }
  ];

  let provider: ethers.JsonRpcProvider | null = null;
  let rpcUsed = ETH_RPCS[0];

  for (const rpc of ETH_RPCS) {
    try {
      provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
      await provider.getBlockNumber();
      rpcUsed = rpc;
      break;
    } catch {
      provider = null;
    }
  }

  if (!provider) {
    provider = new ethers.JsonRpcProvider(ETH_RPCS[0]);
  }

  let nativeBalEth = 0.0;
  let txCount = 0;
  let bytecodeSize = 0;

  try {
    const [rawBal, rawTxCount, rawCode] = await Promise.all([
      provider.getBalance(checksumAddr).catch(() => BigInt(0)),
      provider.getTransactionCount(checksumAddr).catch(() => 0),
      provider.getCode(checksumAddr).catch(() => "0x")
    ]);

    nativeBalEth = parseFloat(ethers.formatEther(rawBal));
    txCount = rawTxCount;
    bytecodeSize = rawCode && rawCode !== "0x" ? (rawCode.length - 2) / 2 : 0;
  } catch (e) {
    console.warn("Base RPC fetch error:", e);
  }

  const isContract = bytecodeSize > 0;

  // Inspect ERC-20 Balances with live pricing
  const tokenResults: Array<{ symbol: string; balance: number; usd_value: number }> = [];
  let tokenTotalUsd = 0;

  try {
    const tokenPromises = topTokens.map(async (tok) => {
      try {
        const contract = new ethers.Contract(tok.address, ERC20_ABI, provider);
        const balRaw = await contract.balanceOf(checksumAddr);
        const balFormatted = Number(balRaw) / Math.pow(10, tok.decimals);
        const usdVal = balFormatted * tok.usdPrice;
        return {
          symbol: tok.symbol,
          balance: Math.round(balFormatted * 1000) / 1000,
          usd_value: Math.round(usdVal * 100) / 100
        };
      } catch {
        return { symbol: tok.symbol, balance: 0, usd_value: 0 };
      }
    });

    const settled = await Promise.all(tokenPromises);
    for (const t of settled) {
      if (t.balance > 0) {
        tokenResults.push(t);
        tokenTotalUsd += t.usd_value;
      }
    }
  } catch (e) {
    console.warn("Token balance inspection error:", e);
  }

  // CC3 Testnet native balance (parallel, best-effort)
  let cc3NativeBalance = 0;
  try {
    const cc3Provider = new ethers.JsonRpcProvider(CC3_RPC, undefined, { staticNetwork: true });
    const cc3Bal = await cc3Provider.getBalance(checksumAddr).catch(() => BigInt(0));
    cc3NativeBalance = parseFloat(ethers.formatEther(cc3Bal));
  } catch {
    // CC3 unavailable — non-critical
  }

  const nativeUsd = nativeBalEth * ethPrice;
  const totalPortfolioUsd = nativeUsd + tokenTotalUsd;

  let adminType = "External Owned Account (EOA)";
  if (isContract) {
    if (bytecodeSize > 10000) adminType = "Enterprise Multi-Sig / Modular Protocol Contract";
    else if (bytecodeSize > 2000) adminType = "EVM Smart Contract";
    else adminType = "Minimal Proxy / Delegation Contract";
  }

  return {
    is_contract: isContract,
    bytecode_size: bytecodeSize,
    transaction_count: txCount,
    native_balance_eth: Math.round(nativeBalEth * 10000) / 10000,
    native_balance_usd: Math.round(nativeUsd * 100) / 100,
    cc3_native_balance: Math.round(cc3NativeBalance * 10000) / 10000,
    token_balances: tokenResults,
    total_portfolio_usd: Math.round(totalPortfolioUsd * 100) / 100,
    admin_type: adminType,
    rpc_used: rpcUsed,
    live_eth_price_usd: ethPrice,
    live_btc_price_usd: btcPrice,
    price_source: ethPriceSource
  };
}
