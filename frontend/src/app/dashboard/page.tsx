"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface ProtocolStats {
  reportCount: number | null;
  verifiedProofCount: number | null;
  totalOracleStake: string | null;
  insurancePoolBalance: string | null;
  currentBlock: number | null;
  rpc_connected: boolean;
}

interface DonNode {
  node_id: string;
  name: string;
  status: string;
  latency_ms: number;
}

interface DashboardData {
  stats: ProtocolStats | null;
  donNodes: DonNode[];
  health: { status: string; contract: string; rpc: string } | null;
  loading: boolean;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    stats: null, donNodes: [], health: null, loading: true
  });

  useEffect(() => {
    async function fetchAll() {
      const [statsRes, nodesRes, healthRes] = await Promise.allSettled([
        fetch("/api/stats/onchain").then(r => r.json()),
        fetch("/api/don/nodes").then(r => r.json()),
        fetch("/api/health").then(r => r.json()),
      ]);

      let formattedStats: ProtocolStats | null = null;
      if (statsRes.status === "fulfilled" && statsRes.value) {
        const s = statsRes.value;
        formattedStats = {
          reportCount: s.total_reports_onchain ?? s.reportCount ?? null,
          verifiedProofCount: s.verified_cross_chain_proofs ?? s.verifiedProofCount ?? 0,
          totalOracleStake: s.total_oracle_stake_ctc ?? s.totalOracleStake ?? "0.0",
          insurancePoolBalance: s.insurance_pool_ctc ?? s.insurancePoolBalance ?? "0.0",
          currentBlock: s.block_number ?? s.currentBlock ?? null,
          rpc_connected: !!s.rpc_connected,
        };
      }

      setData({
        stats: formattedStats,
        donNodes: nodesRes.status === "fulfilled" ? (nodesRes.value.nodes || []) : [],
        health: healthRes.status === "fulfilled" ? healthRes.value : null,
        loading: false,
      });
    }
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = data.stats;

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            ⚡ CreditPulse
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition">Analyze</Link>
            <Link href="/dashboard" className="text-cyan-400 font-medium">Dashboard</Link>
            <Link href="/explorer" className="text-slate-400 hover:text-white transition">Explorer</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-2">Protocol Dashboard</h1>
        <p className="text-slate-400 mb-10">Real-time metrics from Creditcoin CC3 testnet</p>

        {data.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              <KPICard
                label="Risk Reports"
                value={stats?.reportCount != null ? stats.reportCount.toString() : "—"}
                sublabel="on-chain"
                icon="📊"
                color="cyan"
              />
              <KPICard
                label="Verified Proofs"
                value={stats?.verifiedProofCount != null ? stats.verifiedProofCount.toString() : "—"}
                sublabel="cross-chain"
                icon="🛡️"
                color="emerald"
              />
              <KPICard
                label="Oracle Stake"
                value={stats?.totalOracleStake ? `${parseFloat(stats.totalOracleStake).toFixed(1)} CTC` : "—"}
                sublabel="bonded"
                icon="💰"
                color="amber"
              />
              <KPICard
                label="Insurance Pool"
                value={stats?.insurancePoolBalance ? `${parseFloat(stats.insurancePoolBalance).toFixed(1)} CTC` : "—"}
                sublabel="first-loss reserve"
                icon="🏦"
                color="purple"
              />
            </div>

            {/* Status Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              {/* System Health */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-200">System Health</h3>
                <div className="space-y-3">
                  <StatusRow
                    label="API Server"
                    status={data.health ? "operational" : "unknown"}
                  />
                  <StatusRow
                    label="CC3 RPC"
                    status={stats?.rpc_connected ? "operational" : "degraded"}
                  />
                  <StatusRow
                    label="DON Cluster"
                    status={
                      data.donNodes.filter(n => n.status?.toUpperCase() === "ONLINE").length >= 2
                        ? "operational"
                        : data.donNodes.length > 0 ? "degraded" : "unknown"
                    }
                  />
                  <StatusRow
                    label="Contract"
                    status={data.health?.contract ? "operational" : "unknown"}
                  />
                </div>
              </div>

              {/* DON Nodes */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-200">DON Validator Nodes</h3>
                {data.donNodes.length === 0 ? (
                  <p className="text-slate-500 text-sm">No nodes responding</p>
                ) : (
                  <div className="space-y-3">
                    {data.donNodes.map((node) => {
                      const online = node.status?.toUpperCase() === "ONLINE";
                      return (
                        <div key={node.node_id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
                            <span className="text-sm font-medium text-slate-300">{node.name || node.node_id}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            {online ? `${node.latency_ms}ms` : node.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Block Info */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-200">Network Info</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoCell label="Current Block" value={stats?.currentBlock?.toLocaleString() ?? "—"} />
                <InfoCell label="Chain ID" value="102031" />
                <InfoCell label="Network" value="Creditcoin CC3 Testnet" />
                <InfoCell label="Contract" value={data.health?.contract?.slice(0, 10) + "..." || "—"} />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function KPICard({ label, value, sublabel, icon, color }: {
  label: string; value: string; sublabel: string; icon: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.cyan} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-slate-500">{sublabel}</div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: "operational" | "degraded" | "unknown" }) {
  const colors = {
    operational: "bg-emerald-400",
    degraded: "bg-amber-400",
    unknown: "bg-slate-500",
  };
  const labels = {
    operational: "Operational",
    degraded: "Degraded",
    unknown: "Unknown",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="text-xs text-slate-400">{labels[status]}</span>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-sm font-mono text-slate-300">{value}</div>
    </div>
  );
}
