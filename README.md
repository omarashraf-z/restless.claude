# Restless Coffee House & Bakery — website

The website for Restless Coffee House & Bakery, 232 St. cross 213 St., Degla, Maadi, Cairo.

**Status: working skeleton.** The structure, menu system and opening-hours logic all work.
What's missing is Restless's own material — logo, photography, the real menu, confirmed
hours. See [Outstanding](#outstanding) below.

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

- [ ] Logo, in any format — the palette and typography get derived from it
- [ ] The real menu with prices (photos of the printed menu are fine)
- [ ] Confirmed opening hours, including Friday and any Ramadan difference
- [ ] 10–15 photos: interior, counter, coffee, the bakery case, signature dishes
- [ ] WhatsApp number for orders
- [ ] Live delivery links (Talabat, Instashop — elmenus is already in)
- [ ] Language decision: English, Arabic, or both (bilingual is an architecture decision,
      not a content one — worth settling early)
- [ ] A domain

Still to build:

- [ ] Cakes & catering page with the WhatsApp order flow
- [ ] Our Story page
- [ ] Real photography throughout, and an Open Graph image so shared links render as cards
- [ ] Arabic / RTL, if we're doing it
- [ ] A small CMS so staff can edit the menu without touching the repository

The full plan is in [`docs/restless-website-plan.html`](docs/restless-website-plan.html).
