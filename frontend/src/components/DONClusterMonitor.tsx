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
  if (nodes.length === 0) return null;

  const onlineCount = nodes.filter(n => n.status === "online" || n.latency_ms > 0).length;

  return (
    <div className="mb-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl print:hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${onlineCount >= 2 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>Active DON Validator Cluster</span>
        </span>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
          BFT Quorum: 2-of-3
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        {nodes.map((n) => (
          <div key={n.node_id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5 transition-all hover:border-cyan-800/40">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">{n.name.split(' ')[2] || n.node_id}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                n.latency_ms > 0 && n.latency_ms < 100
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : n.latency_ms >= 100
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-red-400 bg-red-500/10'
              }`}>
                {n.latency_ms > 0 ? `${n.latency_ms}ms` : 'offline'}
              </span>
            </div>
            <span className="text-slate-500 block text-[10px]">{n.region}</span>
            <code className="text-[10px] text-cyan-400/80 block truncate">
              {n.address}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
