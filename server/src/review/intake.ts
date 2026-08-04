import pg from 'pg'
import { monotonicFactory } from 'ulid'
import { route } from '../notify.ts'
import type { MailSender } from '../inbox/connectors.ts'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

/* The free-SEO-audit form on 2080solutions.com.au lands here. Two rules govern
   this file, both learned from the fact that every submission is a lead:

   1. A webhook never loses a submission. The raw payload is stored before
      anything is parsed, so a field rename at Jotform costs a re-parse, not a
      lost prospect. A parse failure still creates the request and still tells
      Wally — it just tells him it needs a human look.
   2. A webhook never 500s on the sender. Jotform retries on error, and a retry
      storm against a half-working parser is worse than a recorded failure. */

export interface ParsedIntake {
  domain: string | null
  practiceName: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}

/* Jotform field names are whatever the form builder clicked — q3_email,
   typeA5_email, "Email Address", email. Match on meaning, not on key. */
const FIELD_PATTERNS: Array<[keyof ParsedIntake, RegExp]> = [
  ['domain', /(website|web_?site|url|domain|practice_?site)/i],
  ['practiceName', /(practice|business|clinic|company)[_\s]*(name)?/i],
  ['contactName', /(your_?name|full_?name|contact_?name|^name$|q\d+_name)/i],
  ['contactEmail', /(e-?mail)/i],
  ['contactPhone', /(phone|mobile|tel|contact_?number)/i],
]

/** Flatten Jotform's nested answers into plain key → text. */
function flatten(payload: unknown, prefix = '', into: Record<string, string> = {}): Record<string, string> {
  if (payload === null || payload === undefined) return into
  if (typeof payload !== 'object') {
    if (String(payload).trim()) into[prefix] = String(payload).trim()
    return into
  }
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') {
      // Jotform name fields arrive as {first, last}; join rather than nest
      const parts = Object.values(v as Record<string, unknown>).filter((x) => typeof x === 'string' && x.trim())
      if (parts.length && parts.length === Object.keys(v as object).length && parts.every((p) => typeof p === 'string')) {
        into[key] = parts.join(' ').trim()
      }
      flatten(v, key, into)
    } else {
      flatten(v, key, into)
    }
  }
  return into
}

export function parseJotform(payload: unknown): ParsedIntake {
  const flat = flatten(payload)
  const out: ParsedIntake = {
    domain: null, practiceName: null, contactName: null, contactEmail: null, contactPhone: null,
  }

  for (const [field, pattern] of FIELD_PATTERNS) {
    if (out[field]) continue
    for (const [key, value] of Object.entries(flat)) {
      const leaf = key.split('.').pop() ?? key
      if (!pattern.test(leaf)) continue
      // an email pattern must actually match an email, not a field merely named it
      if (field === 'contactEmail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) continue
      if (field === 'domain' && !looksLikeDomain(value)) continue
      out[field] = value
      break
    }
  }

  // last resort: any value in the payload that is unmistakably an email or a URL
  if (!out.contactEmail) {
    out.contactEmail = Object.values(flat).find((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) ?? null
  }
  if (!out.domain) {
    out.domain = Object.values(flat).find(looksLikeDomain) ?? null
  }
  if (out.domain) out.domain = normaliseDomain(out.domain)
  return out
}

export function looksLikeDomain(v: string): boolean {
  if (v.includes('@')) return false
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(v.trim())
}

export function normaliseDomain(v: string): string {
  return v.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()
}

/* Jotform posts form-encoded with the answers as a JSON string in
   `rawRequest`, or plain JSON if someone is testing with curl. Accept both. */
export function unwrapJotformBody(body: Record<string, unknown>): {
  payload: unknown
  externalId: string | null
} {
  const externalId =
    (body.submissionID as string) ?? (body.submission_id as string) ?? (body.id as string) ?? null

  const raw = body.rawRequest
  if (typeof raw === 'string') {
    try {
      return { payload: { ...body, rawRequest: JSON.parse(raw) }, externalId }
    } catch {
      return { payload: body, externalId }
    }
  }
  return { payload: body, externalId }
}

export interface IntakeResult {
  intakeRequestId: string
  reviewId: string
  duplicate: boolean
  parsed: ParsedIntake
  parseError: string | null
  notified: number
  emailed: boolean
}

/** Record a submission, open a review, and tell Wally — dashboard and email. */
export async function receiveIntake(
  db: pg.Client | pg.Pool,
  opts: {
    workspaceId: string
    source: string
    externalId: string | null
    payload: unknown
    mail?: MailSender
    notifyEmail?: string
    now?: Date
    /** Off when a human typed the domain in — they know it arrived. */
    notify?: boolean
  },
): Promise<IntakeResult> {
  const { workspaceId, source, externalId, payload } = opts

  // idempotency: a redelivered webhook returns the review it already made
  if (externalId) {
    const { rows } = await db.query(
      `SELECT ir.id AS intake_id, r.id AS review_id
         FROM intake_requests ir LEFT JOIN reviews r ON r.intake_request_id = ir.id
        WHERE ir.source = $1 AND ir.external_id = $2`,
      [source, externalId],
    )
    if (rows.length) {
      return {
        intakeRequestId: rows[0].intake_id,
        reviewId: rows[0].review_id,
        duplicate: true,
        parsed: parseJotform(payload),
        parseError: null,
        notified: 0,
        emailed: false,
      }
    }
  }

  const parsed = parseJotform(payload)
  const parseError = parsed.domain
    ? null
    : 'No website address found in the submission — set the domain by hand before collecting'

  const intakeId = id('itk')
  await db.query(
    `INSERT INTO intake_requests
       (id, workspace_id, source, external_id, payload, domain, practice_name,
        contact_name, contact_email, contact_phone, parse_error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [intakeId, workspaceId, source, externalId, JSON.stringify(payload), parsed.domain,
      parsed.practiceName, parsed.contactName, parsed.contactEmail, parsed.contactPhone, parseError],
  )

  const reviewId = id('rev')
  await db.query(
    `INSERT INTO reviews
       (id, workspace_id, intake_request_id, domain, practice_name, contact_name,
        contact_email, status, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8)`,
    [reviewId, workspaceId, intakeId, parsed.domain ?? '(not supplied)', parsed.practiceName,
      parsed.contactName, parsed.contactEmail, `${source}:webhook`],
  )

  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, why)
     VALUES ($1,$2,'system',$3,'review.requested','review',$4,$5)`,
    [id('aud'), workspaceId, `${source}:webhook`, reviewId,
      `Audit request from ${parsed.contactEmail ?? 'an unidentified sender'} for ${parsed.domain ?? 'no domain'}`],
  )

  const who = parsed.practiceName ?? parsed.domain ?? parsed.contactName ?? 'an unnamed practice'
  const title = parseError
    ? `Audit request needs a domain — ${who}`
    : `New audit request — ${who}`
  const body = [
    parsed.practiceName && `Practice: ${parsed.practiceName}`,
    parsed.domain && `Website: ${parsed.domain}`,
    parsed.contactName && `Contact: ${parsed.contactName}`,
    parsed.contactEmail && `Email: ${parsed.contactEmail}`,
    parsed.contactPhone && `Phone: ${parsed.contactPhone}`,
    parseError,
  ].filter(Boolean).join('\n')

  const notified = opts.notify === false ? [] : await route(db, {
    event_class: 'sales',
    severity: 'red',
    title,
    body,
    link: `/review/${reviewId}`,
  }, { now: opts.now })

  let emailed = false
  if (opts.notify !== false && opts.mail && opts.notifyEmail) {
    try {
      await opts.mail.send({
        to: opts.notifyEmail,
        subject: title,
        body: `${body}\n\nOpen the review: /review/${reviewId}\n`,
      })
      emailed = true
    } catch {
      // a failed notification email must not cost us the lead
      emailed = false
    }
  }

  return {
    intakeRequestId: intakeId,
    reviewId,
    duplicate: false,
    parsed,
    parseError,
    notified: notified.length,
    emailed,
  }
}

/* Type a URL and audit it — no enquiry, no form. This is the path for auditing
   an existing client, a prospect Wally met at a conference, or a competitor,
   and it is how most reviews will actually start.

   Reuses the same intake record so a hand-typed review is indistinguishable
   downstream from a Jotform one: same evidence trail, same audit log, same
   export. Only the notification is skipped — the person who typed it in does
   not need to be told it arrived. */
export async function startManualReview(
  db: pg.Client | pg.Pool,
  opts: {
    workspaceId: string
    url: string
    practiceName?: string | null
    contactName?: string | null
    contactEmail?: string | null
    actor: string
  },
): Promise<IntakeResult & { domain: string }> {
  const raw = (opts.url ?? '').trim()
  if (!raw) throw new Error('a website address is required')
  if (!looksLikeDomain(raw)) {
    throw new Error(`"${raw}" doesn’t look like a website address — try something like heartsdental.com.au`)
  }
  const domain = normaliseDomain(raw)

  /* An open review of the same site is almost always a double-entry rather
     than a deliberate re-audit, so hand it back instead of splitting the work
     across two records. A delivered one does not block a fresh audit — six
     months later, re-auditing is the point. */
  const { rows: open } = await db.query(
    `SELECT r.id AS review_id, r.intake_request_id
       FROM reviews r
      WHERE r.workspace_id = $1 AND r.domain = $2 AND r.status <> 'delivered'
      ORDER BY r.requested_at DESC LIMIT 1`,
    [opts.workspaceId, domain],
  )
  if (open.length) {
    return {
      intakeRequestId: open[0].intake_request_id,
      reviewId: open[0].review_id,
      duplicate: true,
      domain,
      parsed: {
        domain, practiceName: opts.practiceName ?? null, contactName: opts.contactName ?? null,
        contactEmail: opts.contactEmail ?? null, contactPhone: null,
      },
      parseError: null,
      notified: 0,
      emailed: false,
    }
  }

  const result = await receiveIntake(db, {
    workspaceId: opts.workspaceId,
    source: 'manual',
    externalId: null,
    notify: false,
    payload: {
      enteredBy: opts.actor,
      website: domain,
      practiceName: opts.practiceName ?? null,
      contactName: opts.contactName ?? null,
      email: opts.contactEmail ?? null,
    },
  })
  return { ...result, domain }
}
