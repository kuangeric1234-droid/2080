import { describe, expect, it } from 'vitest'
import { NoSerpProvider, renderCompetitorRow, renderFragment } from '../src/review/competitors.ts'
import { loadBank } from '../src/review/bank.ts'

/* §13.2 step 1.12. comp.row is a list of fragments joined with ', ' with the
   empty ones dropped — the template's own note says so. Three token forms
   appear in it and only the plainest is handled by bank.ts's render(), so the
   conditional ones are what these cover. */
describe('competitor row fragments', () => {
  it('substitutes a plain value', () => {
    expect(renderFragment('{{name}}', { name: 'Chapel Gate Dental' })).toBe('Chapel Gate Dental')
  })

  it('drops the whole fragment when the value is missing', () => {
    // "#{{serp_position}} in Google search" with no rank must not print "# in Google search"
    expect(renderFragment('#{{serp_position}} in Google search', {})).toBeNull()
    expect(renderFragment('#{{serp_position}} in Google search', { serp_position: 1 }))
      .toBe('#1 in Google search')
  })

  it('prints the word for a true flag and says nothing for a false one', () => {
    expect(renderFragment('{{corporate?Corporate}}', { corporate: true })).toBe('Corporate')
    expect(renderFragment('{{corporate?Corporate}}', { corporate: false })).toBeNull()
    expect(renderFragment('{{corporate?Corporate}}', {})).toBeNull()
  })

  it('says either word when the fact was measured', () => {
    expect(renderFragment('{{https?secure:not secure}}', { https: true })).toBe('secure')
    expect(renderFragment('{{https?secure:not secure}}', { https: false })).toBe('not secure')
  })

  /* The bug this caught: with no fact at all it printed "not secure" about a
     competitor nobody had checked — a claim about a named third party with
     nothing behind it. Not measured must differ from measured false. */
  it('says nothing at all when the fact was never measured', () => {
    expect(renderFragment('{{https?secure:not secure}}', {})).toBeNull()
  })

  it('treats "false" and "no" as false, so a hand-typed field behaves', () => {
    expect(renderFragment('{{booking?online booking}}', { booking: 'false' })).toBeNull()
    expect(renderFragment('{{booking?online booking}}', { booking: 'no' })).toBeNull()
    expect(renderFragment('{{booking?online booking}}', { booking: 'yes' })).toBe('online booking')
  })
})

describe('competitor row assembly', () => {
  const bank = loadBank()
  const row = bank.byId.get('comp.row')!

  it('builds the line from the bank template, not from the exporter', () => {
    const line = renderCompetitorRow(row, {
      name: 'Chapel Gate Dental',
      facts: {
        serp_position: 1, map_position: 1, https: false,
        booking: true, days_open: 6, review_count: 23, review_rating: 4.7,
      },
      threat: 7,
    })
    expect(line).toContain('Chapel Gate Dental')
    expect(line).toContain('#1 in Google search')
    expect(line).toContain('#1 in Google Map search')
    expect(line).toContain('not secure')
    expect(line).toContain('online booking')
    expect(line).toContain('open 6 days')
    expect(line).toContain('Threat: 7/10.')
  })

  it('omits everything nobody supplied rather than printing empty slots', () => {
    const line = renderCompetitorRow(row, { name: 'Only A Name' })
    expect(line).toBe('Only A Name')
    expect(line).not.toContain('{{')
    expect(line).not.toContain('#')
    expect(line).not.toContain('Threat')
  })

  it('never leaves an unfilled variable in a line bound for a client', () => {
    const line = renderCompetitorRow(row, {
      name: 'Partial Facts', facts: { https: true }, threat: 3,
    })
    expect(line).not.toMatch(/\{\{/)
    expect(line).toContain('secure')
    expect(line).toContain('Threat: 3/10.')
  })
})

/* The SERP half is deliberately empty until somebody buys a provider. */
describe('serp provider', () => {
  it('returns nothing rather than a plausible rank', async () => {
    expect(await new NoSerpProvider().lookup()).toBeNull()
  })

  it('admits to being provisional', () => {
    expect(new NoSerpProvider().provisional).toBe(true)
  })
})
