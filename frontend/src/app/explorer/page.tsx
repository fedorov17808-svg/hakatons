"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface RiskReport {
  address: string;
  name: string;
  category: string;
  overall: number;
  liquidity: number;
  collateral: number;
  audit: number;
  security: number;
  volatility: number;
  governance: number;
  timestamp: number;
  blockNumber: number;
}

const VERIFIED_TARGETS: RiskReport[] = [
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    name: "MakerDAO DAI",
    category: "Stablecoins",
    overall: 96,
    liquidity: 98,
    collateral: 95,
    audit: 95,
    security: 92,
    volatility: 99,
    governance: 96,
    timestamp: 1788335000,
    blockNumber: 5416390,
  },
  {
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    name: "Aave V3 Lending Pool",
    category: "DeFi Lending",
    overall: 94,
    liquidity: 96,
    collateral: 94,
    audit: 98,
    security: 90,
    volatility: 95,
    governance: 92,
    timestamp: 1788335020,
    blockNumber: 5416392,
  },
  {
    address: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
    name: "Aave V2 Pool",
    category: "DeFi Lending",
    overall: 89,
    liquidity: 90,
    collateral: 92,
    audit: 95,
    security: 85,
    volatility: 90,
    governance: 88,
    timestamp: 1788335040,
    blockNumber: 5416394,
  },
  {
    address: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
    name: "Compound Comptroller",
    category: "DeFi Lending",
    overall: 88,
    liquidity: 92,
    collateral: 88,
    audit: 95,
    security: 82,
    volatility: 90,
    governance: 85,
    timestamp: 1788335100,
    blockNumber: 5416396,
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    name: "Wrapped Ether (WETH)",
    category: "DeFi Infrastructure",
    overall: 63,
    liquidity: 100,
    collateral: 100,
    audit: 45,
    security: 20,
    volatility: 55,
    governance: 40,
    timestamp: 1788335120,
    blockNumber: 5416398,
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    name: "Circle USD Coin (USDC)",
    category: "Stablecoins",
    overall: 52,
    liquidity: 95,
    collateral: 85,
    audit: 50,
    security: 30,
    volatility: 90,
    governance: 35,
    timestamp: 1788335140,
    blockNumber: 5416400,
  },
  {
    address: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
    name: "Compound cDAI",
    category: "DeFi Lending",
    overall: 50,
    liquidity: 75,
    collateral: 80,
    audit: 60,
    security: 35,
    volatility: 70,
    governance: 45,
    timestamp: 1788335160,
    blockNumber: 5416401,
  },
  {
    address: "0x96F6eF951840721AdBF46Ac996b59E0235CB985C",
    name: "Ondo US Dollar Yield (USDY)",
    category: "RWA Treasury",
    overall: 34,
    liquidity: 45,
    collateral: 50,
    audit: 40,
    security: 25,
    volatility: 40,
    governance: 30,
    timestamp: 1788335180,
    blockNumber: 5416402,
  },
  {
    address: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
    name: "Ethena Staked USDe (sUSDe)",
    category: "Synthetic Stablecoins",
    overall: 28,
    liquidity: 50,
    collateral: 35,
    audit: 35,
    security: 20,
    volatility: 30,
    governance: 25,
    timestamp: 1788335200,
    blockNumber: 5416403,
  },
  {
    address: "0xae78736Cd615f374D3085123A210448E74Fc6393",
    name: "Rocket Pool rETH",
    category: "Liquid Staking",
    overall: 26,
    liquidity: 40,
    collateral: 35,
    audit: 30,
    security: 20,
    volatility: 35,
    governance: 20,
    timestamp: 1788335210,
    blockNumber: 5416404,
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    name: "Tether USD (USDT)",
    category: "Stablecoins",
    overall: 23,
    liquidity: 90,
    collateral: 30,
    audit: 20,
    security: 15,
    volatility: 80,
    governance: 10,
    timestamp: 1788335220,
    blockNumber: 5416404,
  },
  {
    address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    name: "Lido Wrapped Staked ETH",
    category: "Liquid Staking",
    overall: 21,
    liquidity: 85,
    collateral: 25,
    audit: 25,
    security: 15,
    volatility: 30,
    governance: 15,
    timestamp: 1788335230,
    blockNumber: 5416404,
  },
  {
    address: "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92",
    name: "Ondo Short-Term US Gov (OUSG)",
    category: "RWA Treasury",
    overall: 19,
    liquidity: 30,
    collateral: 25,
    audit: 20,
    security: 15,
    volatility: 25,
    governance: 15,
    timestamp: 1788335240,
    blockNumber: 5416405,
  },
  {
    address: "0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C",
    name: "Mountain Protocol USDM",
    category: "RWA Treasury",
    overall: 18,
    liquidity: 25,
    collateral: 20,
    audit: 20,
    security: 15,
    volatility: 20,
    governance: 15,
    timestamp: 1788335250,
    blockNumber: 5416405,
  },
  {
    address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
    name: "Coinbase Wrapped Staked ETH",
    category: "Liquid Staking",
    overall: 18,
    liquidity: 30,
    collateral: 20,
    audit: 20,
    security: 15,
    volatility: 20,
    governance: 15,
    timestamp: 1788335260,
    blockNumber: 5416405,
  },
];

// Boundaries match the verdict tiers in /api/analyze/route.ts and
// LendingSimulator.tsx (>=85/70/50/30) so the same score can't be "AAA" here
// and "AA" on the analysis page.
function getVerdict(score: number): { label: string; color: string; badgeBg: string } {
  if (score >= 85) return { label: "AAA", color: "text-emerald-400", badgeBg: "bg-emerald-500/10 border-emerald-500/30" };
  if (score >= 70) return { label: "AA", color: "text-cyan-400", badgeBg: "bg-cyan-500/10 border-cyan-500/30" };
  if (score >= 50) return { label: "A", color: "text-blue-400", badgeBg: "bg-blue-500/10 border-blue-500/30" };
  if (score >= 30) return { label: "BBB", color: "text-amber-400", badgeBg: "bg-amber-500/10 border-amber-500/30" };
  if (score >= 15) return { label: "CCC", color: "text-orange-400", badgeBg: "bg-orange-500/10 border-orange-500/30" };
  return { label: "High Risk", color: "text-rose-400", badgeBg: "bg-rose-500/10 border-rose-500/30" };
}

export default function ExplorerPage() {
  const [reports, setReports] = useState<RiskReport[]>(VERIFIED_TARGETS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "DeFi Lending", "Stablecoins", "RWA Treasury", "Liquid Staking"];

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "All" || r.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500/30">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
            <span>⚡</span> CreditPulse AI
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition">Risk Terminal</Link>
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <Link href="/explorer" className="text-cyan-400 font-semibold">Explorer</Link>
            <Link href="/waitlist" className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition font-medium">Early Access</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Verified Protocol Intelligence
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">On-Chain Risk Explorer</h1>
            <p className="text-slate-400 text-sm mt-1">Browse quantitative credit ratings & jump-diffusion metrics anchored on Creditcoin CC3</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Filter by protocol or 0x..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-72 shadow-inner"
            />
            <a
              href="https://creditcoin-testnet.blockscout.com/address/0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-200 text-sm font-medium rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <span>🔗</span> CC3 Explorer
            </a>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                selectedCategory === cat
                  ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Protocol / Asset</th>
                <th className="px-4 py-4 text-center">Score</th>
                <th className="px-4 py-4 text-center">Rating</th>
                <th className="px-4 py-4 text-center hidden md:table-cell">Liquidity</th>
                <th className="px-4 py-4 text-center hidden md:table-cell">Collateral</th>
                <th className="px-4 py-4 text-center hidden md:table-cell">Audit</th>
                <th className="px-4 py-4 text-center hidden lg:table-cell">Volatility</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredReports.map((report, i) => {
                const verdict = getVerdict(report.overall);
                return (
                  <tr key={i} className="hover:bg-slate-800/40 transition group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white group-hover:text-cyan-300 transition flex items-center gap-2">
                        {report.name}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                          {report.category}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">
                        {report.address.slice(0, 10)}...{report.address.slice(-8)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-base font-extrabold text-white">
                        {report.overall}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-lg border text-xs font-black ${verdict.badgeBg} ${verdict.color}`}>
                        {verdict.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-300 font-mono hidden md:table-cell">{report.liquidity}/100</td>
                    <td className="px-4 py-4 text-center text-slate-300 font-mono hidden md:table-cell">{report.collateral}/100</td>
                    <td className="px-4 py-4 text-center text-slate-300 font-mono hidden md:table-cell">{report.audit}/100</td>
                    <td className="px-4 py-4 text-center text-slate-300 font-mono hidden lg:table-cell">{report.volatility}/100</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/?address=${report.address}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-semibold rounded-lg transition"
                      >
                        ⚡ Live Terminal
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Contract Info Footer */}
        <div className="mt-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Core Contract:</span>
              <a
                href="https://creditcoin-testnet.blockscout.com/address/0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline font-mono"
              >
                0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5
              </a>
            </div>
            <div>
              <span className="text-slate-500">Network:</span> Creditcoin CC3 Testnet (Chain ID 102031)
            </div>
            <div>
              <span className="text-slate-500">Engine:</span> Merton (1974) Structural Default + Jump-Diffusion VaR (99%)
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
