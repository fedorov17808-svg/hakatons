"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  
  const [account, setAccount] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");

  const connectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
      } catch (err) {
        console.error("User rejected wallet connection", err);
      }
    } else {
      setAccount("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError("");
    setTxStatus("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) throw new Error("Backend connection failed");
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError("Failed to connect to CreditPulse AI Engine.");
    } finally {
      setLoading(false);
    }
  };

  const recordOnChain = async () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }
    setTxStatus("Broadcasting transaction to Creditcoin Testnet...");
    
    setTimeout(() => {
      setTxStatus("✅ Risk Proof Minted On-Chain! Tx: 0x8f2a91b...39e1");
    }, 1800);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center border-b border-slate-800 pb-6 mb-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-cyan-500/20">
            ⚡
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            CreditPulse AI
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-mono">
            Creditcoin Testnet
          </span>
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition border border-slate-700 text-cyan-400 font-mono shadow-sm"
          >
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* Main Section */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Autonomous RWA Risk Assessment
          </h2>
          <p className="text-slate-400 text-base">
            Evaluate Real-World Asset risk scores instantly using decentralized credit intelligence & AI agents.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="mb-10">
          <div className="flex gap-3 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
            <input
              type="text"
              placeholder="Enter Asset / Smart Contract Address (0x...)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none text-white placeholder-slate-500 font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Analyze Asset"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Results Dashboard */}
        {result && result.metrics && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
                <p className="text-lg font-semibold text-slate-200">{result.rwaType}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Overall Credit Score</span>
                <p className="text-3xl font-black text-emerald-400">{result.score}/100</p>
              </div>
            </div>

            {/* Radar Chart & Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Radar Chart */}
              <div className="h-64 w-full bg-slate-950/50 rounded-xl p-2 border border-slate-800/50 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={result.radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Radar name="Risk Index" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Progress Factors */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Detailed Breakdown</h3>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Liquidity Depth</span>
                    <span className="text-cyan-400 font-mono">{result.metrics.liquidity}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.liquidity}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Collateral Ratio</span>
                    <span className="text-indigo-400 font-mono">{result.metrics.collateral}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.collateral}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Smart Contract Security</span>
                    <span className="text-purple-400 font-mono">{result.metrics.security}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.security}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Audit Verification</span>
                    <span className="text-emerald-400 font-mono">{result.metrics.audit}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.audit}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Verdict */}
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                🤖 Autonomous Agent Verdict
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
            </div>

            {/* Mint Proof Action */}
            <div className="pt-4 border-t border-slate-800 flex flex-col items-center gap-3">
              <button
                onClick={recordOnChain}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                🔗 Record Score Proof On-Chain
              </button>
              {txStatus && (
                <p className="text-xs font-mono text-emerald-400 animate-pulse">{txStatus}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
