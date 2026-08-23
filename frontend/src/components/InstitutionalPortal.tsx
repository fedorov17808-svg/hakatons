"use client";

import React, { useState } from "react";

export const InstitutionalPortal: React.FC = () => {
  const [queryVolume, setQueryVolume] = useState<number>(100000);
  const [activeCodeTab, setActiveCodeTab] = useState<"solidity" | "typescript" | "python">("solidity");
  const [copiedCode, setCopiedCode] = useState(false);

  // CTC Tokenomics Calculations
  const feePerQueryCTC = 0.5; // 0.5 CTC per query
  const totalRevenueCTC = queryVolume * feePerQueryCTC;
  const burnedCTC = totalRevenueCTC * 0.20;
  const nodeOperatorRewardCTC = totalRevenueCTC * 0.60;
  const insurancePoolCTC = totalRevenueCTC * 0.20;

  const codeSnippets = {
    solidity: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@creditpulse/contracts/interfaces/ICreditPulse.sol";

contract InstitutionalLending {
    ICreditPulse public immutable oracle = ICreditPulse(0x358925c5839a36bB2181786B8763Da0653B0f438);

    function originateLoan(address collateralAsset, uint256 amount) external {
        // 1-Line Credit Risk Gate
        ICreditPulse.RiskReport memory report = oracle.getRiskReport(collateralAsset);
        require(report.overallScore >= 75, "Collateral rating below institutional grade (AA/AAA)");

        // Dynamic risk-adjusted LTV
        uint256 ltv = report.overallScore >= 85 ? 90 : 80;
        uint256 maxBorrow = (amount * ltv) / 100;
        // ... Execute loan on Creditcoin CC3
    }
}`,
    typescript: `import { CreditPulseSDK } from "@creditpulse/sdk";

const sdk = new CreditPulseSDK("https://rpc.cc3-testnet.creditcoin.network");

async function checkAsset(assetAddress: string) {
  const report = await sdk.getRiskReport(assetAddress);
  console.log(\`Credit Rating: \${report.overall}/100\`);
  
  const terms = sdk.calculateLoanTerms(report.overall);
  console.log(\`Approved Tier: \${terms.tier} | Max LTV: \${terms.ltvPercent}% | APR: \${terms.aprPercent}%\`);
}`,
    python: `from web3 import Web3

w3 = Web3(Web3.HTTPProvider("https://rpc.cc3-testnet.creditcoin.network"))
CONTRACT_ADDRESS = "0x358925c5839a36bB2181786B8763Da0653B0f438"

# Query CreditPulse directly via EVM RPC
report = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI).functions.getRiskReport(asset_address).call()
print(f"Credit Score: {report[1]}/100, Verified by: {report[12]}")`
  };

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadPitchDeck = () => {
    const pitchDeckMd = `# 🚀 CreditPulse AI — Seed Round Pitch Deck & Executive Summary
**Track:** Creditcoin Ecosystem / RWA Credit Infrastructure
**Stage:** Testnet CC3 Operational / Post-Hackathon Seed Round ($500,000)
**Network Anchor:** Creditcoin CC3 (Chain ID: 102031)
**Smart Contract:** \`0x358925c5839a36bB2181786B8763Da0653B0f438\` (Verified on Blockscout)

---

## 1. Executive Summary
CreditPulse AI is the decentralized institutional credit rating oracle for Real-World Assets (RWA) and undercollateralized lending protocols on Creditcoin. By combining 5-layer deterministic anti-manipulation mathematical models, Explainable AI (XAI), and native Creditcoin Query Verifier precompiles (\`0x0FD2\`), CreditPulse provides continuous, tamper-proof credit ratings to unlock the $16 Trillion tokenized asset market.

## 2. Market Opportunity
* **$16T RWA Tokenization Market (by 2030 - BCG Report)**
* **$1.7T Traditional Private Debt moving on-chain**
* **The Void:** Zero standardized, real-time on-chain credit bureaus exist for decentralized private credit.

## 3. Technology Moat
1. **Creditcoin Hardware Precompile (\`0x0FD2\`):** Native cross-chain proof inclusion without trusted bridges.
2. **Federated DON Quorum (2-of-3 BFT):** Multi-node validator signatures in ascending address order.
3. **5-Layer Circuit Breakers:** Anti-Flash-Loan Caps, Lindy Longevity Curves, TWAP Damping.
4. **zkTLS Proof-of-Reserve:** RFC 8446 cryptographic session commitment for off-chain bank balances.

## 4. Tokenomics & $CTC Value Accrual
* **Per-Query Fees:** 0.5 CTC per oracle request.
* **Fee Burn:** 20% of all protocol fees permanently burned from $CTC supply.
* **Staking & Slashing:** 1,000+ CTC bonded per DON node to ensure cryptographic honesty.
* **Insurance Pool:** 20% reserved for protocol lender compensation during disputes.

## 5. Traction & Milestones
* **Smart Contracts:** 27/27 Passing Unit & Integration Tests.
* **E2E Test Suite:** 8/8 Pytest Verification Phases Passed.
* **Developer SDK:** \`@creditpulse/sdk\` launched for Solidity, TypeScript, and Python.

## 6. The Ask
Raising **$500,000 Seed Round** for 18-month runway:
* **40% Protocol Security & Audits** (CertiK / OpenZeppelin)
* **35% Core Engineering & zkTLS Enclave Provers**
* **25% Ecosystem Partnerships & Liquidity Growth on Creditcoin CC3**
`;

    const blob = new Blob([pitchDeckMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CreditPulse_Seed_Pitch_Deck_v7.2.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="max-w-6xl mx-auto mt-16 px-4">
      <div className="bg-slate-950/90 border border-indigo-500/30 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-10">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💼</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Institutional Portal & Developer Ecosystem
              </h2>
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs px-3 py-1 rounded-full font-mono font-bold">
                Seed Ready
              </span>
            </div>
            <p className="text-slate-400 text-sm">
              Explore B2B Oracle Unit Economics, $CTC Deflationary Mechanics, and 1-Line Protocol SDKs.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadPitchDeck}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center gap-2"
          >
            <span>📥 Download Seed Pitch Deck (Markdown)</span>
          </button>
        </div>

        {/* 2-Column Grid: Tokenomics Simulator & Developer SDK */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: B2B Oracle Fee & CTC Tokenomics Simulator */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚡ $CTC Utility & Burn Simulator</span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                0.5 CTC / Query
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Monthly Query Volume:</span>
                <span className="text-white font-bold">{queryVolume.toLocaleString()} queries/mo</span>
              </div>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={queryVolume}
                onChange={(e) => setQueryVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>10K (Initial Pilot)</span>
                <span>500K (DeFi Growth)</span>
                <span>1M (Institutional Mainnet)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-rose-500/20">
                <div className="text-xs text-rose-400 font-bold mb-1">🔥 20% Burn</div>
                <div className="text-base font-extrabold text-white">{burnedCTC.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">CTC Destroyed</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/20">
                <div className="text-xs text-emerald-400 font-bold mb-1">🛡️ 60% Nodes</div>
                <div className="text-base font-extrabold text-white">{nodeOperatorRewardCTC.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">CTC Validator APR</div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-500/20">
                <div className="text-xs text-cyan-400 font-bold mb-1">🏦 20% Pool</div>
                <div className="text-base font-extrabold text-white">{insurancePoolCTC.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">CTC Insurance Reserve</div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">💡 Economic Moat:</div>
              <p className="text-[11px] leading-relaxed">
                Every credit assessment executed on Creditcoin CC3 permanently destroys CTC supply while rewarding decentralized DON validator nodes and capitalizing a lender default reserve.
              </p>
            </div>
          </div>

          {/* Right Column: 1-Line Protocol SDK Integration */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🛠️ 1-Line Protocol SDK</span>
                </h3>
                
                {/* Code Tabs */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                  {(["solidity", "typescript", "python"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-2.5 py-1 rounded transition capitalize ${
                        activeCodeTab === tab
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-60 leading-relaxed">
                  <code>{codeSnippets[activeCodeTab]}</code>
                </pre>
                
                <button
                  type="button"
                  onClick={copyCode}
                  className="absolute top-3 right-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono transition border border-slate-700"
                >
                  {copiedCode ? "✅ Copied" : "📋 Copy"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 font-mono border-t border-slate-800/80">
              <span>NPM Package: <code className="text-indigo-400">@creditpulse/sdk</code></span>
              <a
                href="https://github.com/fedorov17808-svg/hakatons"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>GitHub SDK Repo ↗</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
