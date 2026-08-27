"use client";

import React from "react";

interface PoRData {
  coverage_percent: number;
  status: string;
  custodian: string;
  session_commitment?: string;
  reserve_ratio_bps: number;
}

interface ProofOfReserveCardProps {
  data: PoRData;
  txStep: number;
  onMintCert: () => void;
}

/**
 * Proof-of-Reserve Card — displays PoR attestation data
 * with custodian, TLS commitment, and reserve ratio.
 */
export function ProofOfReserveCard({
  data,
  txStep,
  onMintCert,
}: ProofOfReserveCardProps) {
  return (
    <div className="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-indigo-950/30 border border-emerald-500/40 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-lg">🏦</span>
          <span className="text-sm font-bold text-emerald-300">
            Cryptographic Proof-of-Reserve Attestation
          </span>
          <span className="bg-emerald-500/20 text-emerald-300 text-[11px] px-2.5 py-0.5 rounded font-mono font-bold">
            {data.coverage_percent}% Backed ({data.status})
          </span>
        </div>
        <button
          type="button"
          onClick={onMintCert}
          disabled={txStep > 0 && txStep < 3}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 shadow"
        >
          <span>📜 Mint PoR Cert on CC3</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-500 block text-[10px]">CUSTODIAN BANK</span>
          <span className="text-slate-200 font-medium">{data.custodian}</span>
        </div>
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-500 block text-[10px]">TLS COMMITMENT</span>
          <code className="text-cyan-300 block truncate">
            {data.session_commitment || "0x..."}
          </code>
        </div>
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-500 block text-[10px]">RESERVE RATIO</span>
          <span className="text-emerald-400 font-bold">
            {data.reserve_ratio_bps} BPS
          </span>
        </div>
      </div>
    </div>
  );
}
