"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

interface PipelineStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  data?: Record<string, unknown>;
  duration?: number;
  startedAt?: number;
}

const PIPELINE_STEPS: Array<{ id: string; icon: string; defaultLabel: string }> = [
  { id: "resolve_address", icon: "🔍", defaultLabel: "Validating address..." },
  { id: "fetch_price", icon: "💰", defaultLabel: "Fetching live ETH price..." },
  { id: "fetch_protocol", icon: "📊", defaultLabel: "Querying protocol intelligence..." },
  { id: "inspect_wallet", icon: "🔬", defaultLabel: "Inspecting on-chain wallet..." },
  { id: "cc3_balance", icon: "⛓️", defaultLabel: "Checking Creditcoin CC3 balance..." },
  { id: "merton_model", icon: "📐", defaultLabel: "Computing Merton default model..." },
  { id: "monte_carlo", icon: "🎲", defaultLabel: "Running Monte Carlo simulation..." },
  { id: "scoring", icon: "🏆", defaultLabel: "Calculating 7D risk score..." },
  { id: "sign_attestation", icon: "✍️", defaultLabel: "Signing EIP-712 attestation..." },
  { id: "ai_narrative", icon: "🤖", defaultLabel: "Generating credit narrative..." },
];

interface AnalysisPipelineProps {
  address: string;
  onComplete: (result: Record<string, unknown>) => void;
  onError: (error: string) => void;
}

export function AnalysisPipeline({ address, onComplete, onError }: AnalysisPipelineProps) {
  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map(s => ({ id: s.id, label: s.defaultLabel, status: "pending" }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const updateStep = useCallback((stepId: string, updates: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
  }, []);

  const runPipeline = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTotalTime(null);
    startTimeRef.current = Date.now();

    // Reset all steps
    setSteps(PIPELINE_STEPS.map(s => ({ id: s.id, label: s.defaultLabel, status: "pending" })));

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyze-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        onError(err.detail || "Analysis failed");
        setIsRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError("Stream unavailable");
        setIsRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            const { step, status, data } = event;

            if (step === "complete") {
              setTotalTime(Date.now() - startTimeRef.current);
              setIsRunning(false);
              onComplete(data);
              return;
            }

            if (step === "error") {
              onError(data?.error || "Pipeline failed");
              setIsRunning(false);
              return;
            }

            if (status === "running") {
              updateStep(step, {
                status: "running",
                label: data?.label || PIPELINE_STEPS.find(s => s.id === step)?.defaultLabel || "",
                startedAt: Date.now()
              });
            } else if (status === "done") {
              updateStep(step, {
                status: "done",
                data,
                duration: Date.now() - (steps.find(s => s.id === step)?.startedAt || Date.now())
              });
            } else if (status === "error") {
              updateStep(step, { status: "error", data });
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError((err as Error).message);
      }
    }

    setIsRunning(false);
  }, [address, isRunning, onComplete, onError, steps, updateStep]);

  // Auto-start when mounted
  useEffect(() => {
    runPipeline();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pipeline-container">
      <div className="pipeline-header">
        <h3 className="pipeline-title">
          {isRunning ? "⚡ Live Analysis Pipeline" : totalTime ? "✅ Analysis Complete" : "📡 Preparing Pipeline..."}
        </h3>
        {totalTime && (
          <span className="pipeline-time">{(totalTime / 1000).toFixed(1)}s total</span>
        )}
      </div>

      <div className="pipeline-steps">
        {steps.map((step, i) => {
          const meta = PIPELINE_STEPS[i];
          return (
            <div
              key={step.id}
              className={`pipeline-step pipeline-step--${step.status}`}
            >
              <div className="pipeline-step__indicator">
                {step.status === "running" ? (
                  <span className="pipeline-spinner" />
                ) : step.status === "done" ? (
                  <span className="pipeline-check">✓</span>
                ) : step.status === "error" ? (
                  <span className="pipeline-error-icon">✗</span>
                ) : (
                  <span className="pipeline-pending">{meta.icon}</span>
                )}
              </div>

              <div className="pipeline-step__content">
                <div className="pipeline-step__label">{step.label}</div>
                {step.status === "done" && step.data && (
                  <div className="pipeline-step__result">
                    {renderStepResult(step.id, step.data)}
                  </div>
                )}
              </div>

              {step.duration && step.status === "done" && (
                <span className="pipeline-step__duration">{step.duration}ms</span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .pipeline-container {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(0, 229, 255, 0.15);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(12px);
          margin: 20px 0;
        }
        .pipeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .pipeline-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0;
        }
        .pipeline-time {
          font-size: 0.85rem;
          color: #00e5ff;
          font-weight: 500;
          background: rgba(0, 229, 255, 0.1);
          padding: 4px 12px;
          border-radius: 20px;
        }
        .pipeline-steps {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pipeline-step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          transition: all 0.3s ease;
          opacity: 0.4;
        }
        .pipeline-step--running {
          opacity: 1;
          background: rgba(0, 229, 255, 0.06);
          border-left: 3px solid #00e5ff;
          animation: pulseGlow 1.5s ease-in-out infinite;
        }
        .pipeline-step--done {
          opacity: 1;
        }
        .pipeline-step--error {
          opacity: 1;
          background: rgba(255, 59, 48, 0.08);
          border-left: 3px solid #ff3b30;
        }
        .pipeline-step__indicator {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pipeline-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0, 229, 255, 0.2);
          border-top: 2px solid #00e5ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .pipeline-check {
          color: #34d399;
          font-size: 1rem;
          font-weight: bold;
        }
        .pipeline-error-icon {
          color: #ff3b30;
          font-size: 1rem;
          font-weight: bold;
        }
        .pipeline-pending {
          font-size: 1rem;
          filter: grayscale(0.7);
        }
        .pipeline-step__content {
          flex: 1;
          min-width: 0;
        }
        .pipeline-step__label {
          font-size: 0.9rem;
          color: #cbd5e1;
          font-weight: 500;
        }
        .pipeline-step--done .pipeline-step__label {
          color: #94a3b8;
        }
        .pipeline-step--running .pipeline-step__label {
          color: #e2e8f0;
        }
        .pipeline-step__result {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 2px;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .pipeline-step__duration {
          font-size: 0.75rem;
          color: #475569;
          flex-shrink: 0;
          font-family: 'SF Mono', monospace;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
          50% { box-shadow: 0 0 12px 2px rgba(0, 229, 255, 0.1); }
        }
      `}</style>
    </div>
  );
}

function renderStepResult(stepId: string, data: Record<string, unknown>): string {
  switch (stepId) {
    case "resolve_address":
      return `→ ${(data.address as string)?.slice(0, 10)}...${(data.address as string)?.slice(-6)}`;
    case "fetch_price":
      return `→ ETH = $${Number(data.ethPrice).toLocaleString('en-US')} (${data.source})`;
    case "fetch_protocol":
      return `→ ${data.protocolName} | TVL: $${Number(data.tvl || 0).toLocaleString('en-US')}`;
    case "inspect_wallet":
      return `→ ${data.isContract ? "Contract" : "EOA"} | ${data.tokenCount} tokens | via ${(data.rpcNodes as string[])?.join(", ")}`;
    case "cc3_balance":
      return `→ ${data.ctcBalance} CTC (${data.network})`;
    case "merton_model":
      return `→ P(default) = ${data.defaultProbability} | d₂ = ${data.distanceToDefault}`;
    case "monte_carlo":
      return `→ VaR₉₉ = ${data.var99} | CVaR₉₉ = ${data.cvar99} (${data.paths} paths)`;
    case "scoring":
      return `→ Overall: ${(data.dimensions as Record<string, unknown>) ? data.overall : "?"}/100 | Lindy: ${data.lindyMultiplier}×`;
    case "sign_attestation":
      return `→ Signed by ${data.signer} (${data.type})`;
    case "ai_narrative":
      return `→ ${data.narrativeLength} characters generated`;
    default:
      return JSON.stringify(data).slice(0, 60);
  }
}
