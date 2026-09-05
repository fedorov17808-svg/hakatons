"use client";

import React, { useState } from "react";

interface LendingSimulatorProps {
  score: number;
  protocolName?: string;
}

export function LendingSimulator({ score, protocolName }: LendingSimulatorProps) {
  const [collateralAmount, setCollateralAmount] = useState<number>(100000); // $100,000 USD default

  // Mathematical LTV & Interest Curve based on CreditPulse Score (0-100).
  // Boundaries match the verdict tiers in /api/analyze/route.ts (>=85/70/50/30)
  // so the same score never shows "AAA" in one panel and "AA" in another.
  // Score 85-100: AAA Tier -> 85% LTV, 3.2% APR, 92% Liquidation Threshold
  // Score 70-84:  AA Tier  -> 78% LTV, 4.5% APR, 86% Liquidation Threshold
  // Score 50-69:  A Tier   -> 68% LTV, 6.2% APR, 78% Liquidation Threshold
  // Score 30-49:  BBB Tier -> 55% LTV, 8.5% APR, 68% Liquidation Threshold
  // Score <30:    High Risk-> 40% LTV, 13.5% APR, 55% Liquidation Threshold

  let tier = "High Risk";
  let ltvBps = 4000;
  let interestApr = 13.5;
  let liquidationThresholdBps = 5500;
  let color = "text-rose-400";
  let badgeClass = "bg-rose-500/10 border-rose-500/30 text-rose-400";

  if (score >= 85) {
    tier = "Institutional AAA (Sovereign)";
    ltvBps = 8500;
    interestApr = 3.2;
    liquidationThresholdBps = 9200;
    color = "text-emerald-400";
    badgeClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  } else if (score >= 70) {
    tier = "Investment Grade AA";
    ltvBps = 7800;
    interestApr = 4.5;
    liquidationThresholdBps = 8600;
    color = "text-cyan-400";
    badgeClass = "bg-cyan-500/10 border-cyan-500/30 text-cyan-400";
  } else if (score >= 50) {
    tier = "Active Counterparty A";
    ltvBps = 6800;
    interestApr = 6.2;
    liquidationThresholdBps = 7800;
    color = "text-blue-400";
    badgeClass = "bg-blue-500/10 border-blue-500/30 text-blue-400";
  } else if (score >= 30) {
    tier = "Moderate Grade BBB";
    ltvBps = 5500;
    interestApr = 8.5;
    liquidationThresholdBps = 6800;
    color = "text-amber-400";
    badgeClass = "bg-amber-500/10 border-amber-500/30 text-amber-400";
  }

  const ltvPercent = ltvBps / 100;
  const maxBorrow = (collateralAmount * ltvBps) / 10000;
  const standardBorrow = (collateralAmount * 5000) / 10000; // Standard 50% LTV baseline in traditional DeFi
  const capitalEfficiencyGain = maxBorrow - standardBorrow;
  const annualInterestCost = (maxBorrow * interestApr) / 100;

  return (
    <div className="mt-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏦</span>
            <h3 className="text-lg font-bold text-white">
              Institutional Credit Terms Simulator
            </h3>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeClass}`}>
              {tier}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time loan terms underwritten by CreditPulse on-chain score ({score}/100) via <code className="text-cyan-400 font-mono">CreditPulseLendingPool.sol</code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-slate-400">Collateral Deposit:</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">$</span>
            <input
              type="number"
              min="1000"
              step="5000"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(Math.max(0, Number(e.target.value)))}
              className="bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono w-32 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Dynamic Max LTV</div>
          <div className={`text-2xl font-black ${color}`}>{ltvPercent}%</div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">vs 50.0% Standard</div>
        </div>

        <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Maximum Borrowable</div>
          <div className="text-2xl font-black text-white font-mono">
            ${maxBorrow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className={`text-[11px] font-semibold mt-1 ${capitalEfficiencyGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {capitalEfficiencyGain >= 0 ? `+$${capitalEfficiencyGain.toLocaleString('en-US')} bonus capacity` : `-$${Math.abs(capitalEfficiencyGain).toLocaleString('en-US')} risk cap`}
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Risk-Adjusted APR</div>
          <div className="text-2xl font-black text-cyan-300 font-mono">{interestApr}%</div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Est. Cost: ${annualInterestCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}/yr
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border border-slate-800/90 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Liquidation Buffer</div>
          <div className="text-2xl font-black text-purple-300 font-mono">{(liquidationThresholdBps / 100)}%</div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Safety margin: +{((liquidationThresholdBps - ltvBps) / 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rationale Callout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-xs">
        <div className="flex items-center gap-2 text-cyan-200">
          <span>💡</span>
          <span>
            {score >= 75
              ? `High creditworthiness (${score}/100) unlocks prime institutional borrowing rates and higher leverage on Creditcoin CC3.`
              : `Lower score (${score}/100) triggers automated overcollateralization safeguards and higher risk premium to protect lenders.`}
          </span>
        </div>
        <a
          href="https://creditcoin-testnet.blockscout.com/address/0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] whitespace-nowrap underline flex items-center gap-1"
        >
          Verify Oracle Proof On-Chain ↗
        </a>
      </div>
    </div>
  );
}
