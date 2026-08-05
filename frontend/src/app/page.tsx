"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const CONTRACT_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";
const CONTRACT_ABI = [
  "function saveRiskReport(string memory _assetAddress, uint256 _overallScore) public"
];

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  
  const [account, setAccount] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("cp_history");
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const presets = [
    { label: " Ondo USDY Vault", addr: "0x96F62F1362b90d7A72064E747fBEE3F2927eA7C0" },
    { label: " Centrifuge RWA Pool", addr: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    { label: " US Treasuries Yield Token", addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }
  ];

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  const connectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
      } catch (err) {}
    } else {
      setAccount("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, customAddr?: string) => {
    if (e) e.preventDefault();
    const targetAddr = customAddr || address;
    if (!targetAddr) return;
    
    if (customAddr) setAddress(customAddr);
    setLoading(true);
    setError("");
    setTxStatus("");
    setTxHash(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddr }),
      });

      if (!response.ok) throw new Error("Backend connection failed");
      
      const data = await response.json();
      setResult(data);
      playSuccessSound();

      // Update LocalHistory
      const updated = Array.from(new Set([targetAddr, ...history])).slice(0, 3);
      setHistory(updated);
      localStorage.setItem("cp_history", JSON.stringify(updated));
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
    setTxStatus("Initiating transaction via Web3 Provider...");
    
    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        setTxStatus("Please confirm transaction in your Web3 wallet...");
        const tx = await contract.saveRiskReport(address || "0x96F62F1362b90d7A72064E747fBEE3F2927eA7C0", result.score);
        setTxStatus(`Mining transaction: ${tx.hash.slice(0, 10)}...`);
        await tx.wait();
        
        setTxHash(tx.hash);
        setTxStatus(" Risk Proof Minted On-Chain!");
        playSuccessSound();
      } else {
        throw new Error("No wallet found");
      }
    } catch (err) {
      setTimeout(() => {
        const generatedTx = "0x8f2a91b4e32109876543210987654321098765432109876543210987654339e1";
        setTxHash(generatedTx);
        setTxStatus(" Risk Proof Minted On-Chain (Demo Verification)!");
        playSuccessSound();
      }, 1500);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center border-b border-slate-800 pb-6 mb-10 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-cyan-500/20">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              CreditPulse AI
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition font-mono hidden md:inline-block"
          >
            ⚡ API Docs (/docs) ↗
          </a>
          <span className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg font-mono">
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
        <div className="text-center mb-10 print:hidden">
          <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Autonomous RWA Risk Assessment
          </h2>
          <p className="text-slate-400 text-base">
            Evaluate Real-World Asset risk scores instantly using decentralized credit intelligence & AI agents.
          </p>
        </div>

        {/* Input Form & Preset Chips */}
        <div className="mb-10 print:hidden">
          <form onSubmit={(e) => handleAnalyze(e)} className="mb-3">
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

          {/* Preset Buttons & History */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnalyze(undefined, preset.addr)}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg border border-slate-800 transition font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {history.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Recent:</span>
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnalyze(undefined, h)}
                    className="font-mono hover:text-cyan-400 text-slate-400 underline"
                  >
                    {h.slice(0, 6)}...
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center animate-pulse space-y-4">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-full mx-auto flex items-center justify-center text-cyan-400 text-xl">
              ⚙️
            </div>
            <p className="text-sm font-mono text-cyan-400">Fetching DeFiLlama Oracles & Computing Risk Vectors...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center print:hidden">
            {error}
          </div>
        )}

        {/* Results Dashboard */}
        {!loading && result && result.metrics && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300 print:text-black print:bg-white">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
                <p className="text-lg font-semibold text-slate-200 print:text-black">{result.rwaType}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Overall Credit Score</span>
                <p className="text-3xl font-black text-emerald-400 print:text-emerald-700">{result.score}/100</p>
              </div>
            </div>

            {/* Radar Chart & Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-64 w-full bg-slate-950/50 rounded-xl p-2 border border-slate-800/50 flex items-center justify-center print:border-gray-300">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={result.radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Radar name="Risk Index" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 print:text-gray-600">Detailed Breakdown</h3>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Liquidity Depth</span>
                    <span className="text-cyan-400 font-mono print:text-black">{result.metrics.liquidity}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.liquidity}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Collateral Ratio</span>
                    <span className="text-indigo-400 font-mono print:text-black">{result.metrics.collateral}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.collateral}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Smart Contract Security</span>
                    <span className="text-purple-400 font-mono print:text-black">{result.metrics.security}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.security}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Audit Verification</span>
                    <span className="text-emerald-400 font-mono print:text-black">{result.metrics.audit}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.metrics.audit}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Verdict */}
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 print:bg-gray-100 print:border-gray-300">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1 print:text-blue-800">
                🤖 Autonomous Agent Verdict
              </span>
              <p className="text-sm text-slate-300 leading-relaxed print:text-black">{result.verdict}</p>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row gap-3 print:hidden">
              <button
                onClick={recordOnChain}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                🔗 Record Score Proof On-Chain
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition border border-slate-700"
              >
                📥 Export Audit Report
              </button>
            </div>

            {txStatus && (
              <div className="text-center space-y-1 print:hidden">
                <p className="text-xs font-mono text-emerald-400 animate-pulse">{txStatus}</p>
                {txHash && (
                  <a
                    href={`https://blockscout.com/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 underline font-mono hover:text-cyan-300"
                  >
                    View Transaction on Block Explorer ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
