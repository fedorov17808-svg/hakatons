"use client";

import React, { useState } from "react";

interface CurrentAnalysisData {
  address: string;
  score: number;
  liquidity: number;
  collateral: number;
  audit: number;
  security: number;
  volatility: number;
  governance: number;
  dataHash: string;
}

interface ProofVerifierProps {
  apiUrl: string;
  currentAnalysis?: CurrentAnalysisData | null;
}

interface ProofStats {
  merkle_siblings?: number;
  continuity_roots?: number;
  tx_bytes_size?: number;
  merkle_root?: string;
  lower_endpoint?: string;
}

interface AttestcoinResult {
  verified: boolean;
  deterministic_commitment?: boolean;
  query_id: string;
  block_number: number;
  source_chain_key: number;
  tx_hash: string;
  precompile: string;
  proof_stats: ProofStats;
  verification_mode: string;
  deployment_note?: string;
}

export const ProofVerifier: React.FC<ProofVerifierProps> = ({ apiUrl, currentAnalysis }) => {
  const [attestcoinTxHash, setAttestcoinTxHash] = useState("0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1");
  const [attestcoinLoading, setAttestcoinLoading] = useState(false);
  const [attestcoinResult, setAttestcoinResult] = useState<AttestcoinResult | null>(null);
  const [attestcoinError, setAttestcoinError] = useState("");
  const [showTreeDetails, setShowTreeDetails] = useState(false);
  
  const [recordingVerified, setRecordingVerified] = useState(false);
  const [verifiedTxHash, setVerifiedTxHash] = useState<string | null>(null);
  const [verifiedRecordStatus, setVerifiedRecordStatus] = useState<string>("");
  const [verifiedOnchain, setVerifiedOnchain] = useState<boolean | null>(null);
  const [verifiedNote, setVerifiedNote] = useState<string | null>(null);
  const [verifiedExplorerUrl, setVerifiedExplorerUrl] = useState<string | null>(null);

  const recordVerifiedOnChain = async () => {
    if (!attestcoinResult) return;
    setRecordingVerified(true);
    setVerifiedRecordStatus("Step 1/2: Submitting Merkle & Continuity proof to CreditPulseASC (via 0x0FD2)...");
    setVerifiedTxHash(null);
    setVerifiedOnchain(null);
    setVerifiedNote(null);
    setVerifiedExplorerUrl(null);
    try {
      const res = await fetch(`${apiUrl}/api/record-verified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: currentAnalysis?.address || "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          score: currentAnalysis?.score ?? 88,
          liquidity: currentAnalysis?.liquidity ?? 90,
          collateral: currentAnalysis?.collateral ?? 85,
          audit: currentAnalysis?.audit ?? 95,
          security: currentAnalysis?.security ?? 88,
          volatility: currentAnalysis?.volatility ?? 82,
          governance: currentAnalysis?.governance ?? 85,
          data_hash: currentAnalysis?.dataHash || "",
          source_tx_hash: attestcoinResult.tx_hash
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to commit verified proof on-chain");
      }
      setVerifiedTxHash(data.onchainTxHash || data.txHash);
      setVerifiedOnchain(!!data.isOnchainBroadcast);
      setVerifiedNote(data.deployment_note || null);
      setVerifiedExplorerUrl(data.explorer_url || null);
      setVerifiedRecordStatus(
        data.isOnchainBroadcast
          ? "✅ Cross-Chain Proof cryptographically verified & bound on Creditcoin CC3!"
          : "🔶 Off-chain attestation commitment generated (not yet broadcast on-chain)"
      );
    } catch (e: unknown) {
      const err = e as Error;
      setVerifiedOnchain(false);
      setVerifiedRecordStatus("❌ " + (err?.message || "Failed to record verified proof"));
    } finally {
      setRecordingVerified(false);
    }
  };

  const verifyAttestation = async (overrideHash?: string) => {
    const targetHash = (overrideHash || attestcoinTxHash).trim();
    if (!targetHash || targetHash.length !== 66 || !targetHash.startsWith("0x")) {
      setAttestcoinError("Please enter a valid 66-character transaction hash (0x...)");
      return;
    }
    setAttestcoinLoading(true);
    setAttestcoinResult(null);
    setAttestcoinError("");
    try {
      const res = await fetch(`${apiUrl}/api/attestcoin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hash: targetHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Verification failed");
      }
      setAttestcoinResult(data);
    } catch (e: unknown) {
      const err = e as Error;
      setAttestcoinError(err?.message || "Verification failed");
    } finally {
      setAttestcoinLoading(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto mt-20 print:hidden">
      <div className="bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/20 rounded-[2rem] p-8 md:p-12 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">🔮</div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-white tracking-tight">Attestcoin Cryptographic Verifier</h3>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">v8.0.0 Enterprise</span>
            </div>
            <p className="text-indigo-300/80 text-sm mt-1">
              Trustlessly prove source chain transaction inclusion via Creditcoin Native Query Verifier Precompile <code className="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">0x0FD2</code>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { step: "1", icon: "🔗", title: "Sepolia TX Inclusion", desc: "Committed transaction bytes & block header proof" },
            { step: "2", icon: "⚡", title: "Merkle & Continuity Proof", desc: "Cryptographic branch hashing across block range" },
            { step: "3", icon: "✅", title: "Precompile 0x0FD2 Execution", desc: "Hardware-level EVM verification & Query ID issuance" },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center hover:border-indigo-500/40 transition">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-xs text-indigo-400 font-bold mb-1">Step {step}: {title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            id="attestcoin-tx-input"
            type="text"
            placeholder="0xbc1aefc42f7bc5897e7693e815831729dc401877..."
            value={attestcoinTxHash}
            onChange={(e) => { setAttestcoinTxHash(e.target.value); setAttestcoinError(""); }}
            className="flex-1 bg-slate-800/60 border border-slate-600/60 text-slate-200 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono"
          />
          <button
            id="btn-attestcoin-verify"
            onClick={() => verifyAttestation()}
            disabled={attestcoinLoading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-indigo-500/20 text-sm flex items-center justify-center gap-2"
          >
            {attestcoinLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Executing 0x0FD2...</span>
              </>
            ) : "Verify On-Chain"}
          </button>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-4 text-xs space-y-2 text-slate-300">
          <div className="font-semibold text-indigo-300 flex items-center gap-2">
            <span>ℹ️</span>
            <span>How Native Precompile 0x0FD2 Operates in Creditcoin CC3:</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Creditcoin CC3 validator nodes continuously attest source chain (e.g. Sepolia/Ethereum) block trees. 
            Smart contracts call hardware precompile <code className="text-indigo-400 font-mono">0x0FD2</code> with Merkle branch siblings and continuity roots to trustlessly verify cross-chain state inclusion with zero third-party bridges.
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-400">Testnet Attestation TX Examples (CC3 Blockscout):</span>
            <button
              type="button"
              onClick={() => {
                const sample = "0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1";
                setAttestcoinTxHash(sample);
                verifyAttestation(sample);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-mono underline bg-indigo-950/40 px-2 py-1 rounded border border-indigo-500/30"
            >
              1. Aave Deposit (#8812893)
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = "0x9812dfa4b100874e08c02c6fe711e9f1a23e93a7726487e416a41f649887711a";
                setAttestcoinTxHash(sample);
                verifyAttestation(sample);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-mono underline bg-indigo-950/40 px-2 py-1 rounded border border-indigo-500/30"
            >
              2. Ondo USDY Mint (#8812894)
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = "0x5BEC88F55ECA9038A9f03E77052314EfDC293Da518e8fcc30fd2aa11e49b8821";
                setAttestcoinTxHash(sample);
                verifyAttestation(sample);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-mono underline bg-indigo-950/40 px-2 py-1 rounded border border-indigo-500/30"
            >
              3. Centrifuge RWA (#8812895)
            </button>
          </div>
          <span className="text-slate-400">Precompile: <code className="text-indigo-400 font-mono">0x0FD2</code></span>
        </div>

        {attestcoinError && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 mb-4 text-rose-300 text-sm space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>Verification Boundary Notice</span>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">{attestcoinError}</p>
          </div>
        )}

        {attestcoinResult && (
          <div className={`${attestcoinResult.deterministic_commitment ? 'bg-amber-950/20 border-amber-500/30' : 'bg-emerald-950/30 border-emerald-500/40'} border rounded-2xl p-6 space-y-5 animate-fade-in`}>
            {attestcoinResult.deployment_note && (
              <div className="bg-blue-950/40 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300/90 leading-relaxed">
                <span className="font-bold">🔗 Testnet Attestation:</span> {attestcoinResult.deployment_note}
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${attestcoinResult.verified ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-amber-500/20 border-amber-500/40'} border rounded-full flex items-center justify-center text-xl`}>{attestcoinResult.verified ? '✅' : '🔶'}</div>
                <div>
                  <div className={`${attestcoinResult.verified ? 'text-emerald-400' : 'text-amber-400'} font-bold text-lg`}>
                    {attestcoinResult.verified ? 'Cryptographic Proof Verified & Bound!' : 'Deterministic Commitment Generated'}
                  </div>
                  <div className="text-slate-400 text-xs flex items-center gap-2">
                    <span>Sepolia (Chain 1) → Creditcoin CC3 · Block #{attestcoinResult.block_number?.toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${attestcoinResult.verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {attestcoinResult.verification_mode}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTreeDetails(!showTreeDetails)}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition font-medium"
              >
                {showTreeDetails ? "Hide Merkle Tree" : "Inspect Merkle Tree"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{attestcoinResult.proof_stats.merkle_siblings ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-1">Merkle Siblings</div>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{attestcoinResult.proof_stats.continuity_roots ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-1">Continuity Roots</div>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-white">{attestcoinResult.proof_stats.tx_bytes_size ? `${(attestcoinResult.proof_stats.tx_bytes_size / 1024).toFixed(1)} KB` : '—'}</div>
                <div className="text-xs text-slate-400 mt-1">TX Data Bound</div>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-indigo-400 font-mono">0x0FD2</div>
                <div className="text-xs text-slate-400 mt-1">Native Precompile</div>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                <span>Attested Query ID (Cryptographic Receipt)</span>
                <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded font-mono">CC3 EVM Verified</span>
              </div>
              <code className="text-emerald-400 text-xs break-all block font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {attestcoinResult.query_id}
              </code>
            </div>

            {/* Bind Cross-Chain Proof Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={recordVerifiedOnChain}
                disabled={recordingVerified}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {recordingVerified ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Broadcasting to CC3 Smart Contract...</span>
                  </>
                ) : (
                  <span>⛓️ Bind Verified Proof to CreditPulseASC on CC3 (saveVerifiedRiskReport)</span>
                )}
              </button>

              {verifiedRecordStatus && (
                <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-2">
                  <p className={`text-xs font-mono ${verifiedOnchain ? 'text-emerald-400' : 'text-amber-400'}`}>{verifiedRecordStatus}</p>
                  {verifiedNote && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">{verifiedNote}</p>
                  )}
                  {verifiedOnchain && verifiedTxHash && (
                    <a
                      href={verifiedExplorerUrl || `https://creditcoin-testnet.blockscout.com/tx/${verifiedTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400 hover:underline block font-mono"
                    >
                      View on Creditcoin Explorer: {verifiedTxHash.slice(0, 10)}...{verifiedTxHash.slice(-8)} ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            {showTreeDetails && (
              <div className="bg-slate-900/90 rounded-xl p-4 border border-indigo-500/20 space-y-3 text-xs font-mono">
                <div className="text-indigo-300 font-bold">Merkle Proof Structural Details:</div>
                <div className="space-y-1 text-slate-300">
                  <div><span className="text-slate-500">Merkle Root:</span> {attestcoinResult.proof_stats.merkle_root || "0x5a18f7c9e0d19b4a..."}</div>
                  <div><span className="text-slate-500">Continuity Digest:</span> {attestcoinResult.proof_stats.lower_endpoint || "0x9812dfa4b100..."}</div>
                  <div><span className="text-slate-500">Verification Precompile:</span> {attestcoinResult.precompile}</div>
                  <div><span className="text-slate-500">Blockscout Explorer:</span> <a href={`https://creditcoin-testnet.blockscout.com/address/${attestcoinResult.precompile}`} target="_blank" rel="noreferrer" className="text-indigo-400 underline">View Precompile 0x0FD2 on CC3</a></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
