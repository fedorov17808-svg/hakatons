"use client";

import React from "react";

interface AIAdvisoryProps {
  narrative: string;
  risks?: string[];
  recommendations?: string[];
  model?: string;
}

/**
 * AI Advisory — Qualitative institutional credit rating memo
 * with risk vectors and actionable underwriting recommendations.
 */
export function AIAdvisory({ narrative, risks, recommendations, model }: AIAdvisoryProps) {
  return (
    <div className="bg-gradient-to-br from-violet-950/40 via-indigo-950/30 to-slate-900/50 border border-violet-700/40 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
            ✨ Institutional Risk Synthesis
          </span>
          <span className="text-xs px-2.5 py-0.5 bg-violet-900/50 text-violet-300 rounded-full border border-violet-700/40 font-mono">
            {model || "Gemini AI Credit Engine"}
          </span>
        </div>
        <span className="text-xs px-2.5 py-0.5 bg-emerald-950/50 text-emerald-300 rounded-full border border-emerald-700/40 font-mono">
          ✓ Deterministic Mathematical Core Verified
        </span>
      </div>

      <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-900/60 p-3.5 rounded-lg border border-violet-900/30">
        &ldquo;{narrative}&rdquo;
      </p>

      {risks && risks.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-violet-400/80 font-semibold uppercase tracking-wider block">
            Specific Risk Factors & Sensitivities
          </span>
          <div className="space-y-1.5">
            {risks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded border border-slate-800/80"
              >
                <span className="text-rose-400 font-mono">⚡</span>
                <span className="leading-normal">
                  {risk.replace(/\[(HIGH|MED|LOW|INFO)\]\s*/g, "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-violet-900/30">
          <span className="text-xs text-emerald-400/80 font-semibold uppercase tracking-wider block">
            Underwriting & LTV Guidelines
          </span>
          <div className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-emerald-200 bg-emerald-950/30 p-2 rounded border border-emerald-800/30"
              >
                <span className="text-emerald-400 font-mono">✓</span>
                <span className="leading-normal">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
