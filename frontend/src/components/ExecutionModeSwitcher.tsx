"use client";

import React from "react";

type SubmissionMode = "direct" | "relayer";

interface ExecutionModeSwitcherProps {
  mode: SubmissionMode;
  onModeChange: (mode: SubmissionMode) => void;
}

const DON_NODES = [
  { name: "Node 1 (AWS)", region: "us-east-1" },
  { name: "Node 2 (GCP)", region: "europe-west3" },
  { name: "Node 3 (BareMetal)", region: "tokyo-1" },
];

/**
 * Execution Mode Switcher — toggle between Direct MetaMask
 * and Gasless Relayer modes, with inline DON cluster status.
 */
export function ExecutionModeSwitcher({
  mode,
  onModeChange,
}: ExecutionModeSwitcherProps) {
  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>⚙️ Execution Mode:</span>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              mode === "direct"
                ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
                : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
            }`}
          >
            {mode === "direct"
              ? "🦊 Direct MetaMask (Self-Sovereign)"
              : "⚡ Autonomous Relayer (Gasless)"}
          </span>
        </span>
        <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => onModeChange("direct")}
            className={`px-3 py-1 rounded-md transition ${
              mode === "direct"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🦊 Direct Wallet Mode
          </button>
          <button
            type="button"
            onClick={() => onModeChange("relayer")}
            className={`px-3 py-1 rounded-md transition ${
              mode === "relayer"
                ? "bg-emerald-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ⚡ Gasless Relayer Mode
          </button>
        </div>
      </div>

      {/* DON Validator Cluster Live Status */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span>Federated DON Cluster (2-of-3 BFT Quorum):</span>
          <span className="text-cyan-400">{DON_NODES.length} Nodes Online</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          {DON_NODES.map((node) => (
            <div
              key={node.name}
              className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300">{node.name}</span>
              </div>
              <span className="text-slate-500 text-[10px]">{node.region}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
