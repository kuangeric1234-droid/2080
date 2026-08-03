/* Two fixture practice sites for the collector + engine tests: one that should
   score well and one that should trip most of the negative half of the bank.
   Served through an injected fetch so the tests never touch the network. */

interface Site {
  [path: string]: { status?: number; html: string; headers?: Record<string, string> }
}

const wrap = (head: string, body: string) =>
  `<!doctype html><html lang="en-AU"><head>${head}</head><body>${body}</body></html>`

const NAV_GOOD = `
<header><nav><ul>
  <li><a href="/">Hearts Dental</a></li>
  <li><a href="/services/dental-implants/">Dental Implants</a></li>
  <li><a href="/services/invisalign/">Invisalign</a></li>
  <li><a href="/dental-conditions/toothache/">Toothache</a></li>
  <li><a href="/about-us/dr-jane-lin/">Dr Jane Lin</a></li>
  <li><a href="/blog-news/">Blog</a></li>
  <li><a href="/book-online/">Book Online</a></li>
</ul></nav></header>`

const FOOTER_GOOD = `
<footer>
  <a href="tel:+61395551234">(03) 9555 1234</a>
  <a href="mailto:hello@heartsdental.com.au">hello@heartsdental.com.au</a>
  <a href="https://facebook.com/heartsdental" target="_blank">Facebook</a>
  <a href="https://instagram.com/heartsdental" target="_blank">Instagram</a>
</footer>`

/** WordPress, HTTPS, GA4, booking, service + bio + condition pages, active blog. */
export const HEALTHY: Site = {
  '/': {
    html: wrap(
      `<title>Dental Implants &amp; Invisalign in Elwood | Hearts Dental</title>
       <meta name="description" content="Hearts Dental in Elwood offers implants, Invisalign and emergency care. Open six days with online booking and on-site parking.">
       <meta name="viewport" content="width=device-width, initial-scale=1">
       <meta name="generator" content="WordPress 6.5">
       <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>`,
      `${NAV_GOOD}<main><h1>Hearts Dental Elwood</h1>
       <img src="/team.jpg" alt="The Hearts Dental team in the Elwood surgery">
       <p>Twenty-two years in Elwood. Mandarin and Cantonese spoken. Amex accepted.</p>
       <link rel="stylesheet" href="/wp-content/themes/hearts/style.css">
       </main>${FOOTER_GOOD}`,
    ),
  },
  '/services/dental-implants/': {
    html: wrap('<title>Dental Implants Elwood | Hearts Dental</title>', `${NAV_GOOD}<h1>Dental Implants</h1><img src="/i.jpg" alt="An implant fixture">${FOOTER_GOOD}`),
  },
  '/services/invisalign/': {
    html: wrap('<title>Invisalign Elwood | Hearts Dental</title>', `${NAV_GOOD}<h1>Invisalign</h1><img src="/v.jpg" alt="Clear aligner tray">${FOOTER_GOOD}`),
  },
  '/dental-conditions/toothache/': {
    html: wrap('<title>Toothache | Hearts Dental</title>', `${NAV_GOOD}<h1>Toothache</h1>${FOOTER_GOOD}`),
  },
  '/about-us/dr-jane-lin/': {
    html: wrap('<title>Dr Jane Lin | Hearts Dental</title>', `${NAV_GOOD}<h1>Dr Jane Lin</h1><a href="/about-us/dr-jane-lin/"><img src="/jane.jpg" alt="Dr Jane Lin"></a>${FOOTER_GOOD}`),
  },
  '/blog-news/': {
    html: wrap('<title>Blog | Hearts Dental</title>', `${NAV_GOOD}<h1>Blog</h1>${FOOTER_GOOD}`),
  },
  '/book-online/': {
    html: wrap('<title>Book Online | Hearts Dental</title>', `${NAV_GOOD}<h1>Book Online</h1>${FOOTER_GOOD}`),
  },
}

const NAV_BAD = `
<header><nav><ul>
  <li><a href="/">Home</a></li><li><a href="/about.html">About</a></li>
  <li><a href="/services.html">Services</a></li><li><a href="/fees.html">Fees</a></li>
  <li><a href="/hours.html">Hours</a></li><li><a href="/parking.html">Parking</a></li>
  <li><a href="/faq.html">FAQ</a></li><li><a href="/emergency.html">Emergency</a></li>
  <li><a href="/gallery.html">Gallery</a></li><li><a href="/insurance.html">Insurance</a></li>
  <li><a href="/contact.html">Contact</a></li>
</ul></nav></header>`

/** Static HTML on http, no analytics, no booking, testimonials on the page,
    a Yahoo contact address, plain-text phone, legacy CAPTCHA. */
export const NEGLECTED: Site = {
  '/': {
    html: wrap(
      `<title>Home</title>`,
      `${NAV_BAD}<main><h1>Welcome</h1>
       <img src="/stock1.jpg"><img src="/stock2.jpg"><img src="/stock3.jpg">
       <p>Phone us on 03 9555 9999 or email stellar_smiles@yahoo.com</p>
       <h2>What our patients say</h2>
       <blockquote>Best dentist in Melbourne! - Sarah T.</blockquote>
       <form><img src="/captcha.php" alt="captcha"><input name="captcha"></form>
       <a href="https://facebook.com/stellarsmiles">Facebook</a>
       </main>`,
    ),
  },
  '/about.html': { html: wrap('<title>About</title>', `${NAV_BAD}<h1>About</h1><img src="/a.jpg">`) },
  '/services.html': { html: wrap('<title>Services</title>', `${NAV_BAD}<h1>Services</h1><img src="/s.jpg">`) },
  '/fees.html': { html: wrap('<title>Fees</title>', `${NAV_BAD}<h1>Fees</h1>`) },
  '/hours.html': { html: wrap('<title>Hours</title>', `${NAV_BAD}<h1>Hours</h1>`) },
  '/parking.html': { html: wrap('<title>Parking</title>', `${NAV_BAD}<h1>Parking</h1>`) },
  '/faq.html': { html: wrap('<title>FAQ</title>', `${NAV_BAD}<h1>FAQ</h1>`) },
  '/emergency.html': { html: wrap('<title>Emergency</title>', `${NAV_BAD}<h1>Emergency</h1>`) },
  '/gallery.html': { html: wrap('<title>Gallery</title>', `${NAV_BAD}<h1>Gallery</h1>`) },
  '/insurance.html': { html: wrap('<title>Insurance</title>', `${NAV_BAD}<h1>Insurance</h1>`) },
  '/contact.html': { html: wrap('<title>Contact</title>', `${NAV_BAD}<h1>Contact</h1>`) },
  // a real sitemap, so the page counts are knowable and "no service pages" is a
  // finding rather than a guess
  '/sitemap.xml': {
    html: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
      '/', '/about.html', '/services.html', '/fees.html', '/hours.html', '/parking.html',
      '/faq.html', '/emergency.html', '/gallery.html', '/insurance.html', '/contact.html',
    ].map((p) => `<url><loc>http://stellarsmiles.test${p}</loc></url>`).join('')}</urlset>`,
  },
}

/** One page, no sitemap, no navigation — the case where page counts are simply
    not knowable and the report must stay silent rather than accuse. */
export const OPAQUE: Site = {
  '/': {
    html: wrap(
      '<title>Smile To Go</title><meta name="viewport" content="width=device-width">',
      '<main><h1>Smile To Go</h1><p>Call us on 9555 0000.</p></main>',
    ),
  },
}

/** A fetch stand-in that serves one of the fixture sites and 404s everything
    else — including /wp-admin/, so that probe stays honest. */
export function fixtureFetch(site: Site, origin: string): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    if (url.origin !== origin) {
      return new Response('', { status: 404 })
    }
    const page = site[url.pathname]
    if (!page) return new Response('not found', { status: 404 })
    return new Response(page.html, {
      status: page.status ?? 200,
      headers: { 'content-type': 'text/html', ...(page.headers ?? {}) },
    })
  }) as typeof fetch
}
