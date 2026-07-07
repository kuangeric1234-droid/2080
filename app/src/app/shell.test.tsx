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

  it('redirects / to /today and shows the tab title in the topbar', () => {
    renderShell()
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('navigating a rail item swaps the page and topbar title', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('link', { name: /Audit Log/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeInTheDocument()
    expect(screen.getByText(/step 1\.7 of the build plan/)).toBeInTheDocument()
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
    const search = screen.getByRole('searchbox', { name: /Search clients/ })
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
