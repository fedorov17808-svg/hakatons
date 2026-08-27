"use client";

import React from "react";

/**
 * Loading Spinner — pulsing orb with gradient animation
 * shown during DON cluster queries.
 */
export function LoadingSpinner() {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-16 text-center space-y-8 shadow-2xl my-10">
      <div className="relative w-24 h-24 mx-auto">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full animate-ping opacity-20"></div>
        <div className="relative w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
          <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.8)]"></div>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Querying Federated DON Cluster &amp; Multi-Token RPCs...
        </p>
        <p className="text-sm font-mono text-slate-400">Estimated time: ~2-4 seconds</p>
      </div>
    </div>
  );
}
