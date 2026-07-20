# CLAUDE.md

Guidance for working in this repository.

## What this is

Marketing website for **Sweet St.** — a Leicester-based catering business offering
live-cooked eggless **mini pancakes**, a **waffle cart**, **gol gappe & chaat**, and
**masala chai** for weddings, birthdays and private events across England.

Primary business goal: **convert visitors into leads** (enquiries via the booking form,
WhatsApp, phone, email). Every page funnels toward `contact.html`.

Deployed on **Netlify** at `https://sweetst.co.uk`.

## Tech stack

- Static multi-page site: plain **HTML + CSS + vanilla JS** (no framework, no build step
  for the pages themselves — Netlify only builds the Functions).
- **Netlify Functions** (TypeScript `.mts`) + **Netlify Blobs** for the quote + bookings system.
- Fonts: **Bricolage Grotesque** (display) + **Inter** (UI/body), from Google Fonts. The
  homepage hero `<h1>` overrides to **Playfair Display** (loaded only on `index.html`).
- Visual language is **"Soft Boutique"** (design system v3, tuned to the logo): blush-peach /
  cream / taupe-brown / caramel-gold palette with a gentle dusty-rose accent, soft rounded
  cards, thin outlines + gentle offset shadows (`--pop`), tilted pills, scrolling `.ticker`
  text bands, and pop-in scroll reveals. Logo-derived motifs: scalloped footer edge
  (`.scallop-top`), dotted borders, and a **sparkle (✦)** accent (used in eyebrows, tickers,
  dividers — NOT hearts). All styling lives in one shared design system:
  `assets/css/style.css` (`:root` tokens at the top).
- Social icons are inline **SVG** (in each footer), not image files.
- Shared behaviour: `assets/js/main.js`.

## Project layout

```
/
  index.html          Home (hero, services, features, menu teaser, gallery teaser, CTA)
  services.html       Detailed services incl. Waffle Cart, how-it-works, why-choose-us
  menu.html           Hard-coded toppings & sauces + full offerings
  gallery.html        Full photo gallery (lightbox) + event video rail
  contact.html        Booking form (Netlify Forms) + FAQ  ← main conversion page
  quote.html          Client-facing quote viewer (noindex) — reads /quote/<slug>
  admin.html          Owner-only quote builder (noindex, password-gated)

  assets/
    css/style.css     The entire design system (tokens + components)
    js/main.js        Header, mobile nav, scroll-reveal, lightbox, marquee, form
    js/quote.js       Fetches & renders a saved quote on quote.html
    js/admin.js       Password gate + quote creation on admin.html

  netlify/functions/
    create-quote.mts  POST /api/quotes  — admin-gated; verifies password, writes Blob, returns slug+url
    get-quote.mts     GET  /api/quotes/:slug — public read for the quote viewer
    save-booking.mts  POST /api/bookings — public; contact form saves each enquiry to the `bookings` Blob store (honeypot-checked)
    bookings-admin.mts POST /api/bookings-admin — admin-gated; action: list | update | delete

  netlify.toml        publish=".", functions dir, /quote/* → /quote.html rewrite, cache headers
  package.json        deps: @netlify/blobs, @netlify/functions
  Images/             All media (see casing note below)
  sitemap.xml, robots.txt, site.webmanifest, favicons
```

## Conventions

- **Asset path casing matters.** Netlify hosting is case-sensitive. The media folder is
  `Images/` (capital I) and photo files are `.JPEG` (uppercase). Always reference exact
  case, e.g. `/Images/gallery-1.JPEG`, `/Images/Logo.png`. The space in
  `Images/Instagram Icon.png` is URL-encoded as `%20`.
- **Header, footer and the WhatsApp float are duplicated in each page** (no templating).
  If you change one, update all page files to match.
- Use **absolute paths** (`/assets/...`, `/Images/...`) so links work from any route
  (including the pretty `/quote/<slug>` URL).
- Design tokens (colours, fonts, spacing, radius, shadows, motion) are CSS custom
  properties in `:root` at the top of `style.css`. Prefer tokens over hard-coded values.
- Reusable components already exist: `.btn`, `.card`, `.split`, `.menu-panel`, `.rail`,
  `.marquee`, `.gallery` + lightbox, `.form-card`, `.cta-band`, `.page-hero`, `.steps`,
  `.reveal` (scroll animation). Reuse before inventing new CSS.
- Motion respects `prefers-reduced-motion`.
- **Videos are lazy**: background `<video>` elements use `preload="none"` (no `autoplay`).
  `main.js` uses an IntersectionObserver to `play()` them when they scroll near the
  viewport and `pause()` them when they leave, so the page never downloads/decodes a dozen
  clips on load. Do NOT re-add `autoplay` or `src` eager-loading to these videos, and keep
  `preload="none"` — that attribute is also the selector the observer uses.
- **Marquees/tickers loop via CSS `translateX(-50%)`**, which only looks seamless if the
  track is an **even** number of copies wide enough to cover the screen. `main.js`
  (`buildMarquee`) measures one set vs the container and duplicates to ≥2× the viewport
  width, re-fitting on font-load and resize. Don't hand-duplicate the markup or the loop
  will show a gap on wide screens.
- **Image processing MUST be colour-managed — use `sharp`, never .NET/System.Drawing.**
  System.Drawing strips ICC profiles, which dulls wide-gamut (P3, iPhone) photos. All
  photos in `Images/` are optimised to max 2000px, JPEG q82 (mozjpeg), **with the ICC
  profile preserved** (`sharp(...).resize({width:2000,withoutEnlargement:true}).jpeg({quality:82,mozjpeg:true}).withMetadata()`).
  Originals are recoverable from git history if a re-do is needed.
- **Cache-busting for CSS/JS:** the `<link>`/`<script>` refs carry a `?v=N` query
  (currently `?v=2`). `/assets/*` is `must-revalidate` and `/Images/*` is `max-age=86400`
  (see `netlify.toml`). When you change `style.css`/`main.js` etc., bump the `?v=` number so
  returning visitors get the update immediately.

## The quote system (how it works)

Owner sends clients a personalised quote link instead of an emailed image.

1. Owner opens `/admin.html`, enters the password → `admin.js` POSTs
   `{ verify: true, password }` to `/api/quotes`; the function checks it against the
   `ADMIN_PASSWORD` env var and unlocks the builder UI.
2. Owner fills client name, event, services, price, message → POST to `/api/quotes`.
   `create-quote.mts` re-checks the password, builds a readable unique **slug**
   (e.g. `sarah-wedding`), stores the quote JSON in the **`quotes`** Blob store
   (strong consistency), and returns `{ slug, url }`.
3. Owner copies `https://sweetst.co.uk/quote/<slug>` into their email.
4. Client opens the link. `netlify.toml` rewrites `/quote/*` → `/quote.html`; `quote.js`
   reads the slug from the path, fetches `/api/quotes/<slug>` (public `get-quote.mts`),
   and renders a branded quote document. "Accept" opens a pre-filled email.

Security model: the admin **page** is public source (noindex only), but every sensitive
action is validated **server-side** against `ADMIN_PASSWORD`. Quote reads are public — the
slug is the access token, so slugs should stay unguessable-ish (numeric suffix on collision).

## Bookings (admin panel)

The admin page has two tabs: **Bookings** and **New Quote**.

1. On the contact form submit, `main.js` fires two requests: the normal Netlify Forms POST
   (email notification, unchanged) **and** a POST to `/api/bookings` (`save-booking`) that
   stores the enquiry in the **`bookings`** Blob store with `status: "new"`.
2. The admin **Bookings** tab calls `bookings-admin` (`action: "list"`, password-gated) and
   renders each enquiry. Booking fields are **escaped** in `admin.js` (stored-XSS safety —
   enquiry text is untrusted).
3. **"Create quote →"** on a booking pre-fills the quote form (client name, event date,
   guests, matched service checkboxes) and switches to the New Quote tab; the owner only
   adds price + message. Service matching maps the form's "Chai" to the quote's "Masala Chai".
4. On generate, the linked booking is marked `status: "quoted"` (with the quote slug), so the
   list shows what's outstanding. Bookings can also be marked quoted/new or deleted.

## Required Netlify configuration

- **Env var `ADMIN_PASSWORD`** — set in the Netlify dashboard (Site config → Environment
  variables). The quote builder and creation endpoint are non-functional without it.
- **Netlify Forms** — the `contact` form in `contact.html` uses `data-netlify="true"` +
  hidden `form-name` + honeypot; Netlify detects it during the **Git build**. `main.js`
  submits it via `fetch` to `/` (email) AND to `/api/bookings` (Bookings store).
  **Email notifications are a manual one-time step** in the dashboard: Site config →
  Forms/Notifications → add an Email notification. Detection + email do not happen from the
  tags alone.
- Functions and Blobs need no extra config on Netlify; Blobs auto-provision.

## Deployment

- The Netlify site is **connected to the GitHub repo** `jaydenmistry713-jpg/sweetst`
  (branch `main`). **Deploy by `git push`** — Netlify builds automatically (installs deps,
  bundles the Functions, runs Forms detection).
- **NEVER deploy by drag-and-drop.** Drag-drop skips `npm install`, so the Functions have no
  `@netlify/blobs`/`@netlify/functions` and crash (this is exactly what broke bookings once).
- Quotes and enquiries live in **site-wide** Blob stores (`getStore`, not `getDeployStore`),
  so redeploys never wipe them. Data persists until explicitly deleted.
- Quick health check after a deploy: `GET /api/quotes/test` should return JSON
  `{"error":"Quote not found."}` (not a Netlify 404 HTML page).

## Local development

```bash
npm install
npx netlify dev      # serves the site + Functions + local Blobs sandbox
```

A plain static server (e.g. `python -m http.server`) renders the marketing pages but the
`/api/quotes` Functions and the `/quote/*` rewrite will NOT work — use `netlify dev` to
exercise the quote system. Local Blobs are a separate sandbox from production.

## Content notes

- Toppings/sauces are **hard-coded text** in `menu.html` and the home menu teaser
  (the old `Images/Toppings.png` / `Sauces.png` are no longer referenced). If the real
  menu changes, edit those lists. Toppings & sauces apply to **both** pancake and waffle carts.
- Real photography lives in `Images/` with web-safe names: `cart-pancake.JPEG` (pink
  pancake cart), `cart-chai*.JPEG` (chai cart), `pancakes-griddle.JPEG` / `pancakes-event.JPEG`
  (mini pancakes cooking), `chaat-bowl.jpeg` / `chaat-samosas.jpeg` / `chaat-counter.jpeg`
  (real chaat counter), and clips `vid-batter.mp4`, `vid-topping.mp4`, `vid-topping-2.mp4`,
  `vid-drone.mp4`. The old stock `chaat.jpg` was removed. `event-aerial.jpg` is stored but
  unused (it is rotated/sideways).
- **No waffle photo exists yet.** The Waffle Cart tile (home) and service block (services)
  currently reuse `pancakes-event.JPEG` as a placeholder — swap for a real waffle shot when
  available.
- Homepage service cards are image **tiles** (`.tile`), not emoji cards; the menu page cards
  have no emoji icons either. CTA bands can take a media background via
  `class="cta-band cta-media"` + a `.cta-bg` `<img>`/`<video>` child (the `.cta-bg` must NOT be
  matched by the content-lift rule — see the `:not(.cta-bg)` selector in `style.css`).
- **SEO titles** follow `[service keyword] | Sweet St` (e.g. "Delicious Mini Pancake Cart
  Hire | Sweet St"); descriptions list the services (Dutch mini pancakes, waffle station,
  gol gappe, chaat, chai) + example events. `<title>`, `meta description`, and og/twitter
  tags are kept in sync per page. `quote.html`/`admin.html` stay `noindex`.
- Testimonials are illustrative; replace with real named reviews when possible.
- Do not fabricate stats/metrics. The homepage trust strip uses only verifiable facts.

## Contact / brand facts

- Email `sweetstuk@outlook.com` · Phone/WhatsApp `+44 7983 408 097`
- Instagram `@sw33t_st_dessertsuk` · TikTok `@sweetstuk`
- Palette (design system v3, logo-matched): peach `#ecd4b9` / cream `#fbf4ea` /
  paper `#fffcf6` / brand-brown `#93765a` / deep `#4f3d2b` / gold `#cea878` /
  gold-deep `#b28c54` / dusty-rose accent `#d7a49c` (used sparingly).
