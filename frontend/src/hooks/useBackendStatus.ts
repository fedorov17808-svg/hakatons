"use client";

import { useState, useEffect } from "react";
import { API_URL, type DONNodeItem } from "@/lib/config";

interface OnchainStats {
  total_reports_onchain: number;
  verified_cross_chain_proofs: number;
  block_number: number;
}

interface UseBackendStatusReturn {
  backendStatus: 'checking' | 'online' | 'offline';
  onchainStats: OnchainStats | null;
  donNodes: DONNodeItem[];
}

/**
 * useBackendStatus — health check, onchain stats, and DON node status.
 * Runs on mount with graceful multi-endpoint resolution.
 */
export function useBackendStatus(): UseBackendStatusReturn {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [onchainStats, setOnchainStats] = useState<OnchainStats | null>(null);
  const [donNodes, setDonNodes] = useState<DONNodeItem[]>([]);

  useEffect(() => {
    // 1. Health check (tries local Next.js /api/health first, then external API_URL)
    const healthUrl = API_URL ? `${API_URL}/api/health` : "/api/health";
    fetch(healthUrl)
      .then(r => {
        if (r.ok) setBackendStatus('online');
        else throw new Error("Health check non-200");
      })
      .catch(() => {
        // Fallback to internal health check
        fetch("/api/health")
          .then(r => {
            if (r.ok) setBackendStatus('online');
            else setBackendStatus('offline');
          })
          .catch(() => setBackendStatus('offline'));
      });

    // 2. Onchain stats
    const statsUrl = API_URL ? `${API_URL}/api/stats/onchain` : "/api/stats/onchain";
    fetch(statsUrl)
      .then(r => r.json())
      .then(d => {
        if (d.total_reports_onchain !== undefined) {
          setOnchainStats(d);
        } else if (d.onchain) {
          setOnchainStats({
            total_reports_onchain: d.onchain.total_reports_onchain,
            verified_cross_chain_proofs: d.onchain.verified_crosschain_proofs,
            block_number: d.onchain.block_number
          });
        }
      })
      .catch(() => {
        fetch("/api/stats/onchain")
          .then(r => r.json())
          .then(d => { if (d.total_reports_onchain !== undefined) setOnchainStats(d); })
          .catch(() => {});
      });

    // 3. DON node status
    const donUrl = API_URL ? `${API_URL}/api/don/nodes` : "/api/don/nodes";
    fetch(donUrl)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.nodes)) {
          setDonNodes(d.nodes);
        } else if (Array.isArray(d.don_nodes)) {
          setDonNodes(d.don_nodes);
        }
      })
      .catch(() => {
        fetch("/api/don/nodes")
          .then(r => r.json())
          .then(d => { if (Array.isArray(d.nodes)) setDonNodes(d.nodes); })
          .catch(() => {});
      });
  }, []);

  return { backendStatus, onchainStats, donNodes };
}
