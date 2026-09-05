"use client";

import React from "react";
import { DONNodeItem } from "@/lib/config";

interface DONClusterMonitorProps {
  nodes: DONNodeItem[];
}

/**
 * Federated DON Validator Cluster Monitor
 * Displays real-time status and latency of oracle validator nodes.
 */
export function DONClusterMonitor({ nodes }: DONClusterMonitorProps) {
  // Reserve the same footprint while node data is still loading, so it doesn't
  // pop in and shift everything below it down a second or two after page load.
  if (nodes.length === 0) {
    return (
      <div className="mb-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl print:hidden animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-48 bg-slate-800 rounded"></div>
          <div className="h-4 w-28 bg-slate-800 rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 h-[72px]"></div>
          ))}
        </div>
      </div>
    );
  }

  const isOnline = (n: DONNodeItem) => (n.status || "").toUpperCase() === "ONLINE";
  const onlineCount = nodes.filter(isOnline).length;
  const isLocalFallback = nodes.some(n => (n.source || "").toUpperCase() === "LOCAL_FALLBACK");

  return (
    <div className="mb-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl print:hidden">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${onlineCount >= 2 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>{onlineCount >= 2 ? 'Active DON Validator Cluster' : 'DON Validator Cluster (Local Fallback)'}</span>
        </span>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
          onlineCount >= 2
            ? 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30'
            : 'text-amber-400 bg-amber-950/50 border-amber-500/30'
        }`}>
          BFT Quorum: 2-of-3
        </span>
      </div>
      {isLocalFallback && (
        <p className="text-[11px] text-amber-300/80 leading-relaxed mb-3">
          🔶 Remote validator nodes are unreachable — signatures are produced via local deterministic key derivation for testnet compatibility, not by live distributed nodes.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        {nodes.map((n, idx) => {
          const online = isOnline(n);
          return (
            <div key={n.node_id || n.address || `node-${idx}`} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5 transition-all hover:border-cyan-800/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">{n.name || n.node_id}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  online
                    ? (n.latency_ms > 0 && n.latency_ms < 100 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10')
                    : 'text-red-400 bg-red-500/10'
                }`}>
                  {online ? `${n.latency_ms}ms` : (n.status || 'OFFLINE')}
                </span>
              </div>
              <span className="text-slate-500 block text-[10px]">{n.region}</span>
              <code className="text-[10px] text-cyan-400/80 block truncate">
                {n.address}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}
