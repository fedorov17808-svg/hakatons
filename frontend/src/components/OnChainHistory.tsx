"use client";

import React from "react";

interface OnChainRecord {
  overallScore: number;
  timestamp: number;
  isFinalized: boolean;
  dataHash: string;
}

interface OnChainHistoryProps {
  records: OnChainRecord[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * On-Chain History — displays previous risk certificate records
 * stored on Creditcoin CC3, with finalization status badges.
 */
export function OnChainHistory({
  records,
  loading,
  onRefresh,
}: OnChainHistoryProps) {
  return (
    <div className="bg-slate-950/80 border border-indigo-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-indigo-300 uppercase tracking-wider flex items-center gap-2">
          <span>⛓️ On-Chain Risk Certificates &amp; Finality (Creditcoin CC3)</span>
          <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30">
            {records.length} On-Chain Records
          </span>
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline font-mono"
        >
          Refresh Chain
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 py-3 text-center font-mono">
          Querying CC3 Smart Contract...
        </div>
      ) : records.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {records.map((rec, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold ${
                    rec.overallScore >= 70
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {rec.overallScore}/100
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">
                  {new Date(rec.timestamp * 1000).toLocaleDateString()}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    rec.isFinalized
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-600/40"
                      : "bg-amber-950/80 text-amber-300 border border-amber-600/40"
                  }`}
                >
                  {rec.isFinalized ? "✓ FINALIZED" : "⏳ 3d DISPUTE WINDOW"}
                </span>
              </div>
              <div className="text-slate-500 text-[11px] truncate max-w-[150px]">
                {rec.dataHash.slice(0, 10)}...{rec.dataHash.slice(-6)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500 py-2 font-mono">
          No previous on-chain certificates recorded for this address yet.
        </div>
      )}
    </div>
  );
}
