"use client";

import React, { useState } from "react";

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError("");

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
      setError("Failed to connect to CreditPulse AI Engine. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-8">
      {/* Header */}
      <header className="max-w-5xl mx-auto flex justify-between items-center border-b border-slate-800 pb-6 mb-12">
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
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition border border-slate-700">
            Connect Wallet
          </button>
        </div>
      </header>

      {/* Hero / Main Section */}
      <div className="max-w-3xl mx-auto">
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
              className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none text-white placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                "Analyze Asset"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
                <p className="text-lg font-semibold text-slate-200">{result.rwaType}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Risk Score</span>
                <p className="text-3xl font-black text-emerald-400">{result.score}/100</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                <span className="text-xs text-slate-500">Status</span>
                <p className="text-sm font-semibold text-emerald-400 mt-1">{result.status}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                <span className="text-xs text-slate-500">Volatility Rate</span>
                <p className="text-sm font-semibold text-slate-300 mt-1">{result.volatility}</p>
              </div>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                🤖 AI Agent Verdict
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}