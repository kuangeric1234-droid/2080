import { Ajv } from 'ajv'
import { loadSkill } from './loader.ts'
import type { ModelClient } from './model.ts'
import type { TriageOutput } from '../inbox/pipeline.ts'

/* Golden-set eval harness (§12.4 recipe step 4). Works against any
   ModelClient — the real exam runs when ANTHROPIC_API_KEY and the team's
   labelled set arrive; until then only the PROVISIONAL synthetic set proves
   the harness itself. */

export interface TriageExpectation {
  types?: string[]           // exact multiset of request types
  types_include?: string     // this type must be present
  types_any?: string[]       // at least one of these present
  thread_action?: string
  tone?: string
  urgency?: string           // expected on the first request
  min_requests?: number
  max_requests?: number
}

export interface TriageGoldenCase {
  name: string
  input: unknown
  expect: TriageExpectation
}

export interface EvalCaseResult {
  name: string
  pass: boolean
  isComplaintCase: boolean
  isMultiCase: boolean
  detail: string
}

export interface TriageEvalReport {
  results: EvalCaseResult[]
  typeAccuracy: number     // share of cases fully correct
  splitRecall: number      // multi-request cases where every expected type was found
  complaintRecall: number  // complaint cases where a complaint was flagged (target: 1.0, always)
}

export async function evalTriageGoldenSet(
  model: ModelClient,
  cases: TriageGoldenCase[],
  skillsDir?: string,
): Promise<TriageEvalReport> {
  const def = loadSkill('email-triage', undefined, skillsDir)
  const validate = new Ajv().compile(def.outputSchema)
  const results: EvalCaseResult[] = []

  for (const gc of cases) {
    const isComplaintCase =
      gc.expect.types?.includes('complaint') === true || gc.expect.types_include === 'complaint'
    const isMultiCase = (gc.expect.types?.length ?? 0) > 1

    let pass = true
    let detail = 'ok'
    try {
      const response = await model.complete({
        system: def.systemPrompt, input: gc.input, outputSchema: def.outputSchema, tier: def.modelTier,
      })
      if (!validate(response.output)) throw new Error('schema invalid')
      const out = response.output as TriageOutput
      const types = out.requests.map((r) => r.type)

      const checks: Array<[boolean, string]> = [
        [gc.expect.types == null || (types.length === gc.expect.types.length && gc.expect.types.every((t) => types.includes(t))), `types ${types.join(',')}`],
        [gc.expect.types_include == null || types.includes(gc.expect.types_include), `missing ${gc.expect.types_include}`],
        [gc.expect.types_any == null || gc.expect.types_any.some((t) => types.includes(t)), `none of ${gc.expect.types_any?.join('/')}`],
        [gc.expect.thread_action == null || out.thread_action === gc.expect.thread_action, `thread_action ${out.thread_action}`],
        [gc.expect.tone == null || out.tone === gc.expect.tone, `tone ${out.tone}`],
        [gc.expect.urgency == null || out.requests[0]?.urgency === gc.expect.urgency, `urgency ${out.requests[0]?.urgency}`],
        [gc.expect.min_requests == null || out.requests.length >= gc.expect.min_requests, `only ${out.requests.length} requests`],
        [gc.expect.max_requests == null || out.requests.length <= gc.expect.max_requests, `${out.requests.length} requests`],
      ]
      const failed = checks.filter(([ok]) => !ok)
      if (failed.length > 0) {
        pass = false
        detail = failed.map(([, d]) => d).join('; ')
      }
    } catch (err) {
      pass = false
      detail = (err as Error).message
    }
    results.push({ name: gc.name, pass, isComplaintCase, isMultiCase, detail })
  }

  const share = (xs: EvalCaseResult[]) => (xs.length === 0 ? 1 : xs.filter((r) => r.pass).length / xs.length)
  return {
    results,
    typeAccuracy: share(results),
    splitRecall: share(results.filter((r) => r.isMultiCase)),
    complaintRecall: share(results.filter((r) => r.isComplaintCase)),
  }
}
