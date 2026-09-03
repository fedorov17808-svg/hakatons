"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function WaitlistPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    protocolType: "Lending Protocol",
    monthlyLoanVolume: "$5M - $25M",
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.email.includes("@")) {
      setErrorMsg("Please provide a valid corporate email address.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application");
      }
      setStatus("success");
      setSubmissionId(data.submissionId);
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between pb-6 mb-8 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
              ⚡
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CreditPulse AI
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              ← Back to App
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wide uppercase mb-4 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Institutional Partner Program & LOI
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Join the <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">CreditPulse Private Alpha</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Integrate real-time autonomous credit scoring and Merton jump-diffusion risk telemetry directly into your lending pools before mainnet launch.
          </p>
        </div>

        {/* Form / Success Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-6 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600" />

          {status === "success" ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-lg shadow-emerald-500/10 animate-bounce">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Application Received!</h3>
              <p className="text-slate-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Thank you for applying for the CreditPulse AI Institutional Partner Network. Our core engineering team will contact you within 24 hours.
              </p>
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs text-slate-400 inline-block mb-8">
                Submission Reference: <span className="text-cyan-400 font-bold">{submissionId}</span>
              </div>
              <div>
                <Link
                  href="/"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95 transition"
                >
                  Return to Live Risk Terminal
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Full Name / Alias *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Alex Vance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="alex@protocol.finance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Protocol / Fund / SPV Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="Apex Capital / Horizon Lending"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Protocol Category
                  </label>
                  <select
                    value={form.protocolType}
                    onChange={(e) => setForm({ ...form, protocolType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition"
                  >
                    <option value="DeFi Lending Protocol">DeFi Lending Protocol (Aave / Compound fork)</option>
                    <option value="RWA Treasury / Private Credit">RWA Treasury / Private Credit SPV</option>
                    <option value="Liquid Staking / Restaking">Liquid Staking / Restaking (LRT)</option>
                    <option value="Institutional Credit Bureau">Institutional Fund / Risk Committee</option>
                    <option value="Other">Other Institutional Participant</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Anticipated Monthly Loan / Collateral Volume
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {["< $1M", "$1M - $10M", "$10M - $50M", "$50M+"].map((vol) => (
                    <button
                      type="button"
                      key={vol}
                      onClick={() => setForm({ ...form, monthlyLoanVolume: vol })}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                        form.monthlyLoanVolume === vol
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {vol}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Integration Needs / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Need custom risk oracle feed for uncollateralized credit tranches..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition resize-none"
                />
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-bold rounded-xl text-sm shadow-xl shadow-cyan-500/20 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    Request Early Access & Partner LOI →
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <div className="text-cyan-400 text-lg mb-1">⚡</div>
            <div className="text-xs font-bold text-white mb-1">Dedicated DON Cluster</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">Custom validator threshold & ultra-low latency oracle feeds.</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <div className="text-blue-400 text-lg mb-1">🛡️</div>
            <div className="text-xs font-bold text-white mb-1">Insurance Priority</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">First-loss protection tranches allocated to Alpha partners.</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <div className="text-purple-400 text-lg mb-1">📦</div>
            <div className="text-xs font-bold text-white mb-1">1-Click SDK Integration</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">Native TypeScript & Solidity interfaces for fast onboarding.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
