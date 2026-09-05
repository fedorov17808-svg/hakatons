import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── Header ──────────────────────────────────────────────────
import { Header } from '@/components/Header'

describe('Header', () => {
  const defaultProps = {
    backendStatus: 'online' as const,
    onchainStats: { total_reports_onchain: 42, verified_cross_chain_proofs: 7, block_number: 12345 },
    account: null,
    connectWallet: vi.fn(),
    apiUrl: 'http://localhost:8000',
  }

  it('renders brand name', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText(/CreditPulse/i)).toBeInTheDocument()
  })

  it('shows online status badge', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText(/online/i)).toBeInTheDocument()
  })

  it('shows connect wallet button when no account', () => {
    render(<Header {...defaultProps} />)
    const btn = screen.getByText(/Connect/i)
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(defaultProps.connectWallet).toHaveBeenCalled()
  })

  it('shows truncated address when wallet connected', () => {
    render(<Header {...defaultProps} account="0x1234567890abcdef1234567890abcdef12345678" />)
    expect(screen.getByText(/0x1234/i)).toBeInTheDocument()
  })

  it('shows offline status', () => {
    render(<Header {...defaultProps} backendStatus="offline" />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})

// ── Footer ──────────────────────────────────────────────────
import { Footer } from '@/components/Footer'

describe('Footer', () => {
  it('renders version badge', () => {
    render(<Footer />)
    expect(screen.getByText(/v8\.5\.0/)).toBeInTheDocument()
  })

  it('renders Creditcoin reference', () => {
    render(<Footer />)
    expect(screen.getByText(/Creditcoin/)).toBeInTheDocument()
  })

  it('renders GitHub link', () => {
    render(<Footer />)
    const link = screen.getByText(/GitHub/i)
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com'))
  })
})

// ── LoadingSpinner ──────────────────────────────────────────
import { LoadingSpinner } from '@/components/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders loading text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText(/Querying Federated DON/i)).toBeInTheDocument()
  })

  it('shows estimated time', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText(/2-4 seconds/i)).toBeInTheDocument()
  })
})

// ── ErrorBanner ─────────────────────────────────────────────
import { ErrorBanner } from '@/components/ErrorBanner'

describe('ErrorBanner', () => {
  it('renders error message', () => {
    render(<ErrorBanner error="Something went wrong" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('renders nothing when error is empty', () => {
    const { container } = render(<ErrorBanner error="" onDismiss={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onDismiss when dismiss clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner error="Test error" onDismiss={onDismiss} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows info styling for INFO: prefix', () => {
    render(<ErrorBanner error="INFO: This is informational" onDismiss={vi.fn()} />)
    expect(screen.getByText(/This is informational/)).toBeInTheDocument()
  })
})

// ── AIAdvisory ──────────────────────────────────────────────
import { AIAdvisory } from '@/components/AIAdvisory'

describe('AIAdvisory', () => {
  it('renders narrative text', () => {
    render(<AIAdvisory narrative="Strong DeFi protocol with solid TVL" />)
    expect(screen.getByText(/Strong DeFi protocol/)).toBeInTheDocument()
  })

  it('renders Gemini AI badge', () => {
    render(<AIAdvisory narrative="Test" />)
    expect(screen.getByText(/Gemini AI/i)).toBeInTheDocument()
  })

  it('renders risk vectors when provided', () => {
    render(<AIAdvisory narrative="Test" risks={['Smart contract risk', 'Oracle dependency']} />)
    expect(screen.getByText(/Smart contract risk/)).toBeInTheDocument()
    expect(screen.getByText(/Oracle dependency/)).toBeInTheDocument()
  })

  it('renders without risks', () => {
    render(<AIAdvisory narrative="Test narrative" />)
    expect(screen.getByText(/Test narrative/)).toBeInTheDocument()
  })
})

// ── ScoringTransparency ─────────────────────────────────────
import { ScoringTransparency } from '@/components/ScoringTransparency'

describe('ScoringTransparency', () => {
  it('renders nothing when no breakdown or profile', () => {
    const { container } = render(<ScoringTransparency />)
    expect(container.firstChild).toBeNull()
  })

  it('renders weight profile', () => {
    render(
      <ScoringTransparency
        weightProfile={{ liquidity: 30, collateral: 25, security: 20, volatility: 15, governance: 10 }}
        scoringEngine="v7.2.0"
      />
    )
    expect(screen.getByText(/liquidity/i)).toBeInTheDocument()
  })

  it('renders seasoning score', () => {
    render(
      <ScoringTransparency
        weightProfile={{ test: 100 }}
        seasoningScore={85}
      />
    )
    expect(screen.getByText(/85/)).toBeInTheDocument()
  })
})

// ── ProofOfReserveCard ──────────────────────────────────────
import { ProofOfReserveCard } from '@/components/ProofOfReserveCard'

describe('ProofOfReserveCard', () => {
  const defaultProps = {
    data: {
      coverage_percent: 105,
      status: 'Fully Backed',
      custodian: 'Fireblocks',
      session_commitment: '0xabc123',
      reserve_ratio_bps: 10500,
    },
    txStep: 0,
    onMintCert: vi.fn(),
  }

  it('renders backing percentage', () => {
    render(<ProofOfReserveCard {...defaultProps} />)
    expect(screen.getByText(/105%/)).toBeInTheDocument()
  })

  it('renders custodian name', () => {
    render(<ProofOfReserveCard {...defaultProps} />)
    expect(screen.getByText(/Fireblocks/)).toBeInTheDocument()
  })

  it('renders reserve status', () => {
    render(<ProofOfReserveCard {...defaultProps} />)
    expect(screen.getByText(/Fully Backed/)).toBeInTheDocument()
  })
})
