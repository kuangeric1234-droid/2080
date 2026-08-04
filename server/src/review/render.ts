import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium, type Browser } from 'playwright'
import type { Signal, SignalValue } from './signals.ts'

/* The bodies of page.evaluate() run inside Chromium, not Node. This project's
   tsconfig is deliberately Node-only (lib: ES2023) so that server code cannot
   reach for `document` by accident, so the browser globals are declared here —
   scoped to this file — rather than by adding "dom" to the shared lib list. */
interface Rect { top: number; bottom: number; width: number; height: number }
interface El { getBoundingClientRect(): Rect }
declare const document: {
  body: El
  documentElement: { scrollWidth: number; scrollHeight: number }
  querySelector(selector: string): El | null
  querySelectorAll(selector: string): ArrayLike<El>
}
declare const window: {
  innerWidth: number
  innerHeight: number
  scrollTo(x: number, y: number): void
}
declare function getComputedStyle(el: El): { fontSize: string }

/* Render-layer collectors (MASTER-BUILD-PLAN §13.2 step 1.3b).

   The fetch layer reads markup; this layer reads what a browser actually
   computes — font sizes after the cascade, whether a nav is still on screen
   after a scroll, contrast as axe measures it. Those cannot be derived from
   HTML, which is why they need Chromium at all.

   Every measurement is isolated: one failing collector records an error and
   the rest still run. A half-collected review is worth more than none, and a
   signal that is absent simply never fires its trigger (engine.ts). */

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 } // iPhone 14 logical viewport

export interface RenderOptions {
  timeoutMs?: number
  /** Interior page for the banner measurement. Homepage banners are expected
      to be tall; it is the *interior* pages wasting a screen that earn the
      finding, so measuring the homepage here would be wrong. */
  interiorUrl?: string
  /** Root the exhibit `path` values are relative to. */
  exhibitDir?: string
  /** Namespaces the screenshot filenames. */
  reviewId?: string
}

export interface RenderExhibit {
  kind: 'screenshot' | 'performance_report' | 'serp_screenshot'
  label: string
  /** Relative to the exhibit store — matches review_exhibits.path. */
  path: string
  width: number
  height: number
}

export interface RenderResult {
  signals: Signal[]
  exhibits: RenderExhibit[]
  errors: string[]
}

const sig = (key: string, value: SignalValue, provenance: string): Signal =>
  ({ key, value, source: 'render', provenance })

/** Drive a real browser over the site and measure what only rendering reveals. */
export async function collectRenderLayer(url: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const exhibitDir = opts.exhibitDir ?? defaultExhibitDir()
  const signals: Signal[] = []
  const exhibits: RenderExhibit[] = []
  const errors: string[] = []

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] })
  } catch (err) {
    // No browser, no render layer. Collection as a whole still succeeds.
    errors.push(`could not launch chromium: ${(err as Error).message}`)
    return { signals, exhibits, errors }
  }

  try {
    // ── desktop pass: timing, font, nav, contrast, screenshot ──
    const desktop = await browser.newContext({ viewport: DESKTOP })
    const page = await desktop.newPage()
    page.setDefaultTimeout(timeoutMs)

    const loaded = await step(errors, 'load', async () => {
      const t0 = Date.now()
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs })
      return (Date.now() - t0) / 1000
    })

    if (loaded === undefined) {
      // The page never loaded; everything downstream would measure nothing.
      await browser.close()
      errors.push(`render layer skipped: ${url} did not load in a browser`)
      return { signals, exhibits, errors }
    }

    signals.push(sig('site.load_seconds', Math.round(loaded * 10) / 10,
      `Chromium loaded ${url} in ${loaded.toFixed(1)}s to the load event, at ${DESKTOP.width}×${DESKTOP.height} — full render, not just the document`))

    await step(errors, 'body_font_px', async () => {
      const px = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))
      if (Number.isFinite(px)) {
        signals.push(sig('render.body_font_px', Math.round(px * 10) / 10,
          `Computed font-size on <body> is ${px}px at ${DESKTOP.width}px wide`))
      }
    })

    await step(errors, 'nav_sticky', async () => {
      const sticky = await page.evaluate(() => {
        const nav = document.querySelector('header nav, nav, header, [role="navigation"]')
        if (!nav) return null
        const before = nav.getBoundingClientRect()
        window.scrollTo(0, 900)
        const after = nav.getBoundingClientRect()
        window.scrollTo(0, 0)
        // Still occupying its original band of the viewport after scrolling.
        return after.bottom > 0 && Math.abs(after.top - before.top) < 8
      })
      if (sticky !== null) {
        signals.push(sig('render.nav_sticky', sticky,
          sticky
            ? 'The primary navigation held its position after scrolling 900px'
            : 'The primary navigation scrolled away with the page (not sticky)'))
      }
    })

    await step(errors, 'contrast', async () => {
      const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      const nodes = res.violations.reduce((n, v) => n + v.nodes.length, 0)
      signals.push(sig('render.contrast_violations', nodes,
        `axe-core colour-contrast: ${nodes} failing element${nodes === 1 ? '' : 's'} on the homepage`))
    })

    await step(errors, 'screenshot', async () => {
      mkdirSync(exhibitDir, { recursive: true })
      const rel = opts.reviewId ? `${opts.reviewId}/homepage.png` : 'homepage.png'
      const abs = path.join(exhibitDir, rel)
      mkdirSync(path.dirname(abs), { recursive: true })
      await page.screenshot({ path: abs, fullPage: true })
      const dims = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      }))
      exhibits.push({ kind: 'screenshot', label: 'Homepage', path: rel, width: dims.w, height: dims.h })
    })

    // ── interior page: banner height ──
    const interior = opts.interiorUrl
    if (interior && interior !== url) {
      await step(errors, 'banner_height_ratio', async () => {
        await page.goto(interior, { waitUntil: 'load', timeout: timeoutMs })
        const ratio = await page.evaluate(() => {
          const vh = window.innerHeight
          // The banner is the first substantial block below the header — the
          // thing a visitor must scroll past before reaching the content.
          const header = document.querySelector('header, [role="banner"]')
          const headerBottom = header ? header.getBoundingClientRect().bottom : 0
          const candidates = Array.from(document.querySelectorAll('body *'))
          for (const el of candidates) {
            const r = el.getBoundingClientRect()
            if (r.top < headerBottom - 1) continue
            if (r.width < window.innerWidth * 0.8) continue
            if (r.height < 80) continue
            return r.height / vh
          }
          return null
        })
        if (ratio !== null) {
          signals.push(sig('render.banner_height_ratio', Math.round(ratio * 100) / 100,
            `The first full-width block on ${interior} occupies ${Math.round(ratio * 100)}% of a ${DESKTOP.height}px viewport`))
        }
      })
    }

    await desktop.close()

    // ── mobile pass ──
    const mobileCtx = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true })
    const mob = await mobileCtx.newPage()
    mob.setDefaultTimeout(timeoutMs)

    await step(errors, 'mobile_ok', async () => {
      await mob.goto(url, { waitUntil: 'load', timeout: timeoutMs })
      const overflow = await mob.evaluate(() =>
        document.documentElement.scrollWidth - window.innerWidth)
      const ok = overflow <= 2 // sub-pixel rounding is not a layout failure
      signals.push(sig('render.mobile_ok', ok,
        ok
          ? `At ${MOBILE.width}px the page fits its viewport with no sideways scrolling`
          : `At ${MOBILE.width}px the page is ${overflow}px wider than the screen, forcing sideways scrolling`))
    })

    await mobileCtx.close()
  } finally {
    await browser.close()
  }

  return { signals, exhibits, errors }
}

/** Run one collector; record the failure and carry on. */
async function step<T>(errors: string[], name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    errors.push(`${name}: ${(err as Error).message}`)
    return undefined
  }
}

export function defaultExhibitDir(): string {
  return process.env.EXHIBIT_DIR ?? path.join(process.cwd(), '.exhibits')
}
