"use client";

import React from "react";
import { EXPLORER_URL } from "@/lib/config";

interface TxStatusPanelProps {
  txStep: number;
  txStatus: string;
  txHash: string;
  isCopied: boolean;
  onCopy: (hash: string) => void;
  explorerUrl?: string | null;
  isOnchain?: boolean;
}

/**
 * Transaction Status Panel — shows submission progress,
 * transaction / attestation hash with copy button, and block explorer link.
 */
export function TxStatusPanel({
  txStep,
  txStatus,
  txHash,
  isCopied,
  onCopy,
  explorerUrl,
  isOnchain = true,
}: TxStatusPanelProps) {
  if (txStep <= 0) return null;

  const finalExplorerUrl = explorerUrl || `${EXPLORER_URL}${txHash}`;

  return (
    <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-4">
      <p className="text-sm font-mono text-emerald-400">{txStatus}</p>
      {txHash && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-mono">
              {isOnchain ? "Tx" : "Proof Digest"}: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
            <button
              onClick={() => onCopy(txHash)}
              className="text-slate-400 hover:text-cyan-400 cursor-pointer"
              title="Copy to clipboard"
            >
              {isCopied ? "✓" : "📋"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <a
              href={finalExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono"
            >
              {isOnchain ? "View Transaction on Creditcoin Explorer ↗" : "View ASC Contract on Blockscout ↗"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
