# Restless Coffee House & Bakery — website

The website for Restless Coffee House & Bakery, 232 St. cross 213 St., Degla, Maadi, Cairo.

**Status: real content, no photography.** The full menu (254 items), the real opening
hours and the brand's own palette are all in. What's missing is imagery — the logo file
and photographs. See [Outstanding](#outstanding) below.

## The look

The palette and typography are taken from the brand's own material rather than invented:

| Token | Source |
|---|---|
| `--sepia` | the textured brown ring of the badge logo |
| `--chalk` / `--script` | the pencil-blue disc behind the illustration, and the brush script the printed menu uses for "The Pasta", "The Pizza" |
| `--paper` | the aged cream stock the printed menu is set on |
| `--red` | the callouts and "new" flashes on the printed menu |

Type is Archivo (headings, item names, UI), Crimson Pro (running prose) and Yellowtail
(the menu's section titles, echoing the printed script). Menu items use dotted leaders
between name and price, the way the printed menu sets them.

---

## How it's built

Plain HTML, CSS and a single JavaScript file. No framework, no build step, no npm install.
That's a deliberate choice for this site:

- most visitors arrive from a link in the Instagram or Facebook bio, on mobile data — a
  static page is the fastest thing that can be served
- there is no build to break, so a year from now the site still deploys
- GitHub Pages hosts it for free; the only recurring cost is the domain

### Layout

```
index.html          Home
menu.html           Menu — rendered from data/menu.json
visit.html          Hours, directions, phone numbers
assets/css/site.css All styling. The palette is one :root block at the top.
assets/js/site.js   Hours logic, contact links, menu rendering
data/site.json      Address, phones, WhatsApp, hours, delivery links
data/menu.json      The entire menu
docs/               Project plan
```

Nothing about the business is hardcoded in the JavaScript — the pages read `data/`.

---

## Editing the site

### Change a price, add an item

Open `data/menu.json`. Each section holds a list of items:

```json
{
  "name": "Flat White",
  "description": "Optional, one short line",
  "price": 85,
  "tags": ["signature"]
}
```

`price: null` hides the price for that one item. Available tags: `vegetarian`, `vegan`,
`spicy`, `contains-nuts`, `signature`. Save, commit, and the live site updates in about a
minute. To hide every price at once, set `showPrices` to `false` in `data/site.json`.

### Change opening hours

`data/site.json` → `hours`. Times are 24-hour. A closing time earlier than the opening time
means the shift runs past midnight, so `"open": "09:00", "close": "01:00"` is 9am to 1am.
Use `{ "closed": true }` for a day off. The open/closed indicator on every page is computed
from this, in Cairo time.

Set `"_confirmed": true` once the real hours are in — until then the site says
"Hours to be confirmed" rather than claiming hours nobody verified.

### Turn on WhatsApp ordering

In `data/site.json`, set `whatsapp.number` to the full international number (digits only,
e.g. `201XXXXXXXXX`) and `whatsapp.enabled` to `true`. Every "Order on WhatsApp" button
across the site then opens a chat with the message pre-written. Until it's set, those
buttons render disabled rather than broken.

### Change the colours

`assets/css/site.css`, the `:root` block at the top. The current palette is a placeholder
chosen to stay out of the way; it gets rebuilt from the logo. Colours are defined in three
places — light, `prefers-color-scheme: dark`, and `[data-theme="dark"]` — so both themes
stay consistent. Nothing else in the stylesheet uses a raw colour value.

---

## Running it locally

The pages load their data with `fetch()`, which browsers block on `file://` URLs. Open the
site through a local server, not by double-clicking the HTML:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying

Pushing to `main` triggers `.github/workflows/pages.yml`, which publishes the repository
root to GitHub Pages. Enable it once, under **Settings → Pages → Source: GitHub Actions**.

---

## Outstanding

Needed from Restless before the site can go public:

- [ ] **The real WhatsApp number.** `data/site.json` currently carries a placeholder that
      is publicly visible and receives every order button's message.
- [ ] **The logo file**, saved as `assets/img/logo.png`. Every page picks it up
      automatically; until then they show a typographic stand-in.
- [ ] 10–15 photos: interior, counter, coffee, the bakery case, signature dishes
- [ ] The Our Story copy — who started Restless, when, and why Maadi
- [ ] Parking / landmark line for the Visit page
- [ ] Live delivery links (Talabat, Instashop — elmenus is already in)
- [ ] Language decision: English, Arabic, or both (bilingual is an architecture decision,
      not a content one — worth settling early)
- [ ] A domain

## Spellings kept from the print

The site matches the printed menu exactly, including two misspellings. Both are marked
with a `_spelling` note in `data/menu.json` so nobody silently "corrects" them later:

- **"Ristless Omelette with Smoked Salmon"** — the breakfast omelette page. Note the same
  dish is spelled *Restless* on the Special Omelette page, and the site follows each page.
- **"Café Latte 16oz (Truple shot)"** — the hot coffee page.

Change the printed menu first, then change these.

One open question: Cheese Croissant is 109.99 under Baked Goods and 149.99 as a croissant
sandwich — presumably plain-baked versus made up as a sandwich, but worth confirming so
the site doesn't read as contradicting itself.

Still to build:

- [ ] Cakes & catering page with the WhatsApp order flow
- [ ] Our Story page
- [ ] Real photography throughout, and an Open Graph image so shared links render as cards
- [ ] Arabic / RTL, if we're doing it
- [ ] A small CMS so staff can edit the menu without touching the repository

The full plan is in [`docs/restless-website-plan.html`](docs/restless-website-plan.html).
