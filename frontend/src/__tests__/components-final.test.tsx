import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  Radar: () => <div data-testid="radar" />,
  RadarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/config', () => ({
  DON_NODES: [],
  EXPLORER_URL: 'https://test.blockscout.com',
  PRESET_ASSETS: [],
}))

// ── RiskMetrics helpers (pure functions) ────────────────────
import { getScoreColor, getScoreText, getVerdictStyle, RiskMetrics } from '@/components/RiskMetrics'

describe('getScoreColor', () => {
  it('returns emerald for score >= 80', () => {
    expect(getScoreColor(85).bar).toBe('bg-emerald-500')
  })
  it('returns cyan for score 60-79', () => {
    expect(getScoreColor(65).bar).toBe('bg-cyan-500')
  })
  it('returns amber for score 40-59', () => {
    expect(getScoreColor(45).bar).toBe('bg-amber-500')
  })
  it('returns rose for score < 40', () => {
    expect(getScoreColor(20).bar).toBe('bg-rose-500')
  })
})

describe('getScoreText', () => {
  it('returns Excellent for 85+', () => {
    expect(getScoreText(90)).toBe('Excellent')
  })
  it('returns Good for 70-84', () => {
    expect(getScoreText(75)).toBe('Good')
  })
  it('returns Fair for 50-69', () => {
    expect(getScoreText(55)).toBe('Fair')
  })
  it('returns Poor for 30-49', () => {
    expect(getScoreText(35)).toBe('Poor')
  })
  it('returns Critical for < 30', () => {
    expect(getScoreText(10)).toBe('Critical')
  })
})

describe('getVerdictStyle', () => {
  it('returns emerald for LOW RISK', () => {
    expect(getVerdictStyle('LOW RISK').text).toBe('text-emerald-400')
  })
  it('returns rose for HIGH RISK', () => {
    expect(getVerdictStyle('HIGH RISK').text).toBe('text-rose-400')
  })
  it('returns cyan for MODERATE', () => {
    expect(getVerdictStyle('MODERATE RISK').text).toBe('text-cyan-400')
  })
})

// ── RiskMetrics component ───────────────────────────────────
describe('RiskMetrics', () => {
  const result = {
    score: 82,
    liquidity: 85,
    collateral: 78,
    security: 90,
    audit: 80,
    volatility_score: 75,
    governance: 70,
    verdict: 'LOW RISK — Investment Grade',
    circuit_breaker_active: false,
  }

  it('renders Detailed Breakdown header', () => {
    render(<RiskMetrics result={result} />)
    expect(screen.getByText(/Detailed Breakdown/i)).toBeInTheDocument()
  })

  it('renders sub-score dimensions', () => {
    const { container } = render(<RiskMetrics result={result} />)
    expect(container.textContent).toContain('Liquidity')
    expect(container.textContent).toContain('85%')
  })

  it('shows circuit breaker when active', () => {
    render(<RiskMetrics result={{ ...result, circuit_breaker_active: true, circuit_breaker_reason: 'TVL drop' }} />)
    expect(screen.getByText(/Circuit Breaker/i)).toBeInTheDocument()
  })
})

// ── ScoreHeader ─────────────────────────────────────────────
import { ScoreHeader } from '@/components/ScoreHeader'

describe('ScoreHeader', () => {
  it('renders score number', () => {
    render(<ScoreHeader score={85} displayScore={85} rwaType="DeFi" />)
    expect(screen.getByText(/85/)).toBeInTheDocument()
  })

  it('renders asset category', () => {
    render(<ScoreHeader score={85} displayScore={85} rwaType="DeFi" />)
    expect(screen.getByText(/DeFi/i)).toBeInTheDocument()
  })

  it('renders protocol name when provided', () => {
    render(<ScoreHeader score={85} displayScore={85} rwaType="DeFi" protocolName="Aave" />)
    expect(screen.getByText(/Aave/i)).toBeInTheDocument()
  })

  it('renders TVL when provided', () => {
    render(<ScoreHeader score={85} displayScore={85} rwaType="DeFi" tvl="$1.2B" />)
    expect(screen.getByText(/\$1\.2B/)).toBeInTheDocument()
  })
})

// ── RadarChartComponent ─────────────────────────────────────
import { RadarChartComponent } from '@/components/RadarChartComponent'

describe('RadarChartComponent', () => {
  it('renders without crashing', () => {
    const data = [
      { subject: 'Liquidity', A: 85 },
      { subject: 'Collateral', A: 78 },
      { subject: 'Security', A: 90 },
    ]
    const { container } = render(<RadarChartComponent data={data} />)
    expect(container.firstChild).not.toBeNull()
  })
})

// ── DONClusterMonitor ───────────────────────────────────────
import { DONClusterMonitor } from '@/components/DONClusterMonitor'

describe('DONClusterMonitor', () => {
  it('renders nothing when no nodes', () => {
    const { container } = render(<DONClusterMonitor nodes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders BFT Quorum badge with nodes', () => {
    const nodes = [
      { name: 'Node 1', region: 'us-east-1', status: 'online', latency_ms: 45 },
      { name: 'Node 2', region: 'eu-west-1', status: 'online', latency_ms: 62 },
      { name: 'Node 3', region: 'ap-ne-1', status: 'offline', latency_ms: 0 },
    ]
    render(<DONClusterMonitor nodes={nodes as any} />)
    expect(screen.getByText(/BFT Quorum/i)).toBeInTheDocument()
  })
})
