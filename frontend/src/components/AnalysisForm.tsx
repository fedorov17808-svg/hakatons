"use client";

import React from "react";
import { PRESET_ASSETS } from "@/lib/config";

interface PresetItem {
  name: string;
  address: string;
}

interface AnalysisFormProps {
  address: string;
  loading: boolean;
  history: string[];
  onAddressChange: (value: string) => void;
  onAnalyze: (e?: React.FormEvent, presetAddress?: string) => void;
}

/**
 * Analysis Input Form with Quick Preset Chips & Recent History
 * Handles address input, form submission, and preset/history shortcuts.
 */
export function AnalysisForm({
  address,
  loading,
  history,
  onAddressChange,
  onAnalyze,
}: AnalysisFormProps) {
  return (
    <div className="mb-10 print:hidden">
      <form onSubmit={(e) => onAnalyze(e)} className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/90 p-3 rounded-[1.25rem] border border-slate-700 shadow-2xl backdrop-blur-md focus-within:border-cyan-500/50 focus-within:ring-4 focus-within:ring-cyan-500/10 transition-all">
          <input
            id="input-address"
            aria-label="Enter EVM Contract or Institutional Account Address"
            type="text"
            placeholder="Enter EVM Contract or Institutional Account Address (0x...)"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAnalyze(e);
              }
            }}
            className="flex-1 bg-transparent px-5 py-4 text-base focus:outline-none text-white placeholder-slate-500 font-mono"
          />
          <button
            id="btn-analyze"
            aria-label="Analyze credit and solvency risk"
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-base rounded-xl transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            {loading ? "Analyzing..." : "Analyze Credit Risk"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono font-medium">Institutional Registry:</span>
          {PRESET_ASSETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAnalyze(undefined, preset.address)}
              className="text-xs bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg border border-slate-800/80 transition-all duration-200 ease-out hover:border-cyan-500/40 flex items-center gap-1.5 font-medium"
            >
              <span>{preset.name}</span>
              <span className="text-[10px] text-cyan-400/80 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20 font-mono">
                {preset.category}
              </span>
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Recent:</span>
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => onAnalyze(undefined, h)}
                className="font-mono hover:text-cyan-400 text-slate-400 underline transition-all"
              >
                {h.slice(0, 6)}...
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
