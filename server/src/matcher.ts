import type pg from 'pg'
import { WORKSPACE_ID, id } from './skills/gates.ts'

/* Entity matcher — SPEC-SPINE §3: deterministic first, then scored.
   ≥0.8 auto-attach · 0.5–0.8 human queue · below that, prospect flow.
   Ties always queue; two candidate clients are never auto-merged. */

/** Identifying refs extracted from an inbound event. */
export interface InboundRefs {
  phoneDid?: string
  adsAccount?: string
  brightlocalAccount?: string
  gbpAccount?: string
  portalSession?: string
  acProject?: string
  emailFrom?: string
  threadId?: string
  signatureName?: string
  bodyPhone?: string
}

export interface Candidate {
  clientId: string
  via: string
}

export type MatchResult =
  | { decision: 'auto'; clientId: string; confidence: number; method: string }
  | { decision: 'queue'; candidates: Candidate[]; confidence: number; method: string }
  | { decision: 'prospect'; confidence: number }

/** The timeline event an ingest wants to write (client_id comes from the match). */
export interface InboundEvent {
  type: string
  occurredAt: string
  title: string
  body?: string | null
  payload?: Record<string, unknown>
  source: string
  sourceRef?: string | null
  visibility?: 'agency_only' | 'client_visible'
}

const REF_MAP_KINDS: Array<[keyof InboundRefs, string]> = [
  ['phoneDid', 'phone_did'],
  ['adsAccount', 'ads_account'],
  ['brightlocalAccount', 'brightlocal'],
  ['gbpAccount', 'gbp'],
  ['portalSession', 'portal_session'],
  ['acProject', 'ac_project'],
]

const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? ''
const norm = (s: string) => s.trim().toLowerCase()
const normPhone = (s: string) => s.replace(/[^\d+]/g, '')

async function mapLookup(db: pg.Client | pg.Pool, kind: string, key: string): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT client_id FROM entity_maps WHERE workspace_id = $1 AND kind = $2 AND external_key = $3`,
    [WORKSPACE_ID, kind, key],
  )
  return rows[0]?.client_id ?? null
}

export async function matchInbound(db: pg.Client | pg.Pool, refs: InboundRefs): Promise<MatchResult> {
  // ① exact source-ref maps → 1.0 (unique per kind+key by constraint)
  for (const [refKey, kind] of REF_MAP_KINDS) {
    const value = refs[refKey]
    if (!value) continue
    const clientId = await mapLookup(db, kind, norm(value))
    if (clientId) return { decision: 'auto', clientId, confidence: 1.0, method: kind }
  }

  // ② contact email exact (plus learned email mappings) → 0.98
  if (refs.emailFrom) {
    const email = norm(refs.emailFrom)
    const { rows } = await db.query(
      `SELECT DISTINCT ct.client_id FROM contacts ct
         WHERE EXISTS (SELECT 1 FROM unnest(ct.email) e WHERE lower(e) = $1)
       UNION SELECT client_id FROM entity_maps WHERE workspace_id = $2 AND kind = 'email' AND external_key = $1`,
      [email, WORKSPACE_ID],
    )
    if (rows.length === 1) {
      return { decision: 'auto', clientId: rows[0].client_id, confidence: 0.98, method: 'contact_email' }
    }
    if (rows.length > 1) {
      // ties always queue — never auto-merge
      return {
        decision: 'queue',
        candidates: rows.map((r) => ({ clientId: r.client_id, via: 'contact_email' })),
        confidence: 0.7,
        method: 'contact_email_tie',
      }
    }
  }

  // ③ thread continuity → 0.97
  if (refs.threadId) {
    const clientId = await mapLookup(db, 'thread', norm(refs.threadId))
    if (clientId) return { decision: 'auto', clientId, confidence: 0.97, method: 'thread' }
  }

  // ④ domain match → 0.90; shared domain (2+ clients) never autos
  let knownDomain = false
  if (refs.emailFrom) {
    const domain = domainOf(refs.emailFrom)
    if (domain) {
      const { rows } = await db.query(
        `SELECT client_id FROM entity_maps WHERE workspace_id = $1 AND kind = 'domain' AND external_key = $2
         UNION SELECT DISTINCT ct.client_id FROM contacts ct
           WHERE EXISTS (SELECT 1 FROM unnest(ct.email) e WHERE split_part(lower(e), '@', 2) = $2)`,
        [WORKSPACE_ID, domain],
      )
      if (rows.length === 1) {
        return { decision: 'auto', clientId: rows[0].client_id, confidence: 0.9, method: 'domain' }
      }
      if (rows.length > 1) {
        return {
          decision: 'queue',
          candidates: rows.map((r) => ({ clientId: r.client_id, via: 'domain' })),
          confidence: 0.7,
          method: 'domain_shared',
        }
      }
      knownDomain = false // domain present but unknown
    }
  }

  // ⑤ fuzzy: name in signature and/or phone in body → ≤0.7 (always queues)
  const fuzzy = new Map<string, { clientId: string; score: number; via: string }>()
  if (refs.signatureName && norm(refs.signatureName).length >= 5) {
    const needle = norm(refs.signatureName)
    const { rows } = await db.query(
      `SELECT DISTINCT ct.client_id FROM contacts ct
       WHERE position(lower(ct.name) IN $1) > 0 OR position($1 IN lower(ct.name)) > 0`,
      [needle],
    )
    for (const r of rows) fuzzy.set(r.client_id, { clientId: r.client_id, score: 0.6, via: 'signature_name' })
  }
  if (refs.bodyPhone) {
    const phone = normPhone(refs.bodyPhone)
    if (phone.length >= 8) {
      const { rows } = await db.query(
        `SELECT DISTINCT ct.client_id FROM contacts ct
         WHERE EXISTS (SELECT 1 FROM unnest(ct.phone) p WHERE regexp_replace(p, '[^0-9+]', '', 'g') = $1)`,
        [phone],
      )
      for (const r of rows) {
        const existing = fuzzy.get(r.client_id)
        if (existing) {
          existing.score = 0.7
          existing.via = 'signature_name+phone'
        } else {
          fuzzy.set(r.client_id, { clientId: r.client_id, score: 0.65, via: 'body_phone' })
        }
      }
    }
  }
  if (fuzzy.size > 0) {
    const candidates = [...fuzzy.values()].sort((a, b) => b.score - a.score)
    return {
      decision: 'queue',
      candidates: candidates.map((c) => ({ clientId: c.clientId, via: c.via })),
      confidence: candidates[0].score,
      method: 'fuzzy',
    }
  }

  void knownDomain
  return { decision: 'prospect', confidence: 0.2 }
}

async function attachTimeline(
  db: pg.Client | pg.Pool,
  clientId: string,
  event: InboundEvent,
): Promise<string> {
  const evtId = id('evt')
  await db.query(
    `INSERT INTO timeline_events (id, workspace_id, client_id, type, occurred_at, title, body, payload, source, source_ref, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      evtId, WORKSPACE_ID, clientId, event.type, event.occurredAt, event.title,
      event.body ?? null, JSON.stringify(event.payload ?? {}), event.source,
      event.sourceRef ?? null, event.visibility ?? 'agency_only',
    ],
  )
  return evtId
}

export async function learnMapping(
  db: pg.Client | pg.Pool,
  kind: string,
  externalKey: string,
  clientId: string,
  learnedFrom: string,
): Promise<void> {
  await db.query(
    `INSERT INTO entity_maps (id, workspace_id, kind, external_key, client_id, learned_from)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, kind, external_key) DO NOTHING`,
    [id('map'), WORKSPACE_ID, kind, norm(externalKey), clientId, learnedFrom],
  )
}

export type IngestResult =
  | { decision: 'auto'; clientId: string; eventId: string; confidence: number; method: string }
  | { decision: 'queue'; queueId: string; candidates: Candidate[]; confidence: number }
  | { decision: 'prospect'; queueId: string }

/** Routes an inbound event: auto-attach to the timeline, hold in the human
    queue, or hand to the prospect flow. Auto-attached email threads are
    learned so replies match on thread continuity. */
export async function ingestEvent(
  db: pg.Client | pg.Pool,
  refs: InboundRefs,
  event: InboundEvent,
): Promise<IngestResult> {
  const match = await matchInbound(db, refs)

  if (match.decision === 'auto') {
    const eventId = await attachTimeline(db, match.clientId, event)
    if (refs.threadId) await learnMapping(db, 'thread', refs.threadId, match.clientId, `matcher:${match.method}`)
    return { decision: 'auto', clientId: match.clientId, eventId, confidence: match.confidence, method: match.method }
  }

  const queueId = id('mq')
  await db.query(
    `INSERT INTO match_queue (id, workspace_id, refs, event, candidates, confidence, state)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      queueId, WORKSPACE_ID, JSON.stringify(refs), JSON.stringify(event),
      JSON.stringify(match.decision === 'queue' ? match.candidates : []),
      match.confidence,
      match.decision === 'queue' ? 'open' : 'prospect',
    ],
  )
  return match.decision === 'queue'
    ? { decision: 'queue', queueId, candidates: match.candidates, confidence: match.confidence }
    : { decision: 'prospect', queueId }
}

/** A human resolves a queued match. The choice becomes a mapping row — the
    matcher auto-matches this sender next time (SPEC-SPINE §3). */
export async function resolveMatch(
  db: pg.Client | pg.Pool,
  queueId: string,
  clientId: string,
  actor: string,
): Promise<{ eventId: string }> {
  const { rows } = await db.query(
    `SELECT refs, event, state FROM match_queue WHERE id = $1`, [queueId])
  if (rows.length === 0) throw new Error(`match queue item ${queueId} not found`)
  if (rows[0].state !== 'open') throw new Error(`match queue item ${queueId} is ${rows[0].state}, not open`)

  const refs = rows[0].refs as InboundRefs
  const event = rows[0].event as InboundEvent

  // learn the most specific ref the event carried
  if (refs.emailFrom) await learnMapping(db, 'email', refs.emailFrom, clientId, `queue:${actor}`)
  else if (refs.phoneDid) await learnMapping(db, 'phone_did', refs.phoneDid, clientId, `queue:${actor}`)
  else if (refs.bodyPhone) await learnMapping(db, 'phone_did', refs.bodyPhone, clientId, `queue:${actor}`)
  if (refs.threadId) await learnMapping(db, 'thread', refs.threadId, clientId, `queue:${actor}`)

  const eventId = await attachTimeline(db, clientId, event)
  await db.query(
    `UPDATE match_queue SET state = 'resolved', resolved_client_id = $1, resolved_by = $2, resolved_at = now() WHERE id = $3`,
    [clientId, actor, queueId],
  )
  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
     VALUES ($1, $2, 'human', $3, 'match.resolve', 'match_queue', $4, $5, $6)`,
    [id('aud'), WORKSPACE_ID, actor, queueId, clientId, `queued match assigned — mapping learned for future auto-match`],
  )
  return { eventId }
}
