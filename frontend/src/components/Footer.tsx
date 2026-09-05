"use client";

import React from "react";
import { PROTOCOL_VERSION } from "@/lib/config";

export const Footer: React.FC = () => {
  return (
    <footer className="max-w-4xl mx-auto mt-24 pt-8 border-t border-slate-800 text-center print:hidden pb-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-slate-400 font-medium">
          CreditPulse AI <span className="text-cyan-400 font-mono text-xs px-2 py-0.5 bg-cyan-950/60 rounded border border-cyan-800/40 ml-2">v{PROTOCOL_VERSION} Enterprise</span>
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Built on <span className="text-emerald-400 font-medium">Creditcoin</span></span>
          <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
          <span>Powered by <span className="text-blue-400 font-medium">DeFiLlama Oracles</span> & <span className="text-violet-400 font-medium">Gemini AI</span></span>
        </div>
        <div className="flex gap-6 mt-2 text-xs text-slate-500">
          <a href="#" className="hover:text-cyan-400 transition">Terms of Service</a>
          <a href="#" className="hover:text-cyan-400 transition">Privacy Policy</a>
          <a href="https://github.com/fedorov17808-svg/hakatons" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition">GitHub</a>
        </div>
      </div>
    </footer>
  );
};
