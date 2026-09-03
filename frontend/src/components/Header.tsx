"use client";

import React from "react";
import Link from "next/link";

interface HeaderProps {
  backendStatus: 'checking' | 'online' | 'offline';
  onchainStats: { total_reports_onchain: number; verified_cross_chain_proofs: number; block_number: number } | null;
  account: string | null;
  connectWallet: () => void;
  apiUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  backendStatus,
  onchainStats,
  account,
  connectWallet,
  apiUrl,
}) => {
  return (
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
        <nav className="hidden md:flex items-center gap-4 ml-6 pl-6 border-l border-slate-800">
          <Link href="/dashboard" className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition">Dashboard</Link>
          <Link href="/explorer" className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition">Explorer</Link>
          <Link href="/docs" className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition">Docs</Link>
          <Link href="/waitlist" className="text-xs font-semibold px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition">Early Access</Link>
        </nav>
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
          href={`${apiUrl}/docs`}
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
            aria-label="Connect Web3 wallet"
            onClick={connectWallet}
            className="px-5 py-2 md:py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-sm font-medium rounded-xl transition-all duration-200 ease-out active:scale-95 border border-slate-600 text-cyan-400 shadow-lg flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            🔗 Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
};
