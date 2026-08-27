"use client";

import React from "react";

interface AIAdvisoryProps {
  narrative: string;
  risks?: string[];
}

/**
 * AI Advisory — Gemini AI qualitative risk narrative
 * with severity-tagged risk vectors.
 */
export function AIAdvisory({ narrative, risks }: AIAdvisoryProps) {
  return (
    <div className="bg-gradient-to-br from-violet-950/40 via-indigo-950/30 to-slate-900/50 border border-violet-700/40 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
            ✨ Institutional Qualitative Advisory
          </span>
          <span className="text-xs px-2.5 py-0.5 bg-violet-900/50 text-violet-300 rounded-full border border-violet-700/40 font-mono">
            Gemini AI
          </span>
        </div>
        <span className="text-xs px-2.5 py-0.5 bg-emerald-950/50 text-emerald-300 rounded-full border border-emerald-700/40 font-mono">
          ✓ Deterministic Core Verified
        </span>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-900/60 p-3.5 rounded-lg border border-violet-900/30">
        &ldquo;{narrative}&rdquo;
      </p>
      {risks && risks.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-violet-800/30 space-y-2">
          <span className="text-xs text-violet-400/80 font-semibold uppercase tracking-wider">
            Specific Risk Vectors
          </span>
          {risks.map((risk, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-slate-300"
            >
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 mt-0.5 ${
                  risk.includes("[HIGH]")
                    ? "bg-rose-950/60 text-rose-300 border-rose-700/50"
                    : risk.includes("[MED]")
                    ? "bg-amber-950/60 text-amber-300 border-amber-700/50"
                    : "bg-cyan-950/60 text-cyan-300 border-cyan-700/50"
                }`}
              >
                {risk.includes("[HIGH]")
                  ? "HIGH"
                  : risk.includes("[MED]")
                  ? "MED"
                  : "INFO"}
              </span>
              <span>
                {risk.replace(/\[(HIGH|MED|LOW|INFO)\]\s*/g, "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
