# Images

This folder exists so the images have somewhere to land. Drop files in here.

## The logo

Name it **`logo`** with any of these extensions — `.png`, `.jpg`, `.jpeg`, `.svg`
or `.webp`. The site tries each in turn and uses the first one it finds, as the
mark in the header on every page and as the browser-tab favicon.

Nothing else needs changing — no code, no config. Add the file, and the
typographic "R" stand-in is replaced everywhere the next time the site deploys.

### What's here now

- **`logo.png`** — 320px, 37 KB. This is the file the site actually serves, in
  the header and as the favicon. Quantised to 256 colours, which is invisible at
  the 56px it renders at and takes it from megabytes to kilobytes.
- **`logo-full.png`** — the 1254px master as supplied. Not served to browsers;
  kept for print, social, and anything needing full resolution.

If you replace the logo, drop the new master in and say so — the served copy
needs regenerating from it, or the site will be carrying a multi-megabyte image
on every page load.

## Photographs

Not wired up yet. When they arrive, the plan is:

- `hero.jpg` — one wide shot of the room or the storefront, for the home page
- `menu/` — dish photographs, referenced by filename from `data/menu.json`

Compress before committing. A café site should stay light on mobile data — aim
for under 300 KB per image, and resize anything wider than 2000px.
