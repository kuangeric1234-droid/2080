import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { groundingViolations } from '../src/review/summarise.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.join(HERE, '../../skills/review-summariser/v1')

/* §13.2 step 1.10. The bank ships house copy verbatim; these two paragraphs are
   the one place a model writes prose about a real business. The grounding check
   is what stops "your site loads in 8.4 seconds" reaching a dentist when
   nothing measured 8.4 seconds. */
describe('review-summariser grounding', () => {
  const evidence = [
    'The website is not using the SSL/HTTPS protocol which means it is not secure.',
    'Body text is too small at 13px, which is hard to read on a phone.',
    'stellarsmiles.com.au',
    '2',
  ].join('\n')

  it('passes a summary that only compresses what the findings said', () => {
    const ok = 'There are a number of areas of improvement, particularly security and how the site reads on a phone.'
    expect(groundingViolations(ok, evidence)).toEqual([])
  })

  it('passes a number that genuinely came from a finding', () => {
    expect(groundingViolations('Body text sits at 13px, below a comfortable reading size.', evidence)).toEqual([])
  })

  it('catches an invented measurement', () => {
    const bad = 'Your site loads in 8.4 seconds, which is slower than most practices.'
    expect(groundingViolations(bad, evidence)).toContain('8.4')
  })

  it('catches an invented percentage', () => {
    expect(groundingViolations('You are behind 90% of comparable practices.', evidence)).toContain('90%')
  })

  it('catches an invented competitor domain', () => {
    const bad = 'Competitors such as brightsmile.com.au outrank you.'
    expect(groundingViolations(bad, evidence)).toContain('brightsmile.com.au')
  })

  it('does not flag the practice’s own domain', () => {
    expect(groundingViolations('Traffic to stellarsmiles.com.au is not being measured.', evidence)).toEqual([])
  })

  it('reports every distinct invention, not just the first', () => {
    const bad = 'You load in 8.4 seconds and rank behind 90% of practices.'
    const found = groundingViolations(bad, evidence)
    expect(found).toContain('8.4')
    expect(found).toContain('90%')
  })
})

/* BUILD-LOOP.md: skills never go live on synthetic exams. This asserts the
   exam admits to being synthetic, so the marker cannot quietly disappear when
   somebody adds a case. */
describe('review-summariser golden set', () => {
  const golden = JSON.parse(readFileSync(path.join(SKILL, 'golden.provisional.json'), 'utf8'))

  it('is labelled PROVISIONAL and stays within the 10-case synthetic cap', () => {
    expect(golden.PROVISIONAL).toBe(true)
    expect(golden.cases.length).toBeGreaterThan(0)
    expect(golden.cases.length).toBeLessThanOrEqual(10)
  })

  it('gives every case findings and something it must not invent', () => {
    for (const c of golden.cases) {
      expect(c.input.findings.length, `${c.id}: no findings`).toBeGreaterThan(0)
      expect(c.forbidden_substrings.length, `${c.id}: nothing forbidden`).toBeGreaterThan(0)
    }
  })

  it('declares the skill at G1 with the judgement-tier model', () => {
    const meta = JSON.parse(readFileSync(path.join(SKILL, 'skill.json'), 'utf8'))
    expect(meta.gate).toBe('G1')
    expect(meta.model_tier).toBe('top')
  })

  /* The prompt is the only thing standing between the model and a claim about
     someone's business, so the rule has to actually be in it. */
  it('states the grounding rule in SKILL.md', () => {
    const md = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8')
    expect(md).toMatch(/Every fact in your output must already be in `findings`/)
    expect(md).toMatch(/never comment on the practice's treatments/i)
  })
})
