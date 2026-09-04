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
  ai_recommendations?: string[];
  ai_model?: string;
  ai_powered?: boolean;
  ai_digest?: string;
  provenance?: {
    data_hash?: string;
    canonical_json?: string;
    hash_algorithm?: string;
    verification?: string;
  };
  eip712_attestation?: {
    signer: string;
    signature: string;
    r: string;
    s: string;
    v: number;
    domain: Record<string, string | number>;
    message: Record<string, string | number>;
  };
  raw_weighted_score?: number;
  scoring_engine?: string;
  ai_role?: string;
  ai_note?: string;
  seasoning_score?: number;
  weight_profile?: Record<string, number | string>;
  scoring_breakdown?: Record<string, unknown>;
  onchain_telemetry?: {
    is_contract?: boolean;
    bytecode_size?: number;
    transaction_count?: number;
    native_balance_eth?: number;
    native_balance_usd?: number;
    token_balances?: Array<{ symbol: string; balance: number; usd_value: number }>;
    total_portfolio_usd?: number;
    admin_type?: string;
    rpc_used?: string;
    live_eth_price_usd?: number;
    price_source?: string;
  };
  sources_used?: string[];
  quantitative_model?: {
    merton_default_prob?: number;
    distance_to_default_sigma?: number;
    var_99_10d_pct?: number;
    cvar_99_10d_pct?: number;
    lindy_seasoning_multiplier?: number;
    simulated_monte_carlo_paths?: number;
    risk_free_rate_pct?: number;
    rating_impact_points?: number;
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
  if (v.includes('LOW RISK') || v.includes('INSTITUTIONAL AAA')) return { box: 'bg-emerald-950/30 border-emerald-500', text: 'text-emerald-400' };
  if (v.includes('MODERATE') || v.includes('INVESTMENT GRADE')) return { box: 'bg-cyan-950/30 border-cyan-500', text: 'text-cyan-400' };
  if (v.includes('HIGH') || v.includes('CRITICAL')) return { box: 'bg-rose-950/30 border-rose-500', text: 'text-rose-400' };
  return { box: 'bg-blue-950/30 border-blue-800/30', text: 'text-blue-400' };
};

interface RiskMetricsProps {
  result: RiskResult;
}

export const RiskMetrics: React.FC<RiskMetricsProps> = ({ result }) => {
  const telem = result.onchain_telemetry;

  return (
    <div id="section-breakdown" className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest print:text-gray-600">
          Detailed Breakdown
        </h3>
        {result.circuit_breaker_active && (
          <span className="text-[10px] font-mono bg-rose-950/70 border border-rose-500/50 text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span>⚠️</span> Hard Cap Active
          </span>
        )}
      </div>

      {result.circuit_breaker_active && result.circuit_breaker_reason && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>🛡️</span> Anti-Manipulation Circuit Breaker
          </div>
          <p className="text-[11px] text-rose-300/80 leading-relaxed font-mono">
            {result.circuit_breaker_reason}
          </p>
        </div>
      )}

      {/* On-Chain Verifiable Solvency Summary */}
      {telem && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-mono flex items-center gap-1.5">
              <span>⚡</span> Verifiable On-Chain Balance:
            </span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              ${(telem.total_portfolio_usd || 0).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2 py-1">
              <span className="text-slate-500 block text-[9px]">ETH Balance</span>
              <span className="text-slate-200 font-bold">{telem.native_balance_eth ?? 0} ETH</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2 py-1">
              <span className="text-slate-500 block text-[9px]">Transaction Nonce</span>
              <span className="text-slate-200 font-bold">{telem.transaction_count ?? 0} txs</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2 py-1 col-span-2 sm:col-span-1">
              <span className="text-slate-500 block text-[9px]">
                {telem.price_source?.includes("Live") ? "Live Oracle Price" : "Oracle Price (Fallback)"}
              </span>
              {telem.live_eth_price_usd != null ? (
                <span className={`font-bold ${telem.price_source?.includes("Live") ? "text-cyan-300" : "text-amber-400"}`}>
                  ${telem.live_eth_price_usd.toLocaleString()}
                </span>
              ) : (
                <span className="text-slate-500 font-bold">—</span>
              )}
              {telem.price_source && (
                <span className="text-slate-600 block text-[8px] truncate">{telem.price_source}</span>
              )}
            </div>
          </div>

          {telem.token_balances && telem.token_balances.length > 0 && (
            <div className="pt-1 border-t border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-mono block mb-1">Detected ERC-20 Tokens:</span>
              <div className="flex flex-wrap gap-1.5">
                {telem.token_balances.map((t) => (
                  <span key={t.symbol} className="text-[10px] font-mono bg-cyan-950/50 border border-cyan-800/40 text-cyan-300 px-2 py-0.5 rounded">
                    {t.symbol}: {t.balance.toLocaleString()} (${t.usd_value.toLocaleString()})
                  </span>
                ))}
              </div>
            </div>
          )}
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

      {result.quantitative_model && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>📐</span> Merton (1974) & Monte Carlo Engine
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              1,000 paths • 99% CI
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-mono mb-1">Merton Default P(D)</div>
              <div className={`text-xs font-mono font-bold ${(result.quantitative_model.merton_default_prob || 0) < 0.05 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {((result.quantitative_model.merton_default_prob || 0) * 100).toFixed(2)}%
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-mono mb-1">Distance to Default</div>
              <div className="text-xs font-mono font-bold text-cyan-300">
                {result.quantitative_model.distance_to_default_sigma} σ
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-mono mb-1">10-day VaR (99%)</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                -{result.quantitative_model.var_99_10d_pct}%
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-mono mb-1">Lindy Multiplier</div>
              <div className="text-xs font-mono font-bold text-indigo-300">
                {result.quantitative_model.lindy_seasoning_multiplier}x
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
