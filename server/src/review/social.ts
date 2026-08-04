import type { Signal } from './signals.ts'

/* §13.2 step 1.11 — social metrics behind a provider.

   The template's own margin comments describe this as a human task: "Look at
   the amount of posts in the last 30 days and how many likes/comments they
   have. Anything more than 10+ is considered good." Automating it needs
   Facebook/Instagram Graph API credentials, and there is no legitimate way
   around that — scraping either platform breaches its terms, and a report
   built on a terms breach is not a report 20-80 can send.

   So this is the seam, not the answer. `MockSocialProvider` stands in behind
   the real interface (BUILD-LOOP rule 7) and the day credentials arrive a
   real provider is an adapter, not a rewrite.

   What the mock must never do is decide anything. Its numbers fill the
   {{fans}}/{{followers}}/{{posts}} variables and sit beside the reviewer's
   manual call as evidence — every social snippet stays `when: manual`, so no
   invented figure can auto-accept its way into a client's report (1.9). */

export type Network = 'facebook' | 'instagram'

export interface SocialMetrics {
  /** Page likes / followers. */
  audience: number | null
  posts_last_30d: number | null
  /** Mean likes + comments per post over those 30 days. */
  avg_engagement: number | null
}

export interface SocialProvider {
  /** Shown in provenance, so a reader can tell measured from stood-in. */
  readonly name: string
  readonly provisional: boolean
  fetch(profileUrl: string, network: Network): Promise<SocialMetrics | null>
}

/* PROVISIONAL (BLOCKERS.md: social-graph-credentials).

   Deterministic from the URL rather than random: a review re-collected twice
   must not change its numbers, or the reviewer cannot tell a real change from
   noise. The values are shaped to be *obviously* stood-in — see the provenance
   string, which says so in the report's own evidence trail. */
export class MockSocialProvider implements SocialProvider {
  readonly name = 'mock'
  readonly provisional = true

  async fetch(profileUrl: string, network: Network): Promise<SocialMetrics | null> {
    if (!profileUrl) return null
    let h = 0
    for (const ch of profileUrl) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const span = network === 'facebook' ? 2400 : 1800
    return {
      audience: 120 + (h % span),
      posts_last_30d: h % 14,
      avg_engagement: (h >> 3) % 22,
    }
  }
}

/* The real thing. Works for any page the token administers or that has granted
   the app access — 20-80's own pages, and a client's once onboarding asks for
   it. It does NOT work for a prospect who has never heard of us: reading an
   arbitrary public page needs Meta's Page Public Content Access, which requires
   App Review plus Business Verification. Verified 2026-08-04 against a live
   token: /me/accounts returned the administered page, while three practice
   pages each returned "(#100) ... missing permission or reviewable feature".

   So it returns null rather than a number it cannot stand behind, and null
   means no signal, which means the reviewer fills {{fans}} by hand exactly as
   they do today. An invented figure in a client's report is worse than a gap. */
export class MetaGraphProvider implements SocialProvider {
  readonly name = 'meta-graph'
  readonly provisional = false
  constructor(private token: string, private version = 'v21.0') {}

  async fetch(profileUrl: string, network: Network): Promise<SocialMetrics | null> {
    const handle = handleFrom(profileUrl)
    if (!handle) return null
    const fields = network === 'facebook' ? 'fan_count' : 'followers_count'
    const url = `https://graph.facebook.com/${this.version}/${encodeURIComponent(handle)}`
      + `?fields=${fields}&access_token=${encodeURIComponent(this.token)}`
    const res = await fetch(url)
    const body = await res.json() as Record<string, unknown>
    // Not reachable with this token — the common case for a prospect.
    if (!res.ok || body.error) return null
    const audience = typeof body[fields] === 'number' ? body[fields] as number : null
    /* Post counts and engagement need the page's own insights edge, which the
       same permission wall governs. Left null rather than guessed. */
    return { audience, posts_last_30d: null, avg_engagement: null }
  }
}

/** `https://www.facebook.com/heartsdental.melbourne/` -> `heartsdental.melbourne` */
export function handleFrom(profileUrl: string): string | null {
  try {
    const u = new URL(profileUrl)
    const seg = u.pathname.split('/').filter(Boolean)
    return seg[0] ?? null
  } catch {
    return null
  }
}

/** Real provider when a token is configured, the stand-in otherwise. */
export function defaultSocialProvider(): SocialProvider {
  const t = process.env.META_GRAPH_TOKEN
  return t ? new MetaGraphProvider(t) : new MockSocialProvider()
}

const KEYS: Record<Network, { audience: string; posts: string; engagement: string }> = {
  facebook: {
    audience: 'social.facebook.fans',
    posts: 'social.facebook.posts_30d',
    engagement: 'social.facebook.engagement_avg',
  },
  instagram: {
    audience: 'social.instagram.followers',
    posts: 'social.instagram.posts_30d',
    engagement: 'social.instagram.engagement_avg',
  },
}

/** The template's bar, straight from its margin comment: 10+ is good. */
export const GOOD_ENGAGEMENT = 10

/**
 * Turn the profile URLs the fetch layer already found into measured signals.
 * Returns nothing at all when there is no profile — an absent signal never
 * fires a trigger, which is the behaviour we want over a zero that reads as
 * "measured, and it was none".
 */
export async function collectSocialSignals(
  provider: SocialProvider,
  profiles: { network: Network; url: string | null }[],
): Promise<{ signals: Signal[]; errors: string[] }> {
  const signals: Signal[] = []
  const errors: string[] = []

  for (const { network, url } of profiles) {
    if (!url) continue
    let m: SocialMetrics | null
    try {
      m = await provider.fetch(url, network)
    } catch (err) {
      errors.push(`${network}: ${(err as Error).message}`)
      continue
    }
    if (!m) continue

    const k = KEYS[network]
    const via = provider.provisional
      ? `PROVISIONAL — stood in by the ${provider.name} social provider, not measured. Needs Graph API credentials (BLOCKERS.md).`
      : `via the ${provider.name} social provider`
    const sig = (key: string, value: number | null, what: string) => {
      if (value === null) return
      signals.push({ key, value, source: 'provider', provenance: `${what} for ${url} — ${via}` })
    }

    sig(k.audience, m.audience,
      network === 'facebook' ? 'Page likes' : 'Followers')
    sig(k.posts, m.posts_last_30d, 'Posts in the last 30 days')
    sig(k.engagement, m.avg_engagement,
      `Mean likes and comments per post over 30 days (the template treats ${GOOD_ENGAGEMENT}+ as good)`)
  }

  return { signals, errors }
}
