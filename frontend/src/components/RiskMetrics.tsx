"use client";

import React from "react";

export interface RiskResult {
  rwa_type?: string;
  protocol_name?: string;
  score?: number;
  deterministic_score?: number;
  market_benchmark?: number;
  liquidity?: number;
  collateral?: number;
  security?: number;
  audit?: number;
  volatility_score?: number;
  governance?: number;
  verdict?: string;
  circuit_breaker_active?: boolean;
  circuit_breaker_reason?: string | null;
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
  ai_risks?: string[];
  ai_powered?: boolean;
  ai_digest?: string;
  provenance?: {
    data_hash?: string;
    canonical_json?: string;
    hash_algorithm?: string;
    verification?: string;
  };
}

export const getScoreColor = (score: number) => {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (score >= 60) return { bar: 'bg-cyan-500', text: 'text-cyan-400' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
};

export const getScoreText = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
};

export const getVerdictStyle = (verdict?: string) => {
  const v = verdict || '';
  if (v.includes('LOW RISK')) return { box: 'bg-emerald-950/30 border-emerald-500', text: 'text-emerald-400' };
  if (v.includes('MODERATE')) return { box: 'bg-cyan-950/30 border-cyan-500', text: 'text-cyan-400' };
  if (v.includes('HIGH') || v.includes('CRITICAL')) return { box: 'bg-rose-950/30 border-rose-500', text: 'text-rose-400' };
  return { box: 'bg-blue-950/30 border-blue-800/30', text: 'text-blue-400' };
};

interface RiskMetricsProps {
  result: RiskResult;
}

export const RiskMetrics: React.FC<RiskMetricsProps> = ({ result }) => {
  return (
    <div id="section-breakdown" className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest print:text-gray-600">
          Detailed Breakdown
        </h3>
        {result.circuit_breaker_active && (
          <span className="text-[10px] font-mono bg-rose-950/70 border border-rose-500/50 text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span>⚠️</span> Circuit Breaker Clamped
          </span>
        )}
      </div>

      {result.circuit_breaker_active && result.circuit_breaker_reason && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>🛡️</span> Non-Linear Catastrophic Hard Cap Activated
          </div>
          <p className="text-[11px] text-rose-300/80 leading-relaxed font-mono">
            {result.circuit_breaker_reason}
          </p>
        </div>
      )}

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
              <div
                className={`${getScoreColor(item.value).bar} w-full h-full origin-left shadow-[0_0_10px_currentColor] print:bg-gray-500`}
                style={{ animation: `fillBar 0.8s ease-out both`, animationDelay: `${index * 0.1}s` }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
