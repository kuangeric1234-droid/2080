import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { ModelTier } from './model.ts'

/* Versioned prompts live in the repo at /skills/<name>/<version>/ with
   SKILL.md + skill.json + output.schema.json beside each (§3.3, §12.4). */
const DEFAULT_SKILLS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../skills',
)

export type GateLevel = 'G0' | 'G1' | 'G2' | 'G3'

export interface SkillDefinition {
  name: string
  version: string
  description: string
  gate: GateLevel
  modelTier: ModelTier
  action: string
  expiresHours: number | null
  systemPrompt: string
  outputSchema: Record<string, unknown>
}

const GATES: GateLevel[] = ['G0', 'G1', 'G2', 'G3']

export function loadSkill(
  name: string,
  version?: string,
  skillsDir: string = DEFAULT_SKILLS_DIR,
): SkillDefinition {
  const skillDir = path.join(skillsDir, name)
  let resolved = version
  if (!resolved) {
    const versions = readdirSync(skillDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
    if (versions.length === 0) throw new Error(`skill ${name} has no versions`)
    resolved = versions[versions.length - 1]
  }
  const dir = path.join(skillDir, resolved)
  const config = JSON.parse(readFileSync(path.join(dir, 'skill.json'), 'utf8'))
  if (config.name !== name || config.version !== resolved) {
    throw new Error(`skill.json name/version mismatch in ${dir}`)
  }
  if (!GATES.includes(config.gate)) {
    throw new Error(`skill ${name}@${resolved}: invalid gate ${config.gate}`)
  }
  if (config.model_tier !== 'fast' && config.model_tier !== 'top') {
    throw new Error(`skill ${name}@${resolved}: invalid model_tier ${config.model_tier}`)
  }
  if (typeof config.action !== 'string' || !config.action) {
    throw new Error(`skill ${name}@${resolved}: action is required`)
  }
  return {
    name: config.name,
    version: config.version,
    description: config.description ?? '',
    gate: config.gate,
    modelTier: config.model_tier,
    action: config.action,
    expiresHours: config.expires_hours ?? null,
    systemPrompt: readFileSync(path.join(dir, 'SKILL.md'), 'utf8'),
    outputSchema: JSON.parse(readFileSync(path.join(dir, 'output.schema.json'), 'utf8')),
  }
}
