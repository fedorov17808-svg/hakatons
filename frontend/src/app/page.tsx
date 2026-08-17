"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const EXPLORER_URL = "https://creditcoin-testnet.blockscout.com/tx/";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const METAMASK_DOWNLOAD_URL = "https://metamask.io/download/";

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
  formula_version?: string;
  raw_inputs?: {
    tvl?: number;
    change_1d?: number | null;
    change_7d?: number | null;
    category?: string;
    audits?: string;
    chains_count?: number;
    chains?: string[];
    listed_at?: number;
    data_source?: string;
    fetched_at?: number;
    match?: string;
  };
  data_hash?: string;
  ai_narrative?: string;
  ai_powered?: boolean;
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
  const [displayScore, setDisplayScore] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  
  const [account, setAccount] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");
  const [txStep, setTxStep] = useState<number>(0);
  const [txBlockNumber, setTxBlockNumber] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking'|'online'|'offline'>('checking');
  const [onchainStats, setOnchainStats] = useState<{total_reports_onchain: number; verified_cross_chain_proofs: number; block_number: number} | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (!result) return;
    let current = 0;
    const target = result.score || 0;
    const step = Math.ceil(target / 30) || 1;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      setDisplayScore(current);
    }, 30);
    return () => clearInterval(timer);
  }, [result]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
    // Live on-chain stats
    fetch(`${API_URL}/api/stats/onchain`)
      .then(r => r.json())
      .then(d => { if (d.total_reports_onchain !== undefined) setOnchainStats(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cp_history");
      if (saved) {
        try { setHistory(JSON.parse(saved)); } catch { /* corrupted history, ignore */ }
      }
    } catch { /* localStorage unavailable in some environments */ }
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
    } catch { /* AudioContext may not be available */ }
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
      if (err.code === 4902 || err.code === -32603 || typeof err.code === 'undefined') {
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
        } catch {
          setError('Failed to add Creditcoin network to wallet');
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
          // Network switch skipped
        }
      } catch (err: unknown) {
        const errorObj = err as { code?: number };
        if (errorObj?.code === 4001) {
          setError("Wallet connection was rejected. Please try again.");
        } else {
          setError("Failed to connect wallet. Please make sure your Web3 wallet is unlocked.");
        }
      }
    } else {
      setError('INFO: No Web3 wallet detected. You can still use all features without a wallet.');
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

    let retries = 1;
    let lastError: unknown;
    while (retries >= 0) {
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
        try {
          localStorage.setItem("cp_history", JSON.stringify(updated));
        } catch(e) { console.warn('localStorage write error:', e); }
        
        setLoading(false);
        return;
      } catch (err: unknown) {
        lastError = err;
        retries--;
        if (retries >= 0) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (lastError instanceof TypeError && lastError.message.includes('fetch')) {
      setError('Unable to connect to the analysis engine. Please check your network connection or try again later.');
    } else {
      setError('Analysis failed. Please check the contract address and try again.');
    }
    setLoading(false);
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address: address || presets[0].address,
          score: Math.round(result.score || 0),
          liquidity: Math.round(result.liquidity || 0),
          collateral: Math.round(result.collateral || 0),
          audit: Math.round(result.audit || 0),
          security: Math.round(result.security || 0),
          volatility: Math.round(result.volatility_score || 0),
          governance: Math.round(result.governance || 0),
          tvl: result.market_benchmark || 0,
          protocol_name: result.protocol_name || "Unknown",
          data_hash: result.data_hash || "",
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
        setTxStatus(`Transaction submitted, but confirmation is taking longer than expected. You can check the status on the explorer using your transaction hash: ${data.txHash}`);
      }
    } catch (err: unknown) {
      setTxStep(0);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setTxStatus("❌ Unable to connect to the analysis engine. Please try again later.");
      } else {
        const e = err as Error;
        setTxStatus("❌ " + (e?.message || "Could not process the transaction. Please try again."));
      }
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
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-reveal { animation: fadeSlideUp 0.5s ease-out forwards; }
        @keyframes fillBar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
        .loading-dots::after {
          content: '';
          animation: dots 1.5s infinite;
        }
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .pulse-green {
          animation: pulseGreen 1s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-gradient-xy, .animate-reveal, .pulse-green, .loading-dots::after { animation: none !important; }
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
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent animate-gradient-xy bg-[length:400%_400%]">
              CreditPulse AI
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm shadow-inner text-xs font-mono font-medium hidden sm:flex">
            {backendStatus === 'checking' && (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
                </span>
                <span className="text-slate-400">Checking...</span>
              </>
            )}
            {backendStatus === 'online' && (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span className="text-emerald-400">Engine Online</span>
              </>
            )}
            {backendStatus === 'offline' && (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                </span>
                <span className="text-red-400">Engine Offline</span>
              </>
            )}
          </div>
          {onchainStats && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-950/40 rounded-xl border border-violet-700/40 backdrop-blur-sm text-xs font-mono font-medium hidden sm:flex" title="Live data read from Creditcoin smart contract">
              <span className="text-violet-400">⛓</span>
              <span className="text-violet-300">{onchainStats.total_reports_onchain} on-chain proofs</span>
            </div>
          )}
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            aria-label="View API Documentation"
            className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition-all duration-200 ease-out active:scale-95 font-mono hidden md:inline-block focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
              aria-label="Connect Web3 wallet (MetaMask, Coinbase, Trust, etc.)"
              onClick={connectWallet}
              className="px-5 py-2 md:py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-sm font-medium rounded-xl transition-all duration-200 ease-out active:scale-95 border border-slate-600 text-cyan-400 shadow-lg flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              🔗 Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Section */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16 mt-8 print:hidden">
          <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent pb-2">
            Autonomous RWA<br className="hidden md:block"/> Risk Assessment
          </h2>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">
            Instantly evaluate smart contract and protocol risk using decentralized credit intelligence and AI.
          </p>
        </div>

        {/* Input Form & Preset Chips */}
        <div className="mb-10 print:hidden">
          <form onSubmit={(e) => handleAnalyze(e)} className="mb-4">
            <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/90 p-3 rounded-[1.25rem] border border-slate-700 shadow-2xl backdrop-blur-md focus-within:border-cyan-500/50 focus-within:ring-4 focus-within:ring-cyan-500/10 transition-all">
              <input
                id="input-address"
                aria-label="Enter Ethereum contract address"
                type="text"
                placeholder="Enter a smart contract address (e.g., 0x...)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnalyze(e); } }}
                className="flex-1 bg-transparent px-5 py-4 text-base focus:outline-none text-white placeholder-slate-500 font-mono"
              />
              <button
                id="btn-analyze"
                aria-label="Analyze DeFi protocol risk"
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-base rounded-xl transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                {loading ? "Analyzing..." : "Analyze Protocol"}
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
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg border border-slate-800 transition-all duration-200 ease-out hover:scale-105 active:scale-95 font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
                    className="font-mono hover:text-cyan-400 text-slate-400 underline transition-all duration-200 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  >
                    {h.slice(0, 6)}...
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-16 text-center space-y-8 shadow-2xl my-10">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.8)]"></div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Analyzing protocol with live DeFiLlama data<span className="loading-dots text-cyan-400"></span></p>
              <p className="text-sm font-mono text-slate-400">Estimated time: ~3-5 seconds</p>
            </div>
          </div>
        )}

        {error && (
          <div className={`mb-6 p-4 ${error.startsWith('INFO:') ? 'bg-blue-950/50 border-2 border-blue-500/50 text-blue-400 shadow-blue-500/10' : 'bg-red-950 border-2 border-red-500 text-red-500 shadow-red-500/20'} rounded-xl text-sm flex justify-between items-center shadow-lg print:hidden font-medium`}>
            <div className="flex items-center gap-3">
              <span className="text-xl">{error.startsWith('INFO:') ? 'ℹ️' : '⚠️'}</span>
              <span>{error.startsWith('INFO:') ? error.slice(5) : error}</span>
            </div>
            <button onClick={() => setError("")} aria-label="Close notification" className={`${error.startsWith('INFO:') ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/50' : 'text-red-500 hover:text-red-400 hover:bg-red-900/50'} p-1.5 rounded-lg transition-all duration-200 ease-out active:scale-95 font-bold focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`}>
              ✕
            </button>
          </div>
        )}

        {/* Results Dashboard */}
        {!loading && result && (
          <section id="section-results" aria-labelledby="results-heading" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-reveal print:text-black print:bg-white">
            <h2 id="results-heading" className="sr-only">Analysis Results</h2>
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
                <p className="text-lg font-semibold text-slate-200 print:text-black">{result.rwa_type}</p>
                {result.protocol_name && result.protocol_name !== 'Unknown' && (
                  <p className='text-sm text-cyan-400 font-mono mt-1'>Protocol: {result.protocol_name}</p>
                )}

              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">Overall Credit Score</span>
                <div className="flex items-baseline gap-2">
                  <p className={`text-7xl md:text-8xl font-black tracking-tighter ${getScoreColor(result.score || 0).text} drop-shadow-lg print:text-emerald-700`}>{displayScore}</p>
                  <span className="text-2xl font-bold text-slate-500">/100</span>
                </div>
                <div className="mt-3">
                  <span className={`text-sm px-4 py-1 rounded-full border-2 font-bold tracking-wide uppercase ${getScoreColor(result.score || 0).text} border-current shadow-lg`}>
                    {getScoreText(result.score || 0)}
                  </span>
                </div>
                {typeof result.market_benchmark === 'number' && result.market_benchmark > 0 && (
                  <p className="text-sm font-mono text-slate-300 mt-4">Protocol TVL: <span className="text-white font-bold">${result.market_benchmark >= 1e9 ? (result.market_benchmark / 1e9).toFixed(2) + 'B' : result.market_benchmark >= 1e6 ? (result.market_benchmark / 1e6).toFixed(1) + 'M' : result.market_benchmark.toLocaleString()}</span></p>
                )}
              </div>
            </div>

            {/* Radar Chart & Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-80 md:h-96 w-full bg-slate-900/40 rounded-2xl p-4 border border-white/5 flex items-center justify-center shadow-inner print:border-gray-300">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={result.radarData}>
                    <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" stroke="#cbd5e1" tick={{ fill: "#cbd5e1", fontSize: 13, fontWeight: 500 }} />
                    <Radar name="Risk Index" dataKey="A" stroke="#22d3ee" strokeWidth={2} fill="#06b6d4" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div id="section-breakdown" className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4 print:text-gray-600">Detailed Breakdown</h3>
                {[
                  { label: "Liquidity Depth", value: result.liquidity || 0 },
                  { label: "Collateral Ratio", value: result.collateral || 0 },
                  { label: "Smart Contract Security", value: result.security || 0 },
                  { label: "Audit Verification", value: result.audit || 0 },
                  { label: "Volatility Index", value: result.volatility_score || 0 },
                  { label: "Governance Score", value: result.governance || 0 },
                ].map((item, index) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-300 font-medium print:text-gray-700">{item.label}</span>
                      <span className={`${getScoreColor(item.value).text} font-bold font-mono print:text-black`}>{item.value}%</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden border border-slate-700/50 print:bg-gray-200">
                      <div className="h-full origin-left" style={{ width: `${item.value}%` }}>
                        <div className={`${getScoreColor(item.value).bar} w-full h-full origin-left shadow-[0_0_10px_currentColor] print:bg-gray-500`} style={{ animation: `fillBar 0.8s ease-out both`, animationDelay: `${index * 0.1}s` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Verdict */}
            <div className={`${getVerdictStyle(result.verdict).box} border rounded-xl p-4 print:bg-gray-100 print:border-gray-300`}>
              <span className={`text-xs font-semibold ${getVerdictStyle(result.verdict).text} uppercase tracking-wider block mb-1 print:text-blue-800`}>
                🤖 Autonomous Agent Verdict
              </span>
              <p className="text-sm text-slate-300 leading-relaxed print:text-black">{result.verdict}</p>
            </div>

            {/* Gemini AI Narrative */}
            {result.ai_narrative && (
              <div className="bg-gradient-to-br from-violet-950/40 to-indigo-950/40 border border-violet-700/40 rounded-xl p-4 print:bg-gray-50 print:border-gray-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">✨ AI Risk Analysis</span>
                  <span className="text-xs px-2 py-0.5 bg-violet-900/50 text-violet-300 rounded-full border border-violet-700/40 font-mono">Powered by Gemini</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic print:text-black">&ldquo;{result.ai_narrative}&rdquo;</p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row gap-4 print:hidden">
              <button
                id="btn-record"
                aria-label="Record risk score on the Creditcoin blockchain"
                onClick={recordOnChain}
                disabled={txStep > 0 && txStep < 3}
                className={`flex-1 py-4 bg-gradient-to-r ${getButtonGradient(result.score || 0)} text-slate-950 font-extrabold text-base rounded-xl transition shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`}
              >
                🔗 Record Risk Score On-Chain
              </button>
              <button
                id="btn-export"
                aria-label="Export audit report as PDF"
                onClick={() => window.print()}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base rounded-xl transition border border-slate-600 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                📥 Export Report
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center print:hidden">
              💡 No wallet needed — our backend relayer signs transactions. Connect wallet optionally to verify your identity.
            </p>

            {txStep > 0 && (
              <div className={`mt-6 p-[2px] rounded-2xl ${txStep < 3 ? 'bg-gradient-to-r from-cyan-500 to-blue-600 animate-gradient-xy' : 'bg-slate-800 pulse-green'}`}>
                <div className="bg-slate-900 rounded-xl p-5 text-center space-y-4 h-full">
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>{txStep === 1 ? 'Submitting...' : txStep === 2 ? 'Confirming...' : 'Complete!'}</span>
                    <span>{txStep < 3 ? 'Estimated: ~15 seconds' : 'Done'}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-2 mb-4 overflow-hidden">
                    <div className="bg-cyan-500 h-full origin-left transition-transform duration-1000 ease-out" style={{ transform: `scaleX(${txStep === 1 ? 0.33 : txStep === 2 ? 0.66 : 1})` }}></div>
                  </div>
                  
                  <p className="text-sm font-mono text-emerald-400">
                    {txStep < 3 && <span className="animate-spin inline-block mr-2">⚙️</span>}
                    {txStatus}
                  </p>
                  
                  {txHash && (
                    <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-800/50">
                      {/* Attestcoin Protocol Badge */}
                      <div className="flex items-center gap-2 bg-emerald-950/50 px-4 py-2 rounded-xl border border-emerald-700/40">
                        <span className="text-emerald-400 text-sm font-semibold">🔗 Attestcoin Protocol</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">Verified</span>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800/80 w-fit">
                        <span className="text-xs text-slate-400 font-mono">Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                        <button 
                          aria-label="Copy transaction hash"
                          onClick={() => copyToClipboard(txHash)}
                          className="text-slate-400 hover:text-cyan-400 transition-all duration-200 ease-out active:scale-95 ml-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                          title="Copy to clipboard"
                        >
                          {isCopied ? "✓" : "📋"}
                        </button>
                      </div>

                      {/* Data Provenance — RAW inputs that went into the score */}
                      {result?.raw_inputs && Object.keys(result.raw_inputs).length > 0 && (
                        <div className="w-full max-w-sm bg-slate-950/80 rounded-xl border border-slate-800/60 p-3">
                          <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider mb-2">📊 Source Data (DeFiLlama)</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                            {result.raw_inputs.tvl !== undefined && (
                              <><span className="text-slate-500">TVL</span><span className="text-slate-300">${Number(result.raw_inputs.tvl).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></>
                            )}
                            {result.raw_inputs.change_1d !== undefined && result.raw_inputs.change_1d !== null && (
                              <><span className="text-slate-500">Change 1d</span><span className={`${Number(result.raw_inputs.change_1d) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(result.raw_inputs.change_1d).toFixed(2)}%</span></>
                            )}
                            {result.raw_inputs.change_7d !== undefined && result.raw_inputs.change_7d !== null && (
                              <><span className="text-slate-500">Change 7d</span><span className={`${Number(result.raw_inputs.change_7d) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(result.raw_inputs.change_7d).toFixed(2)}%</span></>
                            )}
                            {result.raw_inputs.category && (
                              <><span className="text-slate-500">Category</span><span className="text-slate-300">{result.raw_inputs.category}</span></>
                            )}
                            {result.raw_inputs.chains_count !== undefined && (
                              <><span className="text-slate-500">Chains</span><span className="text-slate-300">{result.raw_inputs.chains_count}</span></>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Data Hash — the verifiable provenance */}
                      {result?.data_hash && (
                        <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-mono">
                            dataHash: {result.data_hash.slice(0, 14)}...{result.data_hash.slice(-10)}
                          </p>
                          <p className="text-[9px] text-slate-600 mt-0.5">keccak256(raw_inputs) — stored on-chain, independently verifiable</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <a
                          href={`${EXPLORER_URL}${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="View transaction on Creditcoin block explorer"
                          className="inline-flex items-center justify-center px-5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-medium rounded-xl transition-all duration-200 ease-out active:scale-95 border border-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                        >
                          Explorer ↗
                        </a>
                        <a
                          href={`${API_URL}/api/methodology`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center px-5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-sm font-medium rounded-xl transition-all duration-200 ease-out active:scale-95 border border-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                        >
                          Verify Formula ↗
                        </a>
                      </div>
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
          <div className="mt-16 bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 md:p-14 text-center shadow-2xl backdrop-blur-xl print:hidden relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
            <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">How CreditPulse AI Works</h3>
            <p className="text-slate-300 text-base md:text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
              Our autonomous agent analyzes smart contracts in real-time, pulling live data to compute a comprehensive risk profile before you invest.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400 text-4xl mb-6 border border-blue-500/20 transition-all group-hover:scale-110 group-hover:bg-blue-500/20 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  🔍
                </div>
                <h4 className="text-slate-100 font-bold text-lg mb-3">1. Analyze</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Gathers real-time TVL, liquidity data, and on-chain security metrics.</p>
              </div>
              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-400 text-4xl mb-6 border border-purple-500/20 transition-all group-hover:scale-110 group-hover:bg-purple-500/20 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  🧮
                </div>
                <h4 className="text-slate-100 font-bold text-lg mb-3">2. Score</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Our AI engine evaluates multiple risk factors to generate a 0-100 credit score.</p>
              </div>
              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-400 text-4xl mb-6 border border-emerald-500/20 transition-all group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  🔗
                </div>
                <h4 className="text-slate-100 font-bold text-lg mb-3">3. Record</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Anchors an immutable proof of the risk assessment on-chain.</p>
              </div>
            </div>
            <div className="mt-14 pt-10 border-t border-white/5">
              <p className="text-base text-slate-300 font-medium mb-6">Analyze a sample protocol:</p>
              <div className="flex flex-wrap justify-center gap-4">
                {presets.map((preset, idx) => (
                  <button key={idx} aria-label={`Analyze ${preset.name}`} onClick={() => handleAnalyze(undefined, preset.address)} className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700 text-cyan-400 font-bold text-sm rounded-2xl transition hover:scale-105 active:scale-95 border border-slate-700 shadow-lg focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none">{preset.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className='max-w-4xl mx-auto mt-24 pt-8 border-t border-slate-800 text-center print:hidden pb-8'>
        <div className="flex flex-col items-center justify-center gap-4">
          <p className='text-sm text-slate-400 font-medium'>CreditPulse AI <span className="text-slate-600 px-2">v1.0.0</span></p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Built on <span className="text-emerald-400 font-medium">Creditcoin</span></span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span>Powered by <span className="text-blue-400 font-medium">DeFiLlama Oracles</span></span>
          </div>
          <div className="flex gap-6 mt-2 text-xs text-slate-500">
            <a href="#" className="hover:text-cyan-400 transition">Terms of Service</a>
            <a href="#" className="hover:text-cyan-400 transition">Privacy Policy</a>
            <a href="#" className="hover:text-cyan-400 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
