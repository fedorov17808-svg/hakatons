"use client";

import React, { useCallback, useState } from "react";

import { Header } from "@/components/Header";
import { RadarChartComponent } from "@/components/RadarChartComponent";
import { RiskMetrics, getVerdictStyle } from "@/components/RiskMetrics";
import { ProofVerifier } from "@/components/ProofVerifier";
import { InstitutionalPortal } from "@/components/InstitutionalPortal";
import { Footer } from "@/components/Footer";
import { DONClusterMonitor } from "@/components/DONClusterMonitor";
import { AnalysisForm } from "@/components/AnalysisForm";
import { ScoreHeader } from "@/components/ScoreHeader";
import { TxStatusPanel } from "@/components/TxStatusPanel";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OnChainHistory } from "@/components/OnChainHistory";
import { ExecutionModeSwitcher } from "@/components/ExecutionModeSwitcher";
import { ActionButtons } from "@/components/ActionButtons";
import { ScoringTransparency } from "@/components/ScoringTransparency";
import { ProofOfReserveCard } from "@/components/ProofOfReserveCard";
import { AIAdvisory } from "@/components/AIAdvisory";
import { AnalysisPipeline } from "@/components/AnalysisPipeline";
import { LendingSimulator } from "@/components/LendingSimulator";
import { API_URL, PRESET_ASSETS } from "@/lib/config";
import {
  useWallet,
  useBackendStatus,
  useOnChainHistory,
  useRiskAnalysis,
  useTransactionRecorder,
} from "@/hooks";


export default function Home() {
  // ── Hooks ─────────────────────────────────────────────────
  const { account, connectWallet, walletError } = useWallet();
  const { backendStatus, onchainStats, donNodes } = useBackendStatus();
  const { onchainHistory, loadingOnchainHistory, fetchOnChainHistory } = useOnChainHistory();

  const onAnalysisComplete = useCallback((targetAddr: string) => {
    fetchOnChainHistory(targetAddr);
  }, [fetchOnChainHistory]);

  const {
    address, setAddress, loading, result, displayScore,
    error, setError, history, rwaPoRData, handleAnalyze
  } = useRiskAnalysis(onAnalysisComplete);

  const {
    txHash, txStatus, txStep,
    explorerUrl, isOnchain,
    submissionMode, setSubmissionMode,
    isCopied, copyToClipboard,
    recordMultiSigned, recordOnChain, recordPoRCertificate,
    exportInstitutionalReport,
  } = useTransactionRecorder(result, address, account, rwaPoRData, (addr) => fetchOnChainHistory(addr));

  // Merge wallet errors into main error display
  const displayError = walletError || error;

  // ── Render ────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans p-8">
      <Header
        backendStatus={backendStatus}
        onchainStats={onchainStats}
        account={account}
        connectWallet={connectWallet}
        apiUrl={API_URL}
      />

      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12 mt-8 print:hidden">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Federated DON Cluster ({donNodes.length > 0 ? `${donNodes.length} Nodes` : '3 Nodes'}) · Cryptographic PoR Commitments
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
              Creditcoin CC3 (Chain ID 102031)
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent pb-2">
            Enterprise RWA<br className="hidden md:block"/> Credit Intelligence
          </h2>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">
            Decentralized credit scoring, cryptographic reserve verification, and optimistic dispute finality on Creditcoin.
          </p>
        </div>

        {/* DON Cluster Monitor */}
        <DONClusterMonitor nodes={donNodes} />

        {/* Analysis Form */}
        <AnalysisForm
          address={address}
          loading={loading}
          history={history}
          onAddressChange={setAddress}
          onAnalyze={handleAnalyze}
        />

        {/* Live Analysis Pipeline (streaming) */}
        {loading && address && (
          <AnalysisPipeline
            address={address}
            onComplete={() => { /* Results handled by useRiskAnalysis hook */ }}
            onError={(err) => setError(err)}
          />
        )}

        {loading && !address && <LoadingSpinner />}

        <ErrorBanner error={displayError || ""} onDismiss={() => setError("")} />

        {/* Results Dashboard */}
        {!loading && result && (
          <section id="section-results" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <ScoreHeader
              score={result.score || 0}
              displayScore={displayScore}
              rwaType={result.rwa_type || 'Unknown'}
              protocolName={result.protocol_name}
              tvl={result.raw_inputs?.tvl ? `$${(result.raw_inputs.tvl / 1e6).toFixed(1)}M` : undefined}
            />

            {/* Radar Chart & Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <RadarChartComponent data={result.radarData || []} />
              <RiskMetrics result={result} />
            </div>

            {/* AI Verdict */}
            <div className={`${getVerdictStyle(result.verdict).box} border rounded-xl p-4`}>
              <span className={`text-xs font-semibold ${getVerdictStyle(result.verdict).text} uppercase tracking-wider block mb-1`}>
                🤖 Autonomous Agent Verdict {result.ai_role && <span className="text-slate-500 normal-case font-normal ml-2">({result.ai_role})</span>}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
              {result.ai_note && (
                <p className="text-[11px] text-slate-500 mt-2 italic">{result.ai_note}</p>
              )}
            </div>

            <LendingSimulator
              score={result.score || 0}
              protocolName={result.protocol_name}
            />

            <ScoringTransparency
              scoringBreakdown={result.scoring_breakdown}
              weightProfile={result.weight_profile}
              seasoningScore={result.seasoning_score}
              scoringEngine={result.scoring_engine}
              onchainTelemetry={result.onchain_telemetry}
            />

            {rwaPoRData && (
              <ProofOfReserveCard
                data={rwaPoRData}
                txStep={txStep}
                onMintCert={recordPoRCertificate}
              />
            )}

            {result.ai_narrative && (
              <AIAdvisory
                narrative={result.ai_narrative}
                risks={result.ai_risks}
                recommendations={result.ai_recommendations}
                model={result.ai_model}
              />
            )}

            <OnChainHistory
              records={onchainHistory.map(r => ({ ...r, isFinalized: r.isFinalized ?? false }))}
              loading={loadingOnchainHistory}
              onRefresh={() => fetchOnChainHistory(address || PRESET_ASSETS[0].address)}
            />

            <ExecutionModeSwitcher
              mode={submissionMode}
              onModeChange={setSubmissionMode}
            />

            <ActionButtons
              submissionMode={submissionMode}
              txStep={txStep}
              onSubmitDirect={recordMultiSigned}
              onSubmitRelayer={recordOnChain}
              onExport={exportInstitutionalReport}
            />

            <TxStatusPanel
              txStep={txStep}
              txStatus={txStatus}
              txHash={txHash || ''}
              isCopied={isCopied}
              onCopy={copyToClipboard}
              explorerUrl={explorerUrl}
              isOnchain={isOnchain}
            />
          </section>
        )}
      </div>

      <InstitutionalPortal />
      <ProofVerifier apiUrl={API_URL} currentAnalysis={result ? {
        address: address,
        score: result.score ?? 0,
        liquidity: result.liquidity ?? 0,
        collateral: result.collateral ?? 0,
        audit: result.audit ?? 0,
        security: result.security ?? 0,
        volatility: result.volatility_score ?? 0,
        governance: result.governance ?? 0,
        dataHash: result.data_hash ?? ''
      } : null} />
      <Footer />
    </main>
  );
}
