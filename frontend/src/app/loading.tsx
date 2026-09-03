"use client";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
        <p className="text-cyan-300/80 text-sm font-medium tracking-wider animate-pulse">
          Loading CreditPulse AI...
        </p>
      </div>
    </div>
  );
}
