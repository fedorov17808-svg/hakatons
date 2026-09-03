"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function DocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const TS_SDK_CODE = `import { CreditPulseClient } from "@creditpulse/sdk";

// Initialize client connected to Creditcoin CC3
const client = new CreditPulseClient({
  network: "cc3-testnet",
  contractAddress: "0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5"
});

// Analyze counterparty credit risk
const report = await client.analyzeProtocol("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2");

console.log(\`Credit Score: \${report.overall}/100 [Rating: \${report.rating}]\`);
console.log(\`1-Year Merton Default Probability: \${(report.mertonDefaultProb * 100).toFixed(2)}%\`);
console.log(\`99% 10-Day VaR: \${report.var99}%\`);

// Verify cryptographic BFT signature on Creditcoin CC3
const isValid = await client.verifyReportOnChain(report);
console.log("On-chain Oracle Signature Valid:", isValid);`;

  const SOLIDITY_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICreditPulse {
    function getAssetReportHistory(address _asset) 
        external 
        view 
        returns (uint8 overallScore, uint40 timestamp, bool isFinalized);
        
    function saveRiskReportMultiSigned(
        address _asset,
        uint8[7] calldata _scores,
        bytes32 _dataHash,
        bytes32 _aiDigest,
        address[] calldata _signers,
        bytes[] calldata _signatures
    ) external;
}

contract InstitutionalLendingPool {
    ICreditPulse public immutable creditPulseOracle;
    uint8 public constant MINIMUM_INVESTMENT_GRADE = 65; // AA Tier

    constructor(address _oracle) {
        creditPulseOracle = ICreditPulse(_oracle);
    }

    /// @notice Originate institutional loan with dynamic LTV based on real-time credit rating
    function borrow(address collateralAsset, uint256 amount) external {
        (uint8 score, uint40 timestamp, ) = creditPulseOracle.getAssetReportHistory(collateralAsset);
        
        require(score >= MINIMUM_INVESTMENT_GRADE, "Collateral below investment grade");
        require(block.timestamp - timestamp < 1 days, "Credit report expired");
        
        // AAA Tier (80-100) -> 85% LTV, AA Tier (65-79) -> 70% LTV
        uint256 ltvBps = score >= 80 ? 8500 : 7000;
        
        // Execute loan origination...
    }
}`;

  const CURL_CODE = `# Analyze counterparty credit score & jump-diffusion risk
curl -X POST https://api.creditpulse.ai/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"}'`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[300px] bg-cyan-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[250px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
            <span>⚡</span> CreditPulse AI
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition">Risk Terminal</Link>
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">Dashboard</Link>
            <Link href="/explorer" className="text-slate-400 hover:text-white transition">Explorer</Link>
            <Link href="/docs" className="text-cyan-400 font-semibold">Docs</Link>
            <Link href="/waitlist" className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition font-medium">Early Access</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase mb-4 shadow-inner">
            Developer Documentation & API
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Integration Guide & SDK
          </h1>
          <p className="text-slate-400 text-base max-w-2xl leading-relaxed">
            Integrate CreditPulse autonomous credit scoring into your DeFi lending pool, RWA Treasury, or risk analytics platform on Creditcoin CC3.
          </p>
        </div>

        {/* Quick Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="text-cyan-400 text-2xl mb-2">⚡</div>
            <h3 className="font-bold text-white text-sm mb-1">Sub-Second Evaluation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Merton (1974) distance-to-default + 1000-path Monte Carlo jump-diffusion calculated in under 3s.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="text-emerald-400 text-2xl mb-2">🛡️</div>
            <h3 className="font-bold text-white text-sm mb-1">Native 0x0FD2 Precompile</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Cryptographic hardware-level transaction verification directly anchored on Creditcoin CC3.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="text-purple-400 text-2xl mb-2">📦</div>
            <h3 className="font-bold text-white text-sm mb-1">TypeScript & Solidity SDK</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Type-safe SDK with built-in multi-source fallback and EIP-712 signer validation.</p>
          </div>
        </div>

        {/* Section 1: TypeScript SDK */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">1. TypeScript SDK Integration</h2>
              <p className="text-xs text-slate-400">Install <code>@creditpulse/sdk</code> and query counterparty scores programmatically.</p>
            </div>
            <button
              onClick={() => copyCode("ts", TS_SDK_CODE)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-mono text-slate-300 transition flex items-center gap-1.5"
            >
              {copiedSection === "ts" ? "✓ Copied!" : "📋 Copy Code"}
            </button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 overflow-x-auto shadow-xl font-mono text-xs text-slate-300 leading-relaxed">
            <pre>{TS_SDK_CODE}</pre>
          </div>
        </section>

        {/* Section 2: On-Chain Smart Contract Integration */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">2. Solidity On-Chain Protocol Integration</h2>
              <p className="text-xs text-slate-400">Enforce minimum credit ratings in your smart contract before loan origination.</p>
            </div>
            <button
              onClick={() => copyCode("sol", SOLIDITY_CODE)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-mono text-slate-300 transition flex items-center gap-1.5"
            >
              {copiedSection === "sol" ? "✓ Copied!" : "📋 Copy Code"}
            </button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 overflow-x-auto shadow-xl font-mono text-xs text-slate-300 leading-relaxed">
            <pre>{SOLIDITY_CODE}</pre>
          </div>
        </section>

        {/* Section 3: REST API */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">3. REST API Endpoint Reference</h2>
              <p className="text-xs text-slate-400">Direct HTTP JSON interface for off-chain bots and risk committees.</p>
            </div>
            <button
              onClick={() => copyCode("curl", CURL_CODE)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-mono text-slate-300 transition flex items-center gap-1.5"
            >
              {copiedSection === "curl" ? "✓ Copied!" : "📋 Copy cURL"}
            </button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 overflow-x-auto shadow-xl font-mono text-xs text-slate-300 leading-relaxed">
            <pre>{CURL_CODE}</pre>
          </div>
        </section>

        {/* Section 4: Network & Contract Details */}
        <section className="bg-slate-900/40 border border-slate-800/90 rounded-2xl p-8 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-4">Creditcoin CC3 Deployment Parameters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-slate-500 mb-1">Contract Address (UUPS Proxy)</div>
              <div className="text-cyan-400 break-all font-bold">0x5BEC88F55ECA9038A9f03E77052314EfDC293Da5</div>
            </div>
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-slate-500 mb-1">Native Precompile Address</div>
              <div className="text-cyan-400 break-all font-bold">0x0000000000000000000000000000000000000FD2</div>
            </div>
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-slate-500 mb-1">Chain ID</div>
              <div className="text-slate-200 font-bold">102031 (Creditcoin CC3 Testnet)</div>
            </div>
            <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="text-slate-500 mb-1">RPC Endpoint</div>
              <div className="text-slate-200 font-bold">https://rpc.cc3-testnet.creditcoin.network</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
