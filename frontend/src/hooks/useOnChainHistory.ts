"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CC3_RPC, CONTRACT_ADDRESS, CONTRACT_ABI, type OnChainReportItem } from "@/lib/config";

interface UseOnChainHistoryReturn {
  onchainHistory: OnChainReportItem[];
  loadingOnchainHistory: boolean;
  fetchOnChainHistory: (targetAddr: string) => Promise<void>;
}

/**
 * useOnChainHistory — reads report history from CreditPulseScore contract on CC3.
 */
export function useOnChainHistory(): UseOnChainHistoryReturn {
  const [onchainHistory, setOnchainHistory] = useState<OnChainReportItem[]>([]);
  const [loadingOnchainHistory, setLoadingOnchainHistory] = useState(false);

  const fetchOnChainHistory = useCallback(async (targetAddr: string) => {
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
  }, []);

  return { onchainHistory, loadingOnchainHistory, fetchOnChainHistory };
}
