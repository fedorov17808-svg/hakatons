"use client";

import React from "react";
import { EXPLORER_URL } from "@/lib/config";

interface TxStatusPanelProps {
  txStep: number;
  txStatus: string;
  txHash: string;
  isCopied: boolean;
  onCopy: (hash: string) => void;
}

/**
 * Transaction Status Panel — shows submission progress,
 * transaction hash with copy button, and block explorer link.
 */
export function TxStatusPanel({
  txStep,
  txStatus,
  txHash,
  isCopied,
  onCopy,
}: TxStatusPanelProps) {
  if (txStep <= 0) return null;

  return (
    <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-4">
      <p className="text-sm font-mono text-emerald-400">{txStatus}</p>
      {txHash && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-mono">
              Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
            <button
              onClick={() => onCopy(txHash)}
              className="text-slate-400 hover:text-cyan-400"
            >
              {isCopied ? "✓" : "📋"}
            </button>
          </div>
          <a
            href={`${EXPLORER_URL}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cyan-400 hover:underline"
          >
            View on Creditcoin Block Explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
