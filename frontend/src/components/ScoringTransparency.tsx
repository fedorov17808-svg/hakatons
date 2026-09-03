"use client";

import React from "react";

interface ScoringTransparencyProps {
  scoringBreakdown?: Record<string, unknown>;
  weightProfile?: Record<string, unknown> | string;
  seasoningScore?: number;
  scoringEngine?: string;
  onchainTelemetry?: {
    governance_type?: string;
    governance_multisig_threshold?: number;
    governance_owner?: string;
    is_contract_governed?: boolean;
    is_proxy?: boolean;
    token_holdings?: Record<string, { amount: number; usd_value: number }>;
    rpc_used?: string;
  } | null;
}

/**
 * Scoring Transparency — weight profiles, seasoning (Lindy) score,
 * on-chain governance inspection, and per-dimension rationale breakdown.
 */
export function ScoringTransparency({
  scoringBreakdown,
  weightProfile,
  seasoningScore,
  scoringEngine,
  onchainTelemetry,
}: ScoringTransparencyProps) {
  if (!scoringBreakdown && !weightProfile && !onchainTelemetry) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/30 border border-indigo-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-indigo-400 text-lg">🔬</span>
        <span className="text-sm font-bold text-indigo-300">
          Scoring Transparency &amp; Methodology
        </span>
        {scoringEngine && (
          <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded font-mono">
            {scoringEngine}
          </span>
        )}
      </div>

      {/* On-Chain Governance Telemetry */}
      {onchainTelemetry && onchainTelemetry.governance_type && (
        <div className="bg-slate-950/70 p-3 rounded-lg border border-indigo-900/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              🏛️ On-Chain Governance Verification
            </span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
              onchainTelemetry.is_contract_governed
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}>
              {onchainTelemetry.governance_type}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1">
            {onchainTelemetry.governance_owner && (
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Admin / Owner</span>
                <span className="text-indigo-300 font-semibold truncate block">
                  {onchainTelemetry.governance_owner}
                </span>
              </div>
            )}
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Proxy Upgradability</span>
              <span className="text-slate-200 font-semibold">
                {onchainTelemetry.is_proxy ? "ERC1967/UUPS Proxy" : "Immutable / Non-Proxy"}
              </span>
            </div>
            {onchainTelemetry.rpc_used && (
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">EVM RPC Verification</span>
                <span className="text-slate-400 truncate block text-[11px]">
                  {onchainTelemetry.rpc_used.replace(/https?:\/\//, "")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weight Profile */}
      {weightProfile && (
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
            Sector-Adaptive Weight Profile
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
            {typeof weightProfile === "object" &&
            !Array.isArray(weightProfile) ? (
              Object.entries(weightProfile).map(([key, val]) => (
                <div
                  key={key}
                  className="flex flex-col bg-slate-900/60 p-2 rounded border border-slate-800/80"
                >
                  <span className="text-slate-400 capitalize text-[11px] truncate">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-indigo-300 font-bold text-sm">
                    {typeof val === "number"
                      ? `${(val * 100).toFixed(0)}%`
                      : String(val)}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-full text-indigo-300 font-medium">
                {String(weightProfile)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seasoning Score */}
      {seasoningScore !== undefined && (
        <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase">
            Seasoning (Lindy):
          </span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, seasoningScore)}%` }}
            ></div>
          </div>
          <span className="text-xs font-mono text-amber-300 font-bold">
            {seasoningScore}/100
          </span>
        </div>
      )}

      {/* Scoring Breakdown */}
      {scoringBreakdown && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Per-Dimension Rationale
          </span>
          {Object.entries(scoringBreakdown).map(([key, rationale]) => (
            <div
              key={key}
              className="flex items-start gap-2 text-xs bg-slate-950/40 p-2 rounded border border-slate-800/50"
            >
              <span className="text-indigo-400 font-mono font-bold min-w-[90px] capitalize">
                {key.replace(/_/g, " ")}:
              </span>
              <span className="text-slate-300">{String(rationale)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
