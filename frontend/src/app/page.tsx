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
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "demo123";

interface RiskResult {
  rwa_type?: string;
  protocol_name?: string;
  score?: number;
  market_benchmark?: number;
  liquidity?: number;
  collateral?: number;
  security?: number;
  audit?: number;
  volatility_score?: number;
  governance?: number;
  verdict?: string;
  radarData?: { subject: string; A: number }[];
}

const getScoreColor = (score: number) => {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (score >= 60) return { bar: 'bg-cyan-500', text: 'text-cyan-400' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
};

const getScoreText = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
};

const getVerdictStyle = (verdict?: string) => {
  const v = verdict || '';
  if (v.includes('LOW RISK')) return { box: 'bg-emerald-950/30 border-emerald-500', text: 'text-emerald-400' };
  if (v.includes('MODERATE')) return { box: 'bg-cyan-950/30 border-cyan-500', text: 'text-cyan-400' };
  if (v.includes('HIGH') || v.includes('CRITICAL')) return { box: 'bg-rose-950/30 border-rose-500', text: 'text-rose-400' };
  return { box: 'bg-blue-950/30 border-blue-800/30', text: 'text-blue-400' };
};

const getButtonGradient = (score: number) => {
  if (score >= 70) return 'from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20';
  if (score >= 40) return 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20';
  return 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20';
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
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

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const presets = [
    { name: "Aave V3", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
    { name: "Compound V3", address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" },
    { name: "MakerDAO", address: "0x9759A6Ac90977b93B58547b4A71c78317f391A28" }
  ];

  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
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
      const ethWindow = window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } };
      await ethWindow.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CORRECT_CHAIN_ID }],
      });
    } catch (switchErr: unknown) {
      // Chain doesn't exist - add it
      const err = switchErr as { code?: number };
      if (err.code === 4902 || err.code === -32603) {
        try {
          const ethWindow = window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } };
          await ethWindow.ethereum.request({
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
    const ethWindow = window as unknown as { ethereum: ethers.Eip1193Provider };
    if (typeof window !== "undefined" && ethWindow.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethWindow.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        try {
          await switchToCreditcoin();
        } catch (switchErr) {
          console.warn('Network switch skipped:', switchErr);
        }
      } catch (err: unknown) {
        const errorObj = err as { code?: number };
        if (errorObj?.code === 4001) {
          setError("Wallet connection was rejected. Please try again.");
        } else {
          setError("Failed to connect wallet. Please make sure MetaMask is unlocked.");
        }
        console.error('Wallet connection error:', err);
      }
    } else {
      window.open('https://metamask.io/download/', '_blank');
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
        { subject: 'Audit', A: data.audit || 0 },
        { subject: 'Volatility', A: data.volatility_score || 0 },
        { subject: 'Governance', A: data.governance || 0 }
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
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": API_KEY
        },
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
    } catch (err: unknown) {
      setTxStep(0);
      const e = err as Error;
      setTxStatus("❌ " + (e?.message || "Could not process transaction. Please try again."));
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
        @media (prefers-reduced-motion: reduce) {
          .animate-gradient-xy { animation: none !important; }
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
      {/* Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 mb-10 gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-cyan-500/20">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent animate-gradient-xy bg-[length:400%_400%]">
              CreditPulse AI
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-3">
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            aria-label="View API Documentation"
            className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition font-mono hidden md:inline-block focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            ⚡ API Docs (/docs) ↗
          </a>
          {account ? (
            <div className="flex items-center gap-3 bg-slate-900/50 pl-3 pr-4 py-1.5 rounded-xl border border-slate-800 backdrop-blur-sm shadow-inner">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-medium hidden sm:inline-block">Creditcoin Testnet</span>
              </div>
              <div className="w-px h-4 bg-slate-700 hidden sm:block"></div>
              <span className="text-sm font-mono text-slate-200">{`${account.slice(0, 6)}...${account.slice(-4)}`}</span>
            </div>
          ) : (
            <button
              id="btn-connect-wallet"
              aria-label="Connect MetaMask wallet"
              onClick={connectWallet}
              className="px-5 py-2 md:py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-sm font-medium rounded-xl transition border border-slate-600 text-cyan-400 shadow-lg flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              Connect Wallet
            </button>
          )}
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
            <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
              <input
                id="input-address"
                aria-label="Enter Ethereum contract address"
                type="text"
                placeholder="Enter Asset / Smart Contract Address (0x...)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnalyze(e); } }}
                className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none text-white placeholder-slate-500 font-mono"
              />
              <button
                id="btn-analyze"
                aria-label="Analyze DeFi protocol risk"
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
                  aria-label={`Analyze ${preset.name}`}
                  onClick={() => handleAnalyze(undefined, preset.address)}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg border border-slate-800 transition font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
                    aria-label={`Analyze history address ${h}`}
                    onClick={() => handleAnalyze(undefined, h)}
                    className="font-mono hover:text-cyan-400 text-slate-400 underline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  >
                    {h.slice(0, 6)}...
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-12 text-center space-y-6 shadow-2xl">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-cyan-500 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/50">
                <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]"></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium text-cyan-400">Analyzing protocol with live DeFiLlama data...</p>
              <p className="text-xs font-mono text-slate-500">Estimated time: ~3-5 seconds</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-950 border-2 border-red-500 rounded-xl text-red-500 text-sm flex justify-between items-center shadow-lg shadow-red-500/20 print:hidden font-medium">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} aria-label="Close error" className="text-red-500 hover:text-red-400 hover:bg-red-900/50 p-1.5 rounded-lg transition-colors font-bold focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none">
              ✕
            </button>
          </div>
        )}

        {/* Results Dashboard */}
        {!loading && result && (
          <section id="section-results" aria-labelledby="results-heading" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-300 print:text-black print:bg-white">
            <h2 id="results-heading" className="sr-only">Analysis Results</h2>
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
                <p className={`text-3xl font-black ${getScoreColor(result.score || 0).text} print:text-emerald-700`}>{result.score}/100</p>
                <div className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-md border border-current ${getScoreColor(result.score || 0).text}`}>
                    {getScoreText(result.score || 0)}
                  </span>
                </div>
                {typeof result.market_benchmark === 'number' && result.market_benchmark > 0 && (
                  <p className="text-xs font-mono text-slate-400 mt-2">Market TVL: ${result.market_benchmark >= 1e9 ? (result.market_benchmark / 1e9).toFixed(2) + 'B' : result.market_benchmark >= 1e6 ? (result.market_benchmark / 1e6).toFixed(1) + 'M' : result.market_benchmark.toLocaleString()}</p>
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

              <div id="section-breakdown" className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 print:text-gray-600">Detailed Breakdown</h3>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Liquidity Depth</span>
                    <span className={`${getScoreColor(result.liquidity || 0).text} font-mono print:text-black`}>{result.liquidity}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.liquidity || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.liquidity}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Collateral Ratio</span>
                    <span className={`${getScoreColor(result.collateral || 0).text} font-mono print:text-black`}>{result.collateral}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.collateral || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.collateral}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Smart Contract Security</span>
                    <span className={`${getScoreColor(result.security || 0).text} font-mono print:text-black`}>{result.security}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.security || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.security}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Audit Verification</span>
                    <span className={`${getScoreColor(result.audit || 0).text} font-mono print:text-black`}>{result.audit}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.audit || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.audit}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Volatility Index</span>
                    <span className={`${getScoreColor(result.volatility_score || 0).text} font-mono print:text-black`}>{result.volatility_score || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.volatility_score || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.volatility_score || 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 print:text-gray-700">Governance Score</span>
                    <span className={`${getScoreColor(result.governance || 0).text} font-mono print:text-black`}>{result.governance || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className={`${getScoreColor(result.governance || 0).bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${result.governance || 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Verdict */}
            <div className={`${getVerdictStyle(result.verdict).box} border rounded-xl p-4 print:bg-gray-100 print:border-gray-300`}>
              <span className={`text-xs font-semibold ${getVerdictStyle(result.verdict).text} uppercase tracking-wider block mb-1 print:text-blue-800`}>
                🤖 Autonomous Agent Verdict
              </span>
              <p className="text-sm text-slate-300 leading-relaxed print:text-black">{result.verdict}</p>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row gap-3 print:hidden">
              <button
                id="btn-record"
                aria-label="Record risk score on Creditcoin blockchain"
                onClick={recordOnChain}
                disabled={txStep > 0 && txStep < 3}
                className={`flex-1 py-3 bg-gradient-to-r ${getButtonGradient(result.score || 0)} text-slate-950 font-bold text-sm rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`}
              >
                🔗 Record Score Proof On-Chain
              </button>
              <button
                id="btn-export"
                aria-label="Export audit report as PDF"
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition border border-slate-700 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
                          aria-label="Copy transaction hash"
                          onClick={() => {
                            navigator.clipboard.writeText(txHash);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="text-slate-400 hover:text-cyan-400 transition ml-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                          title="Copy to clipboard"
                        >
                          {isCopied ? "✓" : "📋"}
                        </button>
                      </div>
                      
                      <a
                        href={`${EXPLORER_URL}${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction on Creditcoin block explorer"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-medium rounded-xl transition border border-slate-700 shadow-sm w-fit focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
          </section>
        )}

        {!loading && !result && !error && (
          <div className="mt-12 bg-slate-900/50 border border-slate-800/50 rounded-3xl p-6 md:p-10 text-center shadow-xl backdrop-blur-sm print:hidden">
            <h3 className="text-xl font-bold text-slate-200 mb-4">How CreditPulse AI Works</h3>
            <p className="text-slate-400 text-sm mb-10 max-w-lg mx-auto">
              Our autonomous agent analyzes smart contracts in real-time, pulling live data to compute a comprehensive risk profile before you invest.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 text-2xl mb-4 border border-blue-500/20">
                  🔍
                </div>
                <h4 className="text-slate-200 font-semibold mb-2">1. Analyze</h4>
                <p className="text-slate-500 text-xs">Fetches DeFiLlama TVL, liquidity, and on-chain security metrics.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 text-2xl mb-4 border border-purple-500/20">
                  🧮
                </div>
                <h4 className="text-slate-200 font-semibold mb-2">2. Score</h4>
                <p className="text-slate-500 text-xs">AI agent processes vectors to output a 0-100 trust index.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 text-2xl mb-4 border border-emerald-500/20">
                  🔗
                </div>
                <h4 className="text-slate-200 font-semibold mb-2">3. Record</h4>
                <p className="text-slate-500 text-xs">Saves an immutable proof of the audit to the Creditcoin network.</p>
              </div>
            </div>
            <div className="mt-10 pt-8 border-t border-slate-800/50">
              <p className="text-sm text-slate-400 mb-4">Try it out with a preset protocol:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {presets.map((preset, idx) => (
                  <button key={idx} aria-label={`Analyze ${preset.name}`} onClick={() => handleAnalyze(undefined, preset.address)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm rounded-xl transition border border-slate-700 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none">{preset.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className='max-w-4xl mx-auto mt-16 pt-6 border-t border-slate-800 text-center print:hidden'>
        <p className='text-xs text-slate-600'>CreditPulse AI — Built on Creditcoin • Powered by DeFiLlama Oracles</p>
      </footer>
    </main>
  );
}
