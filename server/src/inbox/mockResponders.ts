/* PROVISIONAL (BLOCKERS.md: anthropic-api-key) — deterministic rule-based
   stand-ins for the W2 skills so the pipeline is testable and demoable
   without credentials. Never a substitute for the real model: email-triage's
   exam is the team's 150 labelled emails, and these mocks never leave dev. */

import type { TriageOutput } from './pipeline.ts'

interface TriageInput {
  from: string
  subject: string
  body: string
  thread_known: boolean
  client_name: string | null
}

export function mockTriage(input: TriageInput): TriageOutput {
  const text = `${input.subject}\n${input.body}`.toLowerCase()
  const bodyOnly = input.body.toLowerCase().trim()
  const requests: TriageOutput['requests'] = []
  let tone: TriageOutput['tone'] = 'friendly'

  // pleasantries on a known thread are noise — judge the new content only,
  // the Re: subject would re-trigger request rules
  if (input.thread_known && bodyOnly.length < 60 && /^(thanks|thank you|great|perfect|cheers)/.test(bodyOnly)) {
    return { confidence: 0.96, thread_action: 'noise', tone: 'friendly', reply_language: 'en', requests: [] }
  }

  const injection = /ignore (all )?(previous |prior )?instructions|client database|system prompt/.test(text)
  if (injection) {
    return {
      confidence: 0.95, thread_action: 'new', tone: 'neutral', reply_language: 'en',
      requests: [{ type: 'spam', summary: 'suspected injection/junk', urgency: 'normal', assets_missing: [], sla_days: 0, route: 'file' }],
    }
  }

  if (/not happy|cancel|lawyer|unacceptable|third time/.test(text)) {
    tone = 'upset'
    requests.push({
      type: 'complaint', summary: 'client is dissatisfied — call them', urgency: 'urgent',
      assets_missing: [], sla_days: 0, route: 'wally',
    })
  }
  if (/\bbio\b/.test(text)) {
    requests.push({
      type: 'team_member_add', summary: 'New bio for the team page', urgency: 'normal',
      assets_missing: /attached soon|to follow|will send/.test(text) ? ['bio copy', 'headshot'] : [],
      sla_days: 3, route: 'web',
    })
  }
  if (/pricing|fees page|price/.test(text)) {
    requests.push({
      type: 'content_change', summary: 'Update pricing on the fees page', urgency: 'normal',
      assets_missing: [], sla_days: 2, route: 'web',
    })
  }
  if (/hours|open saturdays|opening/.test(text)) {
    const dated = /from \d|starting|effective/.test(text)
    requests.push({
      type: 'hours_change', summary: 'Update opening hours', urgency: dated ? 'scheduled' : 'normal',
      effective_date: dated ? '2026-08-01' : null, assets_missing: [], sla_days: 2, route: 'web',
    })
  }
  if (/google ads|push the|special/.test(text) && !/pricing/.test(text)) {
    requests.push({
      type: 'ads_request', summary: 'Ads change request', urgency: 'normal',
      assets_missing: [], sla_days: 0, route: 'specialist',
    })
  }
  if (/attached|photos|images|files for/.test(text) && requests.length === 0) {
    requests.push({
      type: 'asset_delivery', summary: 'Client sent files', urgency: 'normal',
      assets_missing: [], sla_days: 0, route: 'assets',
    })
  }
  if (/when does|is it|quick one|question/.test(text) && requests.length === 0) {
    requests.push({
      type: 'question', summary: 'Client question — reply only', urgency: 'normal',
      assets_missing: [], sla_days: 1, route: 'reply_only',
    })
  }
  if (/catalogue|newsletter|unsubscribe/.test(text) && requests.length === 0) {
    requests.push({ type: 'fyi', summary: 'not actionable', urgency: 'normal', assets_missing: [], sla_days: 0, route: 'file' })
  }

  const isNoise = input.thread_known && requests.length === 0 && /thanks|great|perfect/.test(text)
  if (isNoise) {
    return { confidence: 0.96, thread_action: 'noise', tone, reply_language: 'en', requests: [] }
  }
  if (requests.length === 0) {
    return {
      confidence: 0.5, thread_action: 'new', tone, reply_language: 'en',
      requests: [{ type: 'unknown', summary: 'could not classify', urgency: 'normal', assets_missing: [], sla_days: 0, route: 'human_queue' }],
    }
  }
  return {
    confidence: 0.93,
    thread_action: input.thread_known ? 'append' : 'new',
    tone,
    reply_language: /[一-鿿]/.test(text) ? 'zh' : 'en',
    requests,
  }
}

export function mockAck(input: {
  client_name: string
  sender_name: string | null
  requests: Array<{ summary: string; sla_days: number; assets_missing: string[] }>
}): { subject: string; body: string } {
  const lines = input.requests.map((r) =>
    `- ${r.summary}${r.sla_days > 0 ? ` — within ${r.sla_days} business days` : ' — our specialist will review and come back to you'}`)
  const missing = input.requests.flatMap((r) => r.assets_missing)
  return {
    subject: 'Re: your request',
    body: [
      `Hi ${input.sender_name ?? input.client_name},`,
      '',
      'Got it. Here is what we will do:',
      ...lines,
      ...(missing.length ? ['', `Could you send through: ${[...new Set(missing)].join(', ')}.`] : []),
      '',
      'The 20-80 team',
      '(mock draft — no ANTHROPIC_API_KEY configured)',
    ].join('\n'),
  }
}

export function mockCompletion(input: {
  client_name: string
  request_summary: string
  evidence: Array<{ label: string; url: string }>
}): { subject: string; body: string } {
  return {
    subject: 'Re: your request — done',
    body: [
      `Hi ${input.client_name},`,
      '',
      `Done: ${input.request_summary}.`,
      ...input.evidence.map((e) => `${e.label}: ${e.url}`),
      '',
      'The 20-80 team',
      '(mock draft — no ANTHROPIC_API_KEY configured)',
    ].join('\n'),
  }
}
