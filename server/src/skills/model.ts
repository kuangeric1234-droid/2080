import Anthropic from '@anthropic-ai/sdk'
import { mockAck, mockCompletion, mockTriage } from '../inbox/mockResponders.ts'

/* Model tiers per MASTER-BUILD-PLAN §3.2: high-volume classification/triage
   on the fast tier, drafting/judgement on the top tier. */
export type ModelTier = 'fast' | 'top'

const TIER_MODELS: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5',
  top: 'claude-opus-4-8',
}

/* USD per million tokens (input, output) — for cost_cents telemetry. */
const TIER_PRICING: Record<ModelTier, [number, number]> = {
  fast: [1, 5],
  top: [5, 25],
}

export interface ModelRequest {
  system: string
  input: unknown
  outputSchema: Record<string, unknown>
  tier: ModelTier
  maxTokens?: number
}

export interface ModelResponse {
  output: unknown
  model: string
  tokensIn: number
  tokensOut: number
  costCents: number
}

export interface ModelClient {
  complete(req: ModelRequest): Promise<ModelResponse>
}

export function costCents(tier: ModelTier, tokensIn: number, tokensOut: number): number {
  const [inUsd, outUsd] = TIER_PRICING[tier]
  const usd = (tokensIn / 1_000_000) * inUsd + (tokensOut / 1_000_000) * outUsd
  return Math.ceil(usd * 100)
}

/** Real client — structured output via output_config.format (json_schema). */
export class AnthropicModelClient implements ModelClient {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic()
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const model = TIER_MODELS[req.tier]
    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 2048,
      system: req.system,
      output_config: {
        format: { type: 'json_schema', schema: req.outputSchema },
      },
      messages: [{ role: 'user', content: JSON.stringify(req.input) }],
    })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') {
      throw new Error(`no text block in response (stop_reason: ${response.stop_reason})`)
    }
    return {
      output: JSON.parse(text.text),
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      costCents: costCents(req.tier, response.usage.input_tokens, response.usage.output_tokens),
    }
  }
}

/* PROVISIONAL (BLOCKERS.md: anthropic-api-key): deterministic stand-in behind
   the real interface so the runner, gates and UI are testable without
   credentials. Never used once ANTHROPIC_API_KEY is provided. */
export class MockModelClient implements ModelClient {
  constructor(private respond: (req: ModelRequest) => unknown) {}

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const tokensIn = Math.ceil((req.system.length + JSON.stringify(req.input).length) / 4)
    const output = this.respond(req)
    const tokensOut = Math.ceil(JSON.stringify(output).length / 4)
    return {
      output,
      model: `mock-${TIER_MODELS[req.tier]}`,
      tokensIn,
      tokensOut,
      costCents: costCents(req.tier, tokensIn, tokensOut),
    }
  }
}

/** Real client when a key is configured, mock otherwise (dev/demo only).
    The mock routes on the skill's SKILL.md heading. */
export function defaultModelClient(): ModelClient {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicModelClient()
  return new MockModelClient((req) => {
    if (req.system.startsWith('# email-triage')) {
      return mockTriage(req.input as Parameters<typeof mockTriage>[0])
    }
    if (req.system.startsWith('# ack-writer')) {
      return mockAck(req.input as Parameters<typeof mockAck>[0])
    }
    if (req.system.startsWith('# completion-writer')) {
      return mockCompletion(req.input as Parameters<typeof mockCompletion>[0])
    }
    const input = req.input as { name?: string; lifecycle?: string }
    return {
      note_title: `${input.name ?? 'Practice'} is on the platform`,
      note_body: `${input.name ?? 'The practice'} now has a live client record. Current stage: ${input.lifecycle ?? 'unknown'}. (mock output — no ANTHROPIC_API_KEY configured)`,
    }
  })
}
