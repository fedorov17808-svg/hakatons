"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const CONTRACT_ADDRESS = "0xa3AD1879Af301B7c158ff9844541BA0Ca8Eb353b";
const CONTRACT_ABI = [
  "function saveRiskReport(string memory _assetAddress, uint256 _overallScore, uint256 _liquidity, uint256 _collateral, uint256 _auditScore) public",
  "function getReport(string memory _assetAddress) public view returns (tuple(string assetAddress, uint256 overallScore, uint256 liquidity, uint256 collateral, uint256 auditScore, uint256 timestamp, address verifiedBy))"
];

const EXPLORER_URL = "https://creditcoin-testnet.blockscout.com/tx/";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  
  const [account, setAccount] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");
  const [txStep, setTxStep] = useState<number>(0);
  const [txBlockNumber, setTxBlockNumber] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cp_history");
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const presets = [
    { name: "Aave V3", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
    { name: "Compound V3", address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" },
    { name: "MakerDAO", address: "0x9759A6Ac90977b93B58547b4A71c78317f391A28" }
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

  const switchToCreditcoin = async () => {
    const CORRECT_CHAIN_ID = '0x18E8F'; // 102031
    try {
      // First try to just switch to the correct chain
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CORRECT_CHAIN_ID }],
      });
    } catch (switchErr: any) {
      // Chain doesn't exist - add it
      if (switchErr.code === 4902 || switchErr.code === -32603) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CORRECT_CHAIN_ID,
              chainName: 'Creditcoin Testnet CC3',
              nativeCurrency: { name: 'CTC', symbol: 'CTC', decimals: 18 },
              rpcUrls: ['https://rpc.cc3-testnet.creditcoin.network/'],
              blockExplorerUrls: ['https://creditcoin-testnet.blockscout.com']
            }]
          });
        } catch (addErr) {
          console.error('Failed to add network:', addErr);
        }
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        await switchToCreditcoin();
      } catch (err) {}
    } else {
      alert("Please install MetaMask to connect your wallet");
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
    setTxStep(0);
    setTxBlockNumber(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddr }),
      });

      if (!response.ok) throw new Error("Backend connection failed");
      
      const data = await response.json();
      const radarData = [
        { subject: 'Liquidity', A: data.liquidity || 0 },
        { subject: 'Collateral', A: data.collateral || 0 },
        { subject: 'Security', A: data.security || 0 },
        { subject: 'Governance', A: data.governance || 0 },
        { subject: 'Audit', A: data.audit || 0 },
        { subject: 'Volatility', A: data.volatility_score || 0 }
      ];
      setResult({ ...data, radarData });
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
    if (!result) return;
    setTxStep(1);
    setTxStatus("Step 1/3: Submitting transaction...");
    setTxHash(null);
    setTxBlockNumber(null);
    
    try {
      const response = await fetch(`${API_URL}/api/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address || presets[0].address,
          score: Math.round(result.score || 0),
          liquidity: Math.round(result.liquidity || 0),
          collateral: Math.round(result.collateral || 0),
          audit: Math.round(result.audit || 0),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit transaction to the network.");
      }

      const data = await response.json();
      setTxHash(data.txHash);
      setTxStep(2);
      setTxStatus("Step 2/3: Waiting for block confirmation (~5-15s)");
      
      let confirmed = false;
      let blockNum = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_URL}/api/tx-status/${data.txHash}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "confirmed") {
            confirmed = true;
            blockNum = statusData.blockNumber;
            break;
          }
        }
      }

      if (confirmed) {
        setTxBlockNumber(blockNum);
        setTxStep(3);
        setTxStatus(`Step 3/3: ✅ Confirmed in block #${blockNum} on Creditcoin Testnet!`);
        playSuccessSound();
      } else {
        setTxStep(0);
        setTxStatus("❌ Transaction confirmation timeout. Please check explorer.");
      }
    } catch (err: any) {
      setTxStep(0);
      setTxStatus("❌ " + (err?.message || "Could not process transaction. Please try again."));
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-8">
      <style>{`
        @keyframes gradient-xy {
          0%, 100% {
            background-size: 400% 400%;
            background-position: 0% 0%;
          }
          50% {
            background-size: 200% 200%;
            background-position: 100% 100%;
          }
        }
        .animate-gradient-xy {
          animation: gradient-xy 3s ease infinite;
        }
      `}</style>
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
            href={`${API_URL}/docs`}
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
                  onClick={() => handleAnalyze(undefined, preset.address)}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg border border-slate-800 transition font-medium"
                >
                  {preset.name}
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
        {!loading && result && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300 print:text-black print:bg-white">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
                <p className="text-lg font-semibold text-slate-200 print:text-black">{result.rwa_type}</p>
                {result.protocol_name && result.protocol_name !== 'Unknown' && (
                  <p className='text-sm text-cyan-400 font-mono mt-1'>Protocol: {result.protocol_name}</p>
                )}

              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Overall Credit Score</span>
                <p className="text-3xl font-black text-emerald-400 print:text-emerald-700">{result.score}/100</p>
                {result.market_benchmark > 0 && (
                  <p className="text-xs font-mono text-slate-400 mt-1">Market TVL: ${result.market_benchmark >= 1e9 ? (result.market_benchmark / 1e9).toFixed(2) + 'B' : result.market_benchmark >= 1e6 ? (result.market_benchmark / 1e6).toFixed(1) + 'M' : result.market_benchmark.toLocaleString()}</p>
                )}
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
                    <span className="text-cyan-400 font-mono print:text-black">{result.liquidity}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.liquidity}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Collateral Ratio</span>
                    <span className="text-indigo-400 font-mono print:text-black">{result.collateral}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.collateral}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Smart Contract Security</span>
                    <span className="text-purple-400 font-mono print:text-black">{result.security}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.security}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Audit Verification</span>
                    <span className="text-emerald-400 font-mono print:text-black">{result.audit}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.audit}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Volatility Index</span>
                    <span className="text-amber-400 font-mono print:text-black">{result.volatility_score || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.volatility_score || 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Governance Score</span>
                    <span className="text-rose-400 font-mono print:text-black">{result.governance || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: `${result.governance || 0}%` }}></div>
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
                disabled={txStep > 0 && txStep < 3}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {txStep > 0 && (
              <div className={`mt-6 p-[2px] rounded-2xl ${txStep < 3 ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 animate-gradient-xy' : 'bg-slate-800'}`}>
                <div className="bg-slate-900 rounded-xl p-5 text-center space-y-4 h-full">
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>{txStep === 1 ? 'Submitting...' : txStep === 2 ? 'Confirming...' : 'Complete!'}</span>
                    <span>{txStep < 3 ? 'Estimated: ~15 seconds' : 'Done'}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-2 mb-4">
                    <div className="bg-cyan-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${txStep === 1 ? 33 : txStep === 2 ? 66 : 100}%` }}></div>
                  </div>
                  
                  <p className="text-sm font-mono text-emerald-400">
                    {txStep < 3 && <span className="animate-spin inline-block mr-2">⚙️</span>}
                    {txStatus}
                  </p>
                  
                  {txHash && (
                    <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-800/50">
                      <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800/80 w-fit">
                        <span className="text-xs text-slate-400 font-mono">Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(txHash);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="text-slate-400 hover:text-cyan-400 transition ml-2"
                          title="Copy to clipboard"
                        >
                          {isCopied ? "✓" : "📋"}
                        </button>
                      </div>
                      
                      <a
                        href={`${EXPLORER_URL}${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-medium rounded-xl transition border border-slate-700 shadow-sm w-fit"
                      >
                        View on Explorer ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {txStep === 0 && txStatus && (
              <div className="mt-6 text-center space-y-1 print:hidden">
                <p className="text-xs font-mono text-rose-400">{txStatus}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className='max-w-4xl mx-auto mt-16 pt-6 border-t border-slate-800 text-center print:hidden'>
        <p className='text-xs text-slate-600'>CreditPulse AI — Built on Creditcoin • Powered by DeFiLlama Oracles</p>
      </footer>
    </main>
  );
}
