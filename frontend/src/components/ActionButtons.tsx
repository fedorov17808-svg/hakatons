"use client";

import React from "react";

type SubmissionMode = "direct" | "relayer";

interface ActionButtonsProps {
  submissionMode: SubmissionMode;
  txStep: number;
  onSubmitDirect: () => void;
  onSubmitRelayer: () => void;
  onExport: () => void;
}

/**
 * Action Buttons — primary submit (MetaMask / Relayer),
 * export dossier, and print/PDF.
 */
export function ActionButtons({
  submissionMode,
  txStep,
  onSubmitDirect,
  onSubmitRelayer,
  onExport,
}: ActionButtonsProps) {
  const isSubmitting = txStep > 0 && txStep < 3;

  return (
    <div className="pt-2 flex flex-col gap-3">
      <button
        id="btn-record-main"
        onClick={submissionMode === "direct" ? onSubmitDirect : onSubmitRelayer}
        disabled={isSubmitting}
        className={`py-4 ${
          submissionMode === "direct"
            ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white"
            : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950"
        } font-black text-base rounded-xl transition shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2`}
      >
        {submissionMode === "direct" ? (
          <span>🦊 Submit via MetaMask (Direct Multi-Signed DON Quorum)</span>
        ) : (
          <span>⚡ Submit via Gasless Relayer Node (1-Click Autonomous)</span>
        )}
      </button>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          id="btn-export-md"
          onClick={onExport}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-sm rounded-xl transition border border-cyan-500/30 flex items-center justify-center gap-2"
        >
          📥 Export Enterprise Dossier (.md)
        </button>
        <button
          id="btn-print"
          onClick={() => window.print()}
          className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition border border-slate-700 flex items-center justify-center gap-2"
        >
          🖨️ Print / PDF
        </button>
      </div>
    </div>
  );
}
