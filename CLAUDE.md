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
  services.html       Services HUB — short summary card per service + links out.
                      Deliberately shallow: depth lives on the four service pages.
  menu.html           Toppings & sauces reference (shared by pancake + waffle) + router
                      to the service pages. Do NOT re-add a "everything we serve" block.

  ── dedicated service pages (the SEO spokes) ──
  mini-pancake-cart-hire.html      Mini pancake cart
  waffle-station-hire.html         Waffle station  ← highest-value page, see SEO notes
  gol-gappe-chaat-catering.html    Gol gappe & chaat
  masala-chai-cart-hire.html       Masala chai cart

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
  If you change one, update all page files to match. The header nav contains a **Services
  dropdown** (`li.has-sub` > `ul.sub-menu`) listing the four service pages — CSS-only
  (`:hover` / `:focus-within`), no JS. On mobile (<=820px) it flattens to an indented list.
  The footer "Explore" column also links all four service pages sitewide.
- Use **absolute paths** (`/assets/...`, `/Images/...`) so links work from any route
  (including the pretty `/quote/<slug>` URL).
- Design tokens (colours, fonts, spacing, radius, shadows, motion) are CSS custom
  properties in `:root` at the top of `style.css`. Prefer tokens over hard-coded values.
- Reusable components already exist: `.btn`, `.card`, `.split`, `.menu-panel`, `.rail`,
  `.marquee`, `.gallery` + lightbox, `.form-card`, `.cta-band`, `.page-hero`, `.steps`,
  `.reveal` (scroll animation). Reuse before inventing new CSS.
- Motion respects `prefers-reduced-motion`.
- **Header contrast over dark heroes.** `.site-header` is transparent until `.scrolled`, so
  on any page with a `.page-hero.has-media` (every page except `index.html`) its dark nav
  text sat on a dark photo. `style.css` lifts the header to white via
  `body:has(.page-hero.has-media) .site-header:not(.scrolled)`, scoped to `min-width:821px`
  for the nav links so the mobile slide-in panel (cream) keeps dark text. The rule targets
  `.nav-links > li > a` — **not** `.nav-links a` — because the dropdown panel is nested
  inside and must stay dark. `.page-hero.has-media .btn-ghost` is lifted to white too.
  Keep `index.html` out of this: it has no `.page-hero`, so it is untouched by design.
- **Card grids: use `.grid-center`, not `.grid-3`, for card sets.** `.grid-3` is
  `auto-fit`/`1fr`, which stretched a 6-card set into 4 + 2 with the orphans jammed left.
  `.grid-center` is flex + `justify-content:center` (3 up, 2 up under 1000px, 1 under
  680px), so an incomplete last row centres under the rows above.
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
  profile preserved**. Prefer **`.keepIccProfile()`** over `.withMetadata()`: both keep the
  colour profile, but `withMetadata()` also carries 3-12KB of camera EXIF per file (and any
  GPS tags) into a public asset. Current recipe:
  `sharp(src).rotate().resize(w,h,{fit:'cover'}).jpeg({quality:82,mozjpeg:true}).keepIccProfile()`.
  Always verify `metadata().icc` is present on the output — a lost profile is what dulls
  wide-gamut photos, and it fails silently.
  Older originals are recoverable from git history; newer source media is gitignored (below).
- **Cache-busting for CSS/JS:** the `<link>`/`<script>` refs carry a `?v=N` query
  (currently `?v=3`). `/assets/*` is `must-revalidate` and `/Images/*` is `max-age=86400`
  (see `netlify.toml`). When you change `style.css`/`main.js` etc., bump the `?v=` number so
  returning visitors get the update immediately.

## Media pipeline & the waffle assets

**The waffles are on a stick** — batter cooked in a long slotted iron, served on a wooden
skewer and drizzled to order. Not Belgian/Liege rounds. Copy should say "waffle on a stick"
where it helps; do not describe them as classic Belgian waffles.

Live waffle assets in `Images/` (all lowercase `.jpg` / `.mp4`):

```
waffle-station-griddle.jpg    1800x1200  hero - waffles cooking in the iron
waffle-chocolate-drizzle.jpg  1600x1200  close-up, chocolate + white chocolate
waffle-station-cart.jpg       1600x1200  served in a tray at the cart
waffle-on-a-stick.jpg         1200x1600  portrait - homepage tile
waffle-station-serving.jpg    1536x853   wide - CTA band background
waffle-{batter-pour, station-cooking, chocolate-sauce, toppings, served}.mp4
  + a matching -poster.jpg for each        720x1280, ~0.8-1.9MB each
```

**Video recipe** (ffmpeg; `ffmpeg-static` via npm if not on PATH). Sources were 17-25MB
each and compressed ~92% with no visible loss:

```
-vf scale=720:1280:flags=lanczos -c:v libx264 -profile:v high -crf 26 -preset slow
-pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709
-an -movflags +faststart
```

`-an` is deliberate — the rail plays muted loops, so audio is dead weight. The bt709 tags
are explicit because the iPhone sources were untagged and browsers otherwise guess. Check
`color_transfer` on any new source first: if it is HLG or PQ (HDR), it needs tone mapping,
and encoding it straight to SDR will wash the colour out.

Rail videos **must** keep `preload="none"` (it is the IntersectionObserver's selector) and
should carry a `poster` so the rail isn't blank before playback.

**Source media is gitignored.** `Images/waffle images/` (100MB) and `290826/` (19MB) stay
local. `netlify.toml` has `publish = "."`, so anything committed under `Images/` is served
publicly — and git keeps large blobs forever. Keep optimised output in `Images/` and leave
originals out.

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
- **SEO titles** follow `[service keyword] | Sweet St` (e.g. the home page is "Mini Pancake
  Cart & Waffle Station Hire | Sweet St"); descriptions list the services (Dutch mini
  pancakes, waffle station, gol gappe, chaat, chai) + example events. `<title>`,
  `meta description`, and og/twitter tags are kept in sync per page. Keep titles under ~60
  characters so Google does not truncate them. `quote.html`/`admin.html` stay `noindex`.
- **Search Console signal (Aug 2026):** "waffle station leicester" is by far the biggest
  query (343 impressions / 28 days, 0 clicks), ahead of "sweet st", "pancake cart" and
  "pancakes leicester". The home title was widened to cover waffles because of this. The
  owner chose to leave "Leicester" out of the title to stay UK-wide, so the geo term is
  currently unaddressed on the home page — revisit via the meta description if clicks stay flat.
- Testimonials are illustrative; replace with real named reviews when possible.
- Do not fabricate stats/metrics. The homepage trust strip uses only verifiable facts.

## SEO structure (service split, Aug 2026)

The site was split from one `services.html` into a **hub-and-spoke**: the hub routes, the
four service pages carry the depth (~770-960 words each). This exists to fix a specific
problem — Search Console showed **"waffle station leicester" at 343 impressions / 0 clicks
in 28 days** with no page dedicated to it and only one "Leicester" mention on the old hub.

Rules that keep the split working — breaking these re-creates the cannibalisation:

- **One primary intent per page.** Don't add detailed pancake/waffle/chaat/chai content back
  onto `services.html` or `menu.html`; link to the service page instead.
- **`menu.html` owns the toppings & sauces list.** It's shared by the pancake and waffle
  carts, so it lives in exactly one place. Service pages carry a short highlight list plus a
  link — never a full copy of the list.
- Every service page has `Service` + `BreadcrumbList` JSON-LD and its own `FAQPage` block.
  `contact.html` also has `FAQPage`. `index.html` has `FoodEstablishment` + `hasOfferCatalog`
  pointing at the four services.
- Titles stay under 60 chars, meta descriptions under ~165, geo ("Leicester") lives in the
  **service page** titles so the home page can stay UK-wide.

### Internal linking (this is load-bearing)

The homepage's four `.tile` links point **directly at the four service pages**, not at
`/services.html#anchor`. They used to use hub anchors, and the hub rewrite silently killed
those anchors — the links stayed valid-looking but jumped nowhere. **If you ever change the
hub's structure again, re-check `index.html`'s tiles.** `scratchpad/anchors.py`-style
fragment checking is worth repeating: a normal broken-link check passes these, because the
page exists and only the `#fragment` is dead.

Beyond being correct, this is deliberate SEO: the homepage carries the most authority on the
site, and it should pass it to the pages that need to rank rather than pooling it in the hub.
Tile labels double as anchor text, so the waffle tile reads **"Waffle Station"** (the phrase
with the search volume), not "Waffle Cart".

`index.html` also carries `WebSite` schema (`@id` `#website`) wired to the `FoodEstablishment`
(`@id` `#business`) via `publisher`, plus `og:site_name` on every page. That is Google's
**site name** signal — what shows above the URL in results. Don't split these into two
unlinked entities; the `@id` reference is what stops Google seeing two organisations.

### URL structure: deliberately flat

Service pages sit at the root (`/waffle-station-hire.html`), **not** `/services/…`. This was
considered and rejected: nesting delivers no measurable ranking benefit, and hierarchy is
already carried by the nav, breadcrumbs and `BreadcrumbList` schema. Don't restructure
without a concrete reason — post-indexing it costs redirects.

### What structured data will and won't do here

- `BreadcrumbList` → **does** show the Home › Services › … path in results. Real, working.
- `FAQPage` → will **not** produce FAQ rich results. Google restricted those to recognised
  government and health sites in Aug 2023. It is kept because it still helps Google and AI
  assistants parse the answers — but do not expect it to change the SERP appearance.
- `AggregateRating` stars → the biggest untapped SERP win, and it needs **real reviews**.
  Never fabricate these; invented ratings are a manual-action risk.

Crawl config needs **no** changes for new service pages: `robots.txt` is `Allow: /` with a
sitemap reference (it only disallows `/admin.html`, `/quote.html`, `/quote/`), and
`netlify.toml`'s only redirect is `/quote/*`. Adding a page means adding it to
`sitemap.xml` — nothing else.

### Open items

- **`index.html` title stays as "Mini Pancake Cart & Waffle Station Hire"** — owner
  decided (29 Aug 2026) to keep it, having been told it overlaps with
  `/waffle-station-hire.html`. Do not change it back without asking. Watch Search Console:
  if the service page cannot outrank the home page for "waffle station leicester", revisit.
- **`[TODO: confirm cart footprint in metres.]`** — owner didn't know the measurement, and
  "how much space does a waffle cart need" is a real query, so measure the carts and fill
  these in. On **all four** service pages it is now hidden: an inert HTML comment in the body
  and **removed entirely from each page's FAQPage JSON-LD** (JSON can't hold comments, and a
  `[TODO]` string must never ship inside structured data). Nothing renders to visitors. When
  the measurements arrive, uncomment and replace — grep for `[TODO:`. Note the chaat page's
  wording differs slightly ("confirm footprint in metres", no "cart").
- ~~No real waffle photo exists~~ — **done 29 Aug 2026.** Real waffle photography and five
  video clips are live; no placeholders remain on the site.
- ~~Image SEO~~ — **done 29 Aug 2026.** `gallery-1..8.JPEG` were renamed to descriptive
  lowercase filenames (e.g. `pancake-batter-on-griddle.jpg`, `sweets-cart-blossom-styling.jpg`)
  with alt text describing what is actually in each shot; the "Sweet St. catering event N"
  placeholders are gone. Video files (`event3.mp4` etc.) keep generic names deliberately —
  filenames are not a meaningful signal for them, and their `aria-label` carries the meaning.
  Every rail video now also has a `-poster.jpg` so tiles are not blank before playback.
- ~~Nav links low-contrast over media heroes~~ — **fixed 29 Aug 2026** (see below).

## Dietary & claims accuracy

Owner-confirmed facts — do not soften, embellish, or extrapolate beyond these:

- Everything is **halal** (schema previously said "halal-friendly"; now "halal") and
  **eggless**, with **nut-free options** available.
- Pancakes: **5 mini pancakes per portion, served in a tray**. Waffles: eggless; the exact
  style (Belgian/Liege/Brussels) is **unconfirmed** — don't name one.
- Chaat counter: **samosa chaat and papdi chaat**, fully **vegetarian**, served by staff
  (not self-service). It **contains dairy** — so it must **NEVER** be described as vegan or
  dairy-free. Owner asked that milk not be called out explicitly, so say "vegetarian" and
  stop there.
- Chai: **masala and karak**, unlimited refills, served on its own.
- Logistics: **2 hour service window + 1 hour setup**, **one standard UK socket** (pancake
  griddle / chai kettle), **no minimum or maximum guest count**, **50% deposit** secures a
  date. Corporate events: yes.
- **No pricing is published anywhere** — this is a deliberate decision; every page ends in
  the quote CTA.

## Contact / brand facts

- Email `sweetstuk@outlook.com` · Phone/WhatsApp `+44 7983 408 097`
- Instagram `@sw33t_st_dessertsuk` · TikTok `@sweetstuk`
- Palette (design system v3, logo-matched): peach `#ecd4b9` / cream `#fbf4ea` /
  paper `#fffcf6` / brand-brown `#93765a` / deep `#4f3d2b` / gold `#cea878` /
  gold-deep `#b28c54` / dusty-rose accent `#d7a49c` (used sparingly).
