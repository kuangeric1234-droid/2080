import { Ajv } from 'ajv'
import type pg from 'pg'
import { loadSkill, type SkillDefinition } from './loader.ts'
import type { ModelClient } from './model.ts'
import {
  WORKSPACE_ID, executePayload, id, inputHash, type ActionPayload, type ActionResult,
} from './gates.ts'

const ajv = new Ajv()

export interface RunOptions {
  skill: string
  version?: string
  clientId: string | null
  trigger: string
  input: unknown
  skillsDir?: string
}

export interface RunOutcome {
  runId: string
  definition: SkillDefinition
  error: string | null
  output: unknown
  gateItemId: string | null
  executed: ActionResult | null
}

/** Runs a versioned skill: model call, structured-output validation, run
    logging, then the gate framework decides what happens (SPEC-SPINE §4). */
export async function runSkill(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  opts: RunOptions,
): Promise<RunOutcome> {
  const definition = loadSkill(opts.skill, opts.version, opts.skillsDir)
  const runId = id('run')
  const hash = inputHash(opts.input)
  const started = Date.now()

  let output: unknown = null
  let error: string | null = null
  let tokensIn = 0
  let tokensOut = 0
  let costCents = 0

  try {
    const response = await model.complete({
      system: definition.systemPrompt,
      input: opts.input,
      outputSchema: definition.outputSchema,
      tier: definition.modelTier,
    })
    tokensIn = response.tokensIn
    tokensOut = response.tokensOut
    costCents = response.costCents
    const validate = ajv.compile(definition.outputSchema)
    if (validate(response.output)) {
      output = response.output
    } else {
      error = `structured output failed schema validation: ${ajv.errorsText(validate.errors)}`
    }
  } catch (err) {
    error = (err as Error).message
  }

  await db.query(
    `INSERT INTO skill_runs (id, workspace_id, skill, version, client_id, trigger, input_hash,
       output, gate, tokens_in, tokens_out, cost_cents, latency_ms, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      runId, WORKSPACE_ID, definition.name, definition.version, opts.clientId, opts.trigger,
      hash, output == null ? null : JSON.stringify(output), definition.gate,
      tokensIn, tokensOut, costCents, Date.now() - started, error,
    ],
  )

  if (error || output == null) {
    return { runId, definition, error, output: null, gateItemId: null, executed: null }
  }

  const payload: ActionPayload = {
    kind: definition.action,
    client_id: opts.clientId,
    data: { ...(output as Record<string, unknown>), created_by: `${definition.name}@${definition.version}` },
  }

  /* G0 silent / G1 auto-but-visible: execute immediately; G1 records an
     `auto` gate item for the audit trail (§4). G2/G3: a pending item waits
     for a human — the payload is frozen here. */
  if (definition.gate === 'G0' || definition.gate === 'G1') {
    const executed = await executePayload(db, payload)
    let gateItemId: string | null = null
    if (definition.gate === 'G1') {
      gateItemId = id('gate')
      await db.query(
        `INSERT INTO gate_items (id, workspace_id, skill_run_id, gate, state, payload, acted_by, acted_at)
         VALUES ($1, $2, $3, $4, 'auto', $5, 'gate-framework', now())`,
        [gateItemId, WORKSPACE_ID, runId, definition.gate, JSON.stringify(payload)],
      )
    }
    await db.query(`UPDATE skill_runs SET gate_outcome = 'auto' WHERE id = $1`, [runId])
    return { runId, definition, error: null, output, gateItemId, executed }
  }

  const gateItemId = id('gate')
  const expiresAt =
    definition.expiresHours == null
      ? null
      : new Date(Date.now() + definition.expiresHours * 3_600_000)
  await db.query(
    `INSERT INTO gate_items (id, workspace_id, skill_run_id, gate, state, payload, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
    [gateItemId, WORKSPACE_ID, runId, definition.gate, JSON.stringify(payload), expiresAt],
  )
  return { runId, definition, error: null, output, gateItemId, executed: null }
}
