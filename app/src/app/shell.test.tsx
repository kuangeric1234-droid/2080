import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { NAV, NAV_ITEMS } from './nav'

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('app shell', () => {
  it('renders every nav group and item from the module map', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    for (const group of NAV) {
      expect(within(nav).getByText(group.group)).toBeInTheDocument()
    }
    for (const item of NAV_ITEMS) {
      expect(within(nav).getByRole('link', { name: new RegExp(item.label) })).toBeInTheDocument()
    }
  })

  it('carries exactly one rail item — the collapsed shell', () => {
    renderShell()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(NAV_ITEMS[0].id).toBe('review')
  })

  it('redirects / to /review and titles the topbar', () => {
    renderShell()
    expect(screen.getByRole('heading', { level: 1, name: /Online Presence Review/ })).toBeInTheDocument()
  })

  it('keeps parked-but-built modules reachable off-rail', () => {
    renderShell('/clients')
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    // reachable by URL...
    expect(within(nav).queryByRole('link', { name: /Clients/ })).not.toBeInTheDocument()
    // ...and titled from the off-rail map, not the fallback
    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0)
  })

  it('theme toggle flips data-theme on <html> and persists', async () => {
    const user = userEvent.setup()
    renderShell()
    const toggle = screen.getByRole('button', { name: /Switch to dark theme/ })
    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: /Switch to light theme/ }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('pressing / focuses the search input', async () => {
    const user = userEvent.setup()
    renderShell()
    const search = screen.getByRole('searchbox', { name: /Search reviews/ })
    expect(search).not.toHaveFocus()
    await user.keyboard('/')
    expect(search).toHaveFocus()
    // typing "/" while already in the field must not be swallowed
    await user.keyboard('abc/def')
    expect(search).toHaveValue('abc/def')
    await user.keyboard('{Escape}')
    expect(search).not.toHaveFocus()
  })
})
