import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { GateCard, type GateItem } from './GateCard'

const item: GateItem = {
  id: 'gate_TEST',
  gate: 'G2',
  state: 'pending',
  payload: {
    kind: 'timeline.note',
    client_id: 'cl_x',
    data: {
      note_title: 'Hearts Dental is on the platform',
      note_body: 'Hearts Dental is now live. Current stage: operate.',
    },
  },
  expires_at: '2026-07-10T08:00:00Z',
  created_at: '2026-07-07T08:00:00Z',
  skill: 'hello-world',
  version: 'v1',
  trigger: 'manual',
  client_slug: 'hearts',
  client_name: 'Hearts Dental',
}

afterEach(() => vi.unstubAllGlobals())

describe('GateCard', () => {
  it('renders the gate chip, proposal and frozen payload', () => {
    render(<GateCard item={item} onSettled={() => {}} />)
    expect(screen.getByText('G2')).toBeInTheDocument()
    expect(screen.getByText(/hello-world proposes timeline\.note · Hearts Dental/)).toBeInTheDocument()
    expect(screen.getByText('Hearts Dental is on the platform')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve — post to timeline/ })).toBeInTheDocument()
  })

  it('approve posts to the API and reports back', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ outcome: 'executed' }) })
    vi.stubGlobal('fetch', fetchMock)
    const onSettled = vi.fn()
    const user = userEvent.setup()
    render(<GateCard item={item} onSettled={onSettled} />)
    await user.click(screen.getByRole('button', { name: /Approve/ }))
    await waitFor(() => expect(onSettled).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gate-items/gate_TEST/approve',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('reject requires a reason before it can be confirmed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ outcome: 'rejected' }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<GateCard item={item} onSettled={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    const confirm = screen.getByRole('button', { name: /Confirm reject/ })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /Rejection reason/ }), 'wrong tone')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gate-items/gate_TEST/reject',
      expect.objectContaining({ body: JSON.stringify({ actor: 'WC', reason: 'wrong tone' }) }),
    )
  })
})
