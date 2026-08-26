"use client";

import React from "react";
import { getScoreColor, getScoreText } from "@/components/RiskMetrics";

interface ScoreHeaderProps {
  score: number;
  displayScore: number;
  rwaType: string;
  protocolName?: string;
  tvl?: string;
}

/**
 * Score Header — displays the large credit score, asset category,
 * protocol name, and TVL in the results dashboard header.
 */
export function ScoreHeader({
  score,
  displayScore,
  rwaType,
  protocolName,
  tvl,
}: ScoreHeaderProps) {
  const colors = getScoreColor(score);

  return (
    <div className="flex justify-between items-start border-b border-slate-800 pb-4 flex-wrap gap-4">
      <div>
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Asset Category</span>
        <p className="text-lg font-semibold text-slate-200">{rwaType}</p>
        {protocolName && protocolName !== "Unknown" && (
          <p className="text-sm text-cyan-400 font-mono mt-1">
            Protocol: {protocolName}
          </p>
        )}
        {tvl && (
          <p className="text-xs text-slate-500 font-mono mt-1">TVL: {tvl}</p>
        )}
      </div>
      <div className="text-right flex flex-col items-end">
        <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Overall Credit Score
        </span>
        <div className="flex items-baseline gap-2">
          <p
            className={`text-7xl md:text-8xl font-black tracking-tighter ${colors.text}`}
          >
            {displayScore}
          </p>
          <span className="text-2xl font-bold text-slate-500">/100</span>
        </div>
        <div className="mt-3">
          <span
            className={`text-sm px-4 py-1 rounded-full border-2 font-bold tracking-wide uppercase ${colors.text} border-current shadow-lg`}
          >
            {getScoreText(score)}
          </span>
        </div>
      </div>
    </div>
  );
}
