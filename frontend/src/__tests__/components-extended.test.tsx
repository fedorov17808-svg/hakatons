import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── ActionButtons ───────────────────────────────────────────
import { ActionButtons } from '@/components/ActionButtons'

describe('ActionButtons', () => {
  const props = {
    submissionMode: 'direct' as const,
    txStep: 0,
    onSubmitDirect: vi.fn(),
    onSubmitRelayer: vi.fn(),
    onExport: vi.fn(),
  }

  it('renders submit button', () => {
    render(<ActionButtons {...props} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSubmitDirect for direct mode', () => {
    render(<ActionButtons {...props} />)
    const submitBtn = screen.getAllByRole('button')[0]
    fireEvent.click(submitBtn)
    expect(props.onSubmitDirect).toHaveBeenCalled()
  })

  it('disables button during submission (txStep between 1-2)', () => {
    render(<ActionButtons {...props} txStep={1} />)
    const submitBtn = screen.getAllByRole('button')[0]
    expect(submitBtn).toBeDisabled()
  })
})

// ── ExecutionModeSwitcher ────────────────────────────────────
import { ExecutionModeSwitcher } from '@/components/ExecutionModeSwitcher'

describe('ExecutionModeSwitcher', () => {
  it('renders execution mode label', () => {
    render(<ExecutionModeSwitcher mode="direct" onModeChange={vi.fn()} />)
    expect(screen.getByText(/Execution Mode/i)).toBeInTheDocument()
  })

  it('omits DON cluster status when no node data is available', () => {
    render(<ExecutionModeSwitcher mode="direct" onModeChange={vi.fn()} />)
    expect(screen.queryByText(/Federated DON Cluster/i)).not.toBeInTheDocument()
  })

  it('renders real DON node status and honestly reflects offline nodes', () => {
    render(
      <ExecutionModeSwitcher
        mode="direct"
        onModeChange={vi.fn()}
        donNodes={[
          { node_id: 'node-alpha', name: 'Node Alpha (Primary Validator)', address: '0xabc', region: 'AWS us-east-1', status: 'OFFLINE', latency_ms: 3.9 },
          { node_id: 'node-beta', name: 'Node Beta (Consensus Secondary)', address: '0xdef', region: 'GCP europe-west3', status: 'ONLINE', latency_ms: 12 },
        ]}
      />
    )
    expect(screen.getByText(/Node Alpha/i)).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 2 Nodes Online/i)).toBeInTheDocument()
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
  })
})

// ── OnChainHistory ──────────────────────────────────────────
import { OnChainHistory } from '@/components/OnChainHistory'

describe('OnChainHistory', () => {
  it('renders with empty records', () => {
    render(<OnChainHistory records={[]} loading={false} onRefresh={vi.fn()} />)
    expect(screen.getAllByText(/On-Chain/i).length).toBeGreaterThan(0)
  })

  it('renders records when provided', () => {
    const records = [
      { overallScore: 85, timestamp: Date.now() / 1000, isFinalized: true, dataHash: '0xabc' }
    ]
    render(<OnChainHistory records={records} loading={false} onRefresh={vi.fn()} />)
    expect(screen.getByText(/85/)).toBeInTheDocument()
  })

  it('calls onRefresh when refresh clicked', () => {
    const onRefresh = vi.fn()
    render(<OnChainHistory records={[]} loading={false} onRefresh={onRefresh} />)
    const refreshBtn = screen.getByRole('button')
    fireEvent.click(refreshBtn)
    expect(onRefresh).toHaveBeenCalled()
  })
})

// ── TxStatusPanel ───────────────────────────────────────────
import { TxStatusPanel } from '@/components/TxStatusPanel'

vi.mock('@/lib/config', () => ({
  EXPLORER_URL: 'https://creditcoin-testnet.blockscout.com',
  DON_NODES: [],
  PRESET_ASSETS: [
    { name: 'USDC', address: '0x1' },
    { name: 'AAVE', address: '0x2' },
  ],
}))

describe('TxStatusPanel', () => {
  it('renders nothing when txStep is 0', () => {
    const { container } = render(
      <TxStatusPanel txStep={0} txStatus="" txHash="" isCopied={false} onCopy={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders status text when txStep > 0', () => {
    render(
      <TxStatusPanel txStep={1} txStatus="Submitting..." txHash="" isCopied={false} onCopy={vi.fn()} />
    )
    expect(screen.getByText(/Submitting/)).toBeInTheDocument()
  })

  it('renders tx hash when available', () => {
    render(
      <TxStatusPanel txStep={3} txStatus="Confirmed" txHash="0xabc123def" isCopied={false} onCopy={vi.fn()} />
    )
    expect(screen.getByText(/0xabc123/)).toBeInTheDocument()
  })
})

// ── InstitutionalPortal ─────────────────────────────────────
import { InstitutionalPortal } from '@/components/InstitutionalPortal'

describe('InstitutionalPortal', () => {
  it('renders tokenomics section', () => {
    render(<InstitutionalPortal />)
    expect(screen.getAllByText(/CTC/i).length).toBeGreaterThan(0)
  })

  it('renders code snippets tabs', () => {
    render(<InstitutionalPortal />)
    expect(screen.getAllByText(/solidity/i).length).toBeGreaterThan(0)
  })
})

// ── AnalysisForm ────────────────────────────────────────────
import { AnalysisForm } from '@/components/AnalysisForm'

describe('AnalysisForm', () => {
  it('renders address input', () => {
    render(
      <AnalysisForm
        address="0x"
        onAddressChange={vi.fn()}
        onAnalyze={vi.fn()}
        loading={false}
        history={[]}
      />
    )
    const input = screen.getByDisplayValue('0x')
    expect(input).toBeInTheDocument()
  })
})
