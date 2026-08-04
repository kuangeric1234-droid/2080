/* The signal contract. A signal is one measurement about one domain, carrying
   how it was measured. Snippet triggers only ever read signals — a finding that
   cannot name the signal that earned it does not ship. */

export type SignalSource = 'crawl' | 'render' | 'dns' | 'tls' | 'http' | 'archive' | 'manual' | 'judgement' | 'provider'
export type SignalValue = string | number | boolean | null

export interface Signal {
  key: string
  value: SignalValue
  source: SignalSource
  /** How we know. Shown to the reviewer beside the finding it triggers. */
  provenance: string
}

export type SignalMap = Map<string, Signal>

export function toMap(signals: Signal[]): SignalMap {
  const m: SignalMap = new Map()
  for (const s of signals) m.set(s.key, s) // later wins — collectors run in order
  return m
}

/** Every signal the bank's triggers may reference, with what it means. Keeping
    this list beside the collectors is what lets a test catch a snippet that
    triggers on a signal nobody produces. */
export const SIGNAL_CATALOG: Record<string, { desc: string; layer: 'fetch' | 'render' | 'manual' | 'provider' }> = {
  // ── transport & hosting ──
  'site.https': { desc: 'Final URL is served over HTTPS with a valid certificate', layer: 'fetch' },
  'site.tls_days_left': { desc: 'Days until the TLS certificate expires', layer: 'fetch' },
  'site.load_seconds': { desc: 'Real browser load time to the load event', layer: 'render' },
  'site.host.country': { desc: 'Country the origin server resolves to', layer: 'fetch' },
  'site.cms': { desc: 'wordpress | squarespace | wix | shopify | static | unknown', layer: 'fetch' },
  'site.wp_admin_default': { desc: '/wp-admin is reachable at the default path', layer: 'fetch' },

  /* The trade, inferred from the practice name and domain. Drives both the
     competitor search and the bank's profession variables, so the trade we look
     for and the trade we write about cannot disagree (§13.2 1.15). */
  'practice.profession': { desc: 'dentist | chiropractor | dermatologist | …', layer: 'fetch' },

  // ── analytics ──
  'site.analytics.ga4': { desc: 'GA4 gtag present', layer: 'fetch' },
  'site.analytics.gtm': { desc: 'Google Tag Manager container present', layer: 'fetch' },

  // ── email ──
  'site.email.mx_host': { desc: 'Primary MX hostname', layer: 'fetch' },
  'site.email.same_server': { desc: 'Mail exchanger resolves to the same IP as the website', layer: 'fetch' },
  'site.contact.email': { desc: 'First contact address found on the site', layer: 'fetch' },
  'site.contact.email_domain_public': { desc: 'Contact address is on gmail/yahoo/hotmail/bigpond etc', layer: 'fetch' },

  // ── structure ──
  'site.booking.present': { desc: 'An online booking link or widget was found', layer: 'fetch' },
  'pages.total': { desc: 'Pages reached by the crawl', layer: 'fetch' },
  'pages.service_pages': { desc: 'Pages that are a single service', layer: 'fetch' },
  'pages.bio_pages': { desc: 'Individual practitioner biography pages', layer: 'fetch' },
  'pages.conditions_pages': { desc: 'Pages addressing a patient problem rather than a treatment', layer: 'fetch' },
  'blog.present': { desc: 'A blog or news section exists', layer: 'fetch' },
  'blog.last_post_months': { desc: 'Months since the most recent dated post', layer: 'fetch' },
  'content.testimonials_present': { desc: 'Patient testimonials or reviews appear on the site (AHPRA)', layer: 'fetch' },
  'archive.last_major_update_year': { desc: 'Year of the last substantial redesign', layer: 'manual' },

  // ── on-page SEO ──
  'onpage.title_ok': { desc: 'Homepage title is present and specific', layer: 'fetch' },
  'onpage.meta_ok': { desc: 'Homepage meta description is present and a usable length', layer: 'fetch' },
  'onpage.alt_missing': { desc: 'Images across the crawl with no alt text', layer: 'fetch' },

  // ── usability (markup-level; the render layer refines these) ──
  'render.mobile_ok': { desc: 'Page renders usably at 390px', layer: 'render' },
  'render.nav_item_count': { desc: 'Top-level items in the primary navigation', layer: 'fetch' },
  'render.nav_has_home': { desc: 'Navigation includes a "Home" item', layer: 'fetch' },
  'render.nav_sticky': { desc: 'Navigation stays visible on scroll', layer: 'render' },
  'render.body_font_px': { desc: 'Computed body font size in pixels', layer: 'render' },
  'render.contrast_violations': { desc: 'axe-core colour-contrast violations', layer: 'render' },
  'render.banner_height_ratio': { desc: 'Interior-page banner height as a fraction of the viewport', layer: 'render' },
  'render.external_links_same_tab': { desc: 'Third-party links without target=_blank', layer: 'fetch' },
  'render.tel_links': { desc: 'tel: links found', layer: 'fetch' },
  'render.mailto_links': { desc: 'mailto: links found', layer: 'fetch' },
  'render.captcha_legacy': { desc: 'A pre-reCAPTCHA challenge image is in use', layer: 'fetch' },
  'render.team_images_linked': { desc: 'Practitioner photos link to their own page', layer: 'fetch' },

  /* ── performance (§13.2 1.16) ──
     Lighthouse via PageSpeed Insights. The template's own comment says to test
     speed with GTmetrix from Australia; this is the official equivalent, and it
     returns the screenshot the report embeds as its performance exhibit. */
  'perf.score': { desc: 'Lighthouse performance score out of 100 (mobile)', layer: 'provider' },
  'perf.lcp_seconds': { desc: 'Largest Contentful Paint, seconds', layer: 'provider' },
  'perf.fcp_seconds': { desc: 'First Contentful Paint, seconds', layer: 'provider' },
  'perf.speed_index_seconds': { desc: 'Speed Index, seconds', layer: 'provider' },
  'perf.top_opportunity': { desc: "Lighthouse's highest-impact fix", layer: 'provider' },

  /* ── reputation (§13.2 1.14) ──
     Google Places, not our crawler. The {{count}}x {{rating}}* line appears in
     15 of 17 real reports, which is why this is worth an API key. */
  'reputation.google_review_count': { desc: 'Google reviews on the practice listing', layer: 'provider' },
  'reputation.google_rating': { desc: 'Google star average', layer: 'provider' },
  'reputation.competitor_review_median': { desc: 'Median Google reviews across nearby same-trade practices', layer: 'provider' },

  // ── social ──
  'social.facebook_url': { desc: 'Facebook page linked from the site', layer: 'fetch' },
  'social.instagram_url': { desc: 'Instagram profile linked from the site', layer: 'fetch' },

  /* Credentialed third-party API, not our crawler (§13.2 1.11). Every social
     snippet stays `when: manual` — these fill its variables and sit beside the
     reviewer's call as evidence, they do not decide. */
  'social.facebook.fans': { desc: 'Facebook page likes', layer: 'provider' },
  'social.facebook.posts_30d': { desc: 'Facebook posts in the last 30 days', layer: 'provider' },
  'social.facebook.engagement_avg': { desc: 'Mean likes+comments per Facebook post over 30 days', layer: 'provider' },
  'social.instagram.followers': { desc: 'Instagram followers', layer: 'provider' },
  'social.instagram.posts_30d': { desc: 'Instagram posts in the last 30 days', layer: 'provider' },
  'social.instagram.engagement_avg': { desc: 'Mean likes+comments per Instagram post over 30 days', layer: 'provider' },

  // ── reviewer-supplied ──
  'manual.competitors.count': { desc: 'Competitors the reviewer entered', layer: 'manual' },
}
