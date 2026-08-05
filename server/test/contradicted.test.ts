import { describe, expect, it } from 'vitest'
import { collectFetchLayer } from '../src/review/collect.ts'
import { signalsToMap } from '../src/review/engine.ts'
import { navIsSticky } from '../src/review/render.ts'
import { fixtureFetch } from './fixtures/practice-site.ts'

/* §13.2 step 1.33 — the three findings our report and the reference disagreed
   about, on the same practice, five days apart.

   Our 05/08 export of ohdental.com.au said the site uses the default /wp-admin
   URL, that third-party links open in the same tab, and that the nav bar does
   not float down. The 31/07 report said the opposite of all three. One of the
   two was wrong about the facts each time, and the answer was not the same
   answer three times: we were right once and wrong twice.

   The markup and the numbers below are the real ones, taken off the live site
   while resolving it, so a regression here is a regression against the thing
   that was actually measured. */

const ORIGIN = 'https://ohdental.test'

/* The site's own header and footer as it serves them. Facebook and the web
   agency's credit carry target="_blank"; the booking widget, the "leave us a
   review" link and the theme vendor's demo do not, and the booking link
   repeats on every page. */
const HEADER = `
<div class="fusion-header"><nav class="awb-menu"><ul>
  <li><a href="/">Home</a></li>
  <li><a href="/services/">Services</a></li>
  <li><a href="https://apac.mydentalhub.online/soe/new/OHalloran%20Hill%20Dental?pid=1">Book Online</a></li>
</ul></nav></div>`

const FOOTER = `
<footer>
  <a href="https://www.facebook.com/ohallorandental" target="_blank">Facebook</a>
  <a href="https://apac.mydentalhub.online/soe/new/OHalloran%20Hill%20Dental?pid=1" target="_self">Book</a>
  <a href="https://www.google.com/search?q=O%27Halloran+Hill+Dental">Leave a review</a>
  <a href="https://avada.theme-fusion.com/pet-supplies/" target="_self">Avada</a>
  <a href="https://www.digitalgetup.com.au/" target="_blank">Digital Get Up</a>
</footer>`

const page = (title: string, body = '') => ({
  html: `<!doctype html><html lang="en-AU"><head><title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="generator" content="WordPress 6.5"></head>
    <body>${HEADER}<main>${body}</main>${FOOTER}</body></html>`,
})

/* What ohdental.com.au actually serves at /wp-admin/: a 302 to wp-login.php,
   which returns WordPress's stock login form. `fetch` follows the redirect, so
   this is the body the collector sees. */
const WP_LOGIN = {
  html: `<!doctype html><html><head><title>Log In &lsaquo; O&rsquo;Halloran Hill Dental &#8212; WordPress</title></head>
    <body class="login"><form name="loginform" id="loginform" action="/wp-login.php" method="post">
      <input type="text" name="log" id="user_login" value="">
      <input type="password" name="pwd" id="user_pass" value="">
      <input type="submit" name="wp-submit" id="wp-submit" value="Log In">
    </form></body></html>`,
}

const SITE = {
  '/': page('O’Halloran Hill Dental'),
  '/services/': page('Services'),
  '/our-team/': page('Our Team'),
  '/wp-admin/': WP_LOGIN,
}

async function collect() {
  return collectFetchLayer(ORIGIN, {
    fetchImpl: fixtureFetch(SITE, ORIGIN),
    networkProbes: false,
  })
}

describe('1.33 · the admin login URL — the probe was right', () => {
  /* The reference says "Your wordpress website doesn't use the default admin
     login URL … which is great as it makes it harder for hackers", and quotes
     the default URL in the sentence saying so. But /wp-admin/ redirecting to
     /wp-login.php IS stock WordPress — every unhardened install does it, and
     the login form is served at the end of it. A site that has actually moved
     its login returns 404 or 403 there instead. The human read the redirect as
     a defence; it is the default behaviour. */
  it('calls the default path open when /wp-admin/ lands on a working login form', async () => {
    const s = signalsToMap((await collect()).signals)
    expect(s.get('site.wp_admin_default')?.value).toBe(true)
  })

  it('says nothing when the login has genuinely been moved', async () => {
    const hardened = { ...SITE, '/wp-admin/': { status: 404, html: 'not found' } }
    const r = await collectFetchLayer(ORIGIN, {
      fetchImpl: fixtureFetch(hardened, ORIGIN),
      networkProbes: false,
    })
    expect(signalsToMap(r.signals).has('site.wp_admin_default')).toBe(false)
  })
})

describe('1.33 · third-party links — the probe was measuring the wrong thing', () => {
  /* The old count was anchors across the crawl, so the booking button in a
     global header scored once per page and the practice's own booking system
     counted as a distraction. 60 on a site with four distinct destinations. */
  it('counts destinations rather than anchors, so the crawl size does not inflate it', async () => {
    const s = signalsToMap((await collect()).signals)
    // google.com and avada.theme-fusion.com. Facebook and the agency open in a
    // new tab; the booking host is not a distraction from the inquiry.
    expect(s.get('render.external_links_same_tab')?.value).toBe(2)
    expect(s.get('render.external_links_same_tab')?.provenance)
      .toContain('avada.theme-fusion.com')
  })

  it('excludes the booking system however many pages link to it', async () => {
    const s = signalsToMap((await collect()).signals)
    expect(s.get('render.external_links_same_tab')?.provenance)
      .not.toContain('mydentalhub')
  })

  it('says every link opens in a new tab when one does', async () => {
    const tidy = {
      '/': {
        html: `<!doctype html><html><head><title>Tidy</title></head><body><footer>
          <a href="https://www.facebook.com/x" target="_blank">Facebook</a>
          </footer></body></html>`,
      },
    }
    const r = await collectFetchLayer(ORIGIN, {
      fetchImpl: fixtureFetch(tidy, ORIGIN),
      networkProbes: false,
    })
    const s = signalsToMap(r.signals)
    expect(s.get('render.external_links_same_tab')?.value).toBe(0)
    expect(s.get('render.external_links_same_tab')?.provenance)
      .toBe('Every third-party link opens in a new tab')
  })
})

describe('1.33 · the sticky nav — the probe was wrong', () => {
  /* The real measurement off ohdental.com.au at 1440×900: the nav sat at 83px,
     the page scrolled 900px, and the nav came to rest at 41px — inside a
     position:fixed wrapper, plainly still on screen. The old rule wanted the
     offset to hold within 8px, so a condensing header failed it. */
  it('calls ohdental.com.au sticky — it condensed by 42px and stayed', () => {
    expect(navIsSticky({ beforeTop: 83, afterTop: 41, afterBottom: 111 })).toBe(true)
  })

  it('still calls a nav that scrolled away with the page not sticky', () => {
    expect(navIsSticky({ beforeTop: 83, afterTop: -817, afterBottom: -787 })).toBe(false)
  })

  it('holds for a nav that does not move at all', () => {
    expect(navIsSticky({ beforeTop: 0, afterTop: 0, afterBottom: 70 })).toBe(true)
  })

  it('does not mistake a nav further down the document for a sticky one', () => {
    // An element 1000px down travels the full scroll distance into the top band.
    expect(navIsSticky({ beforeTop: 1000, afterTop: 100, afterBottom: 170 })).toBe(false)
  })
})
