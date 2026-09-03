"use client";

import { useState, useEffect, useCallback } from "react";
import { RiskResult } from "@/components/RiskMetrics";
import { API_URL, RWA_BENCHMARK_REGISTRY, type RWAAttestationData } from "@/lib/config";

interface UseRiskAnalysisReturn {
  address: string;
  setAddress: (v: string) => void;
  loading: boolean;
  result: RiskResult | null;
  displayScore: number;
  error: string;
  setError: (v: string) => void;
  history: string[];
  rwaPoRData: RWAAttestationData | null;
  handleAnalyze: (e?: React.FormEvent, customAddr?: string) => Promise<void>;
}

/**
 * useRiskAnalysis — core analysis workflow:
 * address input → backend /api/analyze → result + radar data + history.
 * Triggers onchain history fetch and RWA PoR on success.
 */
export function useRiskAnalysis(
  onAnalysisComplete?: (targetAddr: string, isRWA: boolean) => void
): UseRiskAnalysisReturn {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [rwaPoRData, setRwaPoRData] = useState<RWAAttestationData | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cp_history");
      if (saved) {
        try { setHistory(JSON.parse(saved)); } catch {}
      }
    } catch {}
  }, []);

  // Auto-dismiss error after 8s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Animated score counter
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

  const fetchRWAProofOfReserve = useCallback(async (targetAddr: string) => {
    try {
      const addrLower = targetAddr.toLowerCase();
      const benchmark = RWA_BENCHMARK_REGISTRY[addrLower] || {
        supplyUsd: 450000000,
        reservesUsd: 463500000,
        custodian: "Ankura Trust & Morgan Stanley",
        spvCik: "CIK-0001982741"
      };

      const res = await fetch(`${API_URL}/api/zktls/attest-reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_address: targetAddr,
          token_supply_usd: benchmark.supplyUsd,
          reserve_balance_usd: benchmark.reservesUsd,
          custodian_name: benchmark.custodian,
          spv_cik: benchmark.spvCik
        })
      });
      if (res.ok) {
        const porData = await res.json();
        setRwaPoRData(porData);
      }
    } catch {
      setRwaPoRData(null);
    }
  }, []);

  const handleAnalyze = useCallback(async (e?: React.FormEvent, customAddr?: string) => {
    if (e) e.preventDefault();
    const targetAddr = customAddr || address;
    if (!targetAddr) return;

    if (customAddr) setAddress(customAddr);
    setLoading(true);
    setError("");
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

      // Update history
      const updated = Array.from(new Set([targetAddr, ...history])).slice(0, 3);
      setHistory(updated);
      try { localStorage.setItem("cp_history", JSON.stringify(updated)); } catch {}

      // Notify parent for side effects (onchain history, PoR)
      const isRWA = data.rwa_type?.includes("RWA") || data.rwa_type?.includes("Tokenized");
      onAnalysisComplete?.(targetAddr, isRWA);
      if (isRWA) fetchRWAProofOfReserve(targetAddr);

    } catch {
      setError('Analysis failed. Please check the contract address and try again.');
    }
    setLoading(false);
  }, [address, history, onAnalysisComplete, fetchRWAProofOfReserve]);

  return {
    address, setAddress, loading, result, displayScore,
    error, setError, history, rwaPoRData, handleAnalyze
  };
}
