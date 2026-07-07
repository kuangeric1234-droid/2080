import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AuditPage } from './AuditPage'

const ENTRY = {
  id: 'aud_1',
  at: '2026-07-07T08:00:00Z',
  actor_type: 'human',
  actor_id: 'WC',
  action: 'gate.approve',
  target_type: 'gate_item',
  target_id: 'gate_x',
  why: 'ack-writer@v1 proposed email.send',
  rollback_of: null,
  client_slug: 'hearts',
  client_name: 'Hearts Dental',
}

afterEach(() => vi.unstubAllGlobals())

function stubFetch() {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const path = String(url)
    if (path.startsWith('/api/audit')) {
      return {
        ok: true,
        json: async () => ({ entries: [ENTRY], actors: ['WC', 'QG'], actions: ['gate.approve', 'flag.resolve'] }),
      }
    }
    if (path.startsWith('/api/clients')) {
      return { ok: true, json: async () => ({ clients: [{ slug: 'hearts', name: 'Hearts Dental' }] }) }
    }
    throw new Error(`unexpected fetch ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AuditPage', () => {
  it('renders entries with actor, action, client and why', async () => {
    stubFetch()
    render(<AuditPage />)
    expect(await screen.findByText('gate.approve', { selector: 'code' })).toBeInTheDocument()
    expect(screen.getByText('WC', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Hearts Dental', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText(/ack-writer@v1 proposed/)).toBeInTheDocument()
  })

  it('changing a filter refetches with the query param', async () => {
    const fetchMock = stubFetch()
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByText('gate.approve', { selector: 'code' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by actor' }), 'QG')
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('actor=QG')))
  })
})
