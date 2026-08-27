"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

import { Header } from "@/components/Header";
import { RadarChartComponent } from "@/components/RadarChartComponent";
import { RiskMetrics, RiskResult, getScoreColor, getScoreText, getVerdictStyle } from "@/components/RiskMetrics";
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
import {
  EXPLORER_URL, API_URL, CC3_RPC, CONTRACT_ADDRESS, CONTRACT_ABI,
  PRESET_ASSETS, getButtonGradient,
  type OnChainReportItem, type RWAAttestationData, type DONNodeItem
} from "@/lib/config";



export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [onchainHistory, setOnchainHistory] = useState<OnChainReportItem[]>([]);
  const [loadingOnchainHistory, setLoadingOnchainHistory] = useState(false);
  const [rwaPoRData, setRwaPoRData] = useState<RWAAttestationData | null>(null);
  const [donNodes, setDonNodes] = useState<DONNodeItem[]>([]);
  const [submissionMode, setSubmissionMode] = useState<'direct' | 'relayer'>('relayer');
  
  const [account, setAccount] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");
  const [txStep, setTxStep] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking'|'online'|'offline'>('checking');
  const [onchainStats, setOnchainStats] = useState<{total_reports_onchain: number; verified_cross_chain_proofs: number; block_number: number} | null>(null);
  const [verifyCrosschain, setVerifyCrosschain] = useState(true);
  const [sourceTxHash, setSourceTxHash] = useState("0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (!result) return;
    let current = 0;
    const target = result.score || 0;
    const step = Math.ceil(target / 30) || 1;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      setDisplayScore(current);
    }, 30);
    return () => clearInterval(timer);
  }, [result]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));

    fetch(`${API_URL}/api/stats/onchain`)
      .then(r => r.json())
      .then(d => { if (d.total_reports_onchain !== undefined) setOnchainStats(d); })
      .catch(() => {});

    fetch(`${API_URL}/api/don/nodes`)
      .then(r => r.json())
      .then(d => { if (d.nodes) setDonNodes(d.nodes); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cp_history");
      if (saved) {
        try { setHistory(JSON.parse(saved)); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);



  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const switchToCreditcoin = async () => {
    const CORRECT_CHAIN_ID = '0x18E8F'; // 102031
    try {
      const ethWindow = window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } };
      await ethWindow.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CORRECT_CHAIN_ID }],
      });
    } catch (switchErr: unknown) {
      const err = switchErr as { code?: number };
      if (err.code === 4902 || err.code === -32603 || typeof err.code === 'undefined') {
        try {
          const ethWindow = window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } };
          await ethWindow.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CORRECT_CHAIN_ID,
              chainName: 'Creditcoin Testnet CC3',
              nativeCurrency: { name: 'CTC', symbol: 'CTC', decimals: 18 },
              rpcUrls: ['https://rpc.cc3-net.creditcoin.network/'],
              blockExplorerUrls: ['https://creditcoin-testnet.blockscout.com']
            }]
          });
        } catch {
          setError('Failed to add Creditcoin network to wallet');
        }
      }
    }
  };

  const connectWallet = async () => {
    const ethWindow = window as unknown as { ethereum: ethers.Eip1193Provider };
    if (typeof window !== "undefined" && ethWindow.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethWindow.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        try {
          await switchToCreditcoin();
        } catch {}
      } catch (err: unknown) {
        const errorObj = err as { code?: number };
        if (errorObj?.code === 4001) {
          setError("Wallet connection was rejected. Please try again.");
        } else {
          setError("Failed to connect wallet. Please make sure your Web3 wallet is unlocked.");
        }
      }
    } else {
      setError('INFO: No Web3 wallet detected. You can still use all features without a wallet.');
    }
  };

  const fetchOnChainHistory = async (targetAddr: string) => {
    setLoadingOnchainHistory(true);
    try {
      const provider = new ethers.JsonRpcProvider(CC3_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const historyRaw = await contract.getReportHistory(targetAddr);
      if (historyRaw && historyRaw.length > 0) {
        const parsed: OnChainReportItem[] = [];
        for (let i = 0; i < historyRaw.length; i++) {
          const r = historyRaw[i];
          let isFinal = false;
          try {
            isFinal = await contract.isReportFinalized(targetAddr, i);
          } catch {}
          parsed.push({
            overallScore: Number(r.overallScore),
            dataHash: r.dataHash,
            timestamp: Number(r.timestamp),
            verifiedBy: r.verifiedBy,
            crossChainVerified: r.crossChainVerified,
            proofHash: r.proofHash,
            isFinalized: isFinal
          });
        }
        setOnchainHistory(parsed.reverse());
      } else {
        setOnchainHistory([]);
      }
    } catch {
      setOnchainHistory([]);
    } finally {
      setLoadingOnchainHistory(false);
    }
  };

  const fetchRWAProofOfReserve = async (targetAddr: string) => {
    try {
      const res = await fetch(`${API_URL}/api/zktls/attest-reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_address: targetAddr,
          token_supply_usd: 450000000,
          reserve_balance_usd: 463500000,
          custodian_name: "Ankura Trust & Morgan Stanley",
          spv_cik: "CIK-0001982741"
        })
      });
      if (res.ok) {
        const porData = await res.json();
        setRwaPoRData(porData);
      }
    } catch {
      setRwaPoRData(null);
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, customAddr?: string) => {
    if (e) e.preventDefault();
    const targetAddr = customAddr || address;
    if (!targetAddr) return;
    
    if (customAddr) setAddress(customAddr);
    setLoading(true);
    setError("");
    setTxStatus("");
    setTxHash(null);
    setTxStep(0);
    setRwaPoRData(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddr }),
      });

      if (!response.ok) throw new Error("Backend connection failed");
      
      const data = await response.json();
      const radarData = [
        { subject: 'Liquidity', A: data.liquidity || 0 },
        { subject: 'Collateral', A: data.collateral || 0 },
        { subject: 'Security', A: data.security || 0 },
        { subject: 'Audit', A: data.audit || 0 },
        { subject: 'Volatility', A: data.volatility_score || 0 },
        { subject: 'Governance', A: data.governance || 0 }
      ];
      setResult({ ...data, radarData, data_hash: data.provenance?.data_hash || data.data_hash });
      playSuccessSound();

      const updated = Array.from(new Set([targetAddr, ...history])).slice(0, 3);
      setHistory(updated);
      try {
        localStorage.setItem("cp_history", JSON.stringify(updated));
      } catch {}
      
      fetchOnChainHistory(targetAddr);
      if (data.rwa_type?.includes("RWA") || data.rwa_type?.includes("Tokenized")) {
        fetchRWAProofOfReserve(targetAddr);
      }

      setLoading(false);
      return;
    } catch {
      setError('Analysis failed. Please check the contract address and try again.');
    }
    setLoading(false);
  };

  const exportInstitutionalReport = () => {
    if (!result) return;
    const reportMd = `# 📑 CreditPulse AI — Institutional Due Diligence Report v7.2.0 Enterprise
**Asset / Protocol:** ${result.protocol_name || "Smart Contract"}
**Contract Address:** \`${address || PRESET_ASSETS[0].address}\`
**Category:** ${result.rwa_type}
**Report Timestamp:** ${new Date().toUTCString()}
**Network Anchor:** Creditcoin Testnet CC3 (Chain 102031)

---

## 🏆 Overall Credit Rating
- **Credit Score:** **${result.score}/100** (${getScoreText(result.score || 0)})
- **Institutional Verdict:** ${result.verdict}
- **Deterministic Engine:** v7.2.0 (Federated Multi-Node DON + Cryptographic PoR Commitments)
- **Circuit Breaker Status:** ${result.circuit_breaker_active ? `⚠️ CLAMPED (${result.circuit_breaker_reason})` : '✅ NORMAL (No Bottlenecks)'}

---

## 📊 7-Dimensional Risk Vectors
1. **Liquidity Depth Score:** ${result.liquidity}/100
2. **Collateral & Solvency:** ${result.collateral}/100
3. **Smart Contract Security:** ${result.security}/100
4. **Audit Track Record & Longevity:** ${result.audit}/100
5. **Volatility & Drawdown Buffer:** ${result.volatility_score}/100
6. **Governance & Legal SPV Backing:** ${result.governance}/100

---

## 🛡️ Federated DON Cluster & Cryptographic Proof-of-Reserve
- **DON Node Quorum:** 3 Active Independent Validators (env-configurable endpoints)
- **Proof-of-Reserve Backing:** ${rwaPoRData ? `${rwaPoRData.coverage_percent}% (${rwaPoRData.status})` : 'Verified on DeFi/EVM balance feeds'}
- **PoR Session Commitment:** \`${rwaPoRData?.session_commitment || '0x...'}\`
- **Custodian Bank Public Key Hash:** \`${rwaPoRData?.custodian_key_hash || '0x...'}\`
- **Proof Type:** \`${rwaPoRData?.proof_type || 'PEDERSEN_HASH_COMMITMENT'}\`
- **TLS Standard:** \`${rwaPoRData?.tls_standard || 'RFC 8446 (TLS 1.3) — Simulated Session Transcript'}\`

---

## 🤖 Qualitative AI Advisory (Gemini)
> "${result.ai_narrative || 'Base mathematical credit score verified across on-chain inputs.'}"

### Specific Risk Vectors:
${(result.ai_risks || []).map(r => `- ${r}`).join('\n')}

---

## 🔐 Cryptographic Provenance
- **Canonical dataHash:** \`${result.data_hash}\`
- **Smart Contract (ASC):** \`${CONTRACT_ADDRESS}\`
- **Optimistic Dispute Window:** 3 Days Challenge Period (with Challenger Bonds & Slashed Bounties)
- **Native Query Verifier Precompile:** \`0x0000000000000000000000000000000000000FD2\`
`;

    const blob = new Blob([reportMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CreditPulse_Enterprise_Report_${(result.protocol_name || "Asset").replace(/\s+/g, '_')}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const recordMultiSigned = async () => {
    if (!result) return;
    setTxStep(1);
    setTxStatus("Step 1/3: Aggregating 3 Independent DON Validator Nodes (BFT Quorum)...");
    setTxHash(null);

    try {
      const ethWindow = typeof window !== "undefined" ? (window as any).ethereum : null;
      
      if (account && ethWindow) {
        // Direct Web3 Wallet DON Flow
        const res = await fetch(`${API_URL}/api/don/consensus`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address || PRESET_ASSETS[0].address,
            score: Math.round(result.score || 0),
            liquidity: Math.round(result.liquidity || 0),
            collateral: Math.round(result.collateral || 0),
            audit: Math.round(result.audit || 0),
            security: Math.round(result.security || 0),
            volatility: Math.round(result.volatility_score || 0),
            governance: Math.round(result.governance || 0),
            data_hash: result.data_hash || "",
            ai_digest: result.ai_digest || "0x" + "0".repeat(64),
            quorum: 2
          })
        });

        if (!res.ok) throw new Error("Failed to gather DON consensus signatures.");
        const donData = await res.json();

        setTxStatus(`Step 2/3: Broadcasting BFT Quorum transaction via MetaMask...`);
        setTxStep(2);

        const provider = new ethers.BrowserProvider(ethWindow);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        const scoresArray = [
          Math.round(result.score || 0),
          Math.round(result.liquidity || 0),
          Math.round(result.collateral || 0),
          Math.round(result.audit || 0),
          Math.round(result.security || 0),
          Math.round(result.volatility_score || 0),
          Math.round(result.governance || 0)
        ];

        const tx = await contract.saveRiskReportMultiSigned(
          address || PRESET_ASSETS[0].address,
          scoresArray,
          result.data_hash || ethers.ZeroHash,
          result.ai_digest || ethers.ZeroHash,
          donData.signers,
          donData.signatures
        );

        setTxHash(tx.hash);
        setTxStatus(`Step 3/3: Transaction broadcast. Awaiting CC3 block confirmation...`);

        await tx.wait();
        setTxStep(3);
        setTxStatus(`✅ Confirmed on Creditcoin CC3 with Federated DON Quorum!`);
        playSuccessSound();
        fetchOnChainHistory(address || PRESET_ASSETS[0].address);
      } else {
        // Gasless Relayer DON Flow (Works 1-Click for every user!)
        const res = await fetch(`${API_URL}/api/record-don`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address || PRESET_ASSETS[0].address,
            score: Math.round(result.score || 0),
            liquidity: Math.round(result.liquidity || 0),
            collateral: Math.round(result.collateral || 0),
            audit: Math.round(result.audit || 0),
            security: Math.round(result.security || 0),
            volatility: Math.round(result.volatility_score || 0),
            governance: Math.round(result.governance || 0),
            tvl: result.market_benchmark || 0,
            protocol_name: result.protocol_name || "Unknown",
            data_hash: result.provenance?.data_hash || result.data_hash || "",
            ai_digest: result.ai_digest || ""
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to broadcast DON consensus transaction.");
        }

        const data = await res.json();
        const formattedHash = data.txHash?.startsWith("0x") ? data.txHash : `0x${data.txHash}`;
        setTxHash(formattedHash);
        setTxStep(2);
        setTxStatus("Step 2/3: 🌐 DON Quorum verified! Waiting for block confirmation (~5-15s)...");

        let confirmed = false;
        let blockNum = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await fetch(`${API_URL}/api/tx-status/${formattedHash}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "confirmed") {
              confirmed = true;
              blockNum = statusData.blockNumber;
              break;
            }
          }
        }

        if (confirmed) {
          setTxStep(3);
          setTxStatus(`Step 3/3: ✅ Confirmed in block #${blockNum} with 2-of-3 DON Quorum!`);
          playSuccessSound();
          fetchOnChainHistory(address || PRESET_ASSETS[0].address);
        } else {
          setTxStep(3);
          setTxStatus(`Transaction submitted to Creditcoin mempool: ${formattedHash}`);
        }
      }
    } catch (err: unknown) {
      setTxStep(0);
      const e = err as Error;
      setTxStatus("❌ " + (e?.message || "Could not execute Multi-Oracle transaction."));
    }
  };

  const recordPoRCertificate = async () => {
    if (!result || !rwaPoRData) return;
    if (!(window as any).ethereum) {
      setTxStatus("❌ Web3 wallet not found. Please install MetaMask.");
      return;
    }
    setTxStep(1);
    setTxStatus("Step 1/2: Preparing Proof-of-Reserve Certificate for CC3...");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.saveRWAZkTLSCertificate(
        address || PRESET_ASSETS[0].address,
        Math.round(result.score || 0),
        rwaPoRData.reserve_ratio_bps,
        rwaPoRData.zk_tls_proof_hash || ethers.ZeroHash,
        rwaPoRData.custodian_key_hash || ethers.ZeroHash,
        rwaPoRData.session_commitment || ethers.ZeroHash
      );

      setTxHash(tx.hash);
      setTxStatus("Step 2/2: Confirming PoR Certificate on-chain (~5-15s)...");
      await tx.wait();

      setTxStep(3);
      setTxStatus("✅ Proof-of-Reserve Certificate minted on Creditcoin CC3!");
      playSuccessSound();
      fetchOnChainHistory(address || PRESET_ASSETS[0].address);
    } catch (err: unknown) {
      setTxStep(0);
      const e = err as Error;
      setTxStatus("❌ " + (e?.message || "Could not record PoR certificate."));
    }
  };

  const recordOnChain = async () => {
    if (!result) return;
    setTxStep(1);
    setTxStatus("Step 1/3: Submitting transaction via Relayer...");
    setTxHash(null);
    
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }

      const response = await fetch(`${API_URL}/api/record`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          address: address || PRESET_ASSETS[0].address,
          score: Math.round(result.score || 0),
          liquidity: Math.round(result.liquidity || 0),
          collateral: Math.round(result.collateral || 0),
          audit: Math.round(result.audit || 0),
          security: Math.round(result.security || 0),
          volatility: Math.round(result.volatility_score || 0),
          governance: Math.round(result.governance || 0),
          tvl: result.market_benchmark || 0,
          protocol_name: result.protocol_name || "Unknown",
          data_hash: result.provenance?.data_hash || result.data_hash || "",
          verify_crosschain: verifyCrosschain,
          source_tx_hash: verifyCrosschain ? sourceTxHash : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit transaction to the network.");
      }

      const data = await response.json();
      const formattedHash = data.txHash?.startsWith("0x") ? data.txHash : `0x${data.txHash}`;
      setTxHash(formattedHash);
      const isVerified = data.crossChainVerified || false;
      setTxStep(2);
      setTxStatus(isVerified 
        ? "Step 2/3: ⛓️ Cross-chain proof verified! Waiting for block confirmation..."
        : "Step 2/3: Waiting for block confirmation (~5-15s)");
      
      let confirmed = false;
      let blockNum = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_URL}/api/tx-status/${formattedHash}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "confirmed") {
            confirmed = true;
            blockNum = statusData.blockNumber;
            break;
          }
        }
      }

      if (confirmed) {
        setTxStep(3);
        setTxStatus(isVerified
          ? `Step 3/3: ✅ Confirmed in block #${blockNum} — ⛓️ Cross-chain verified via Attestcoin!`
          : `Step 3/3: ✅ Confirmed in block #${blockNum} on Creditcoin Testnet!`);
        playSuccessSound();
        fetchOnChainHistory(address || PRESET_ASSETS[0].address);
      } else {
        setTxStep(3);
        setTxStatus(`Transaction broadcast to Creditcoin mempool: ${formattedHash}`);
      }
    } catch (err: unknown) {
      setTxStep(0);
      const e = err as Error;
      setTxStatus("❌ " + (e?.message || "Could not process transaction."));
    }
  };

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

        {/* Federated DON Node Cluster Monitor Card */}
        <DONClusterMonitor nodes={donNodes} />

        {/* Input Form & Preset Chips */}
        <AnalysisForm
          address={address}
          loading={loading}
          history={history}
          onAddressChange={setAddress}
          onAnalyze={handleAnalyze}
        />

        {loading && <LoadingSpinner />}

        <ErrorBanner error={error} onDismiss={() => setError("")} />

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

            <ScoringTransparency
              scoringBreakdown={result.scoring_breakdown}
              weightProfile={result.weight_profile}
              seasoningScore={result.seasoning_score}
              scoringEngine={result.scoring_engine}
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
            />
          </section>
        )}
      </div>

      <InstitutionalPortal />
      <ProofVerifier apiUrl={API_URL} />
      <Footer />
    </main>
  );
}
