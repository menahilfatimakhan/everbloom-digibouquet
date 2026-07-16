# Editing content without touching code

Everything a florist would plausibly want to change day-to-day lives in `src/content/*.json` — plain data files, no code required.

## Flowers — `src/content/flowers.json`
Each entry: `id` (must match an SVG filename in `src/assets/svg/flowers/`), `name`, `footprintRadius` (roughly how much visual space the bloom needs — bigger flowers like peony/sunflower use 42-48, smaller ones like tulip/delphinium use 26-34), `layerBias` (`"back"`, `"mid"`, or `"front"` — where it tends to sit in the composed bouquet), and `fill`/`fillDeep`/`center` (the flower's natural color — this is **not** affected by the color-theme picker, by design; a sunflower stays yellow in every theme).

To add a new species: run `npm run new-flower -- <id> "<Display Name>" "<meaning>"` (see `tools/new-flower.mjs`), which scaffolds a starter SVG and the entries in both `flowers.json` and `floriography.json` together, then edit the SVG (see `docs/flower-art-guide.md`).

## Floriography — `src/content/floriography.json`
A single, dedicated `[{ id, meaning }]` file — kept separate from `flowers.json` on purpose, so editing a flower's meaning never means touching its technical/visual fields. `id` must match a `flowers.json` id (a Vitest test asserts the two files stay in sync). Shown as a hover(desktop)/tap(mobile) tooltip via the ⓘ button on each flower card in the Pick step, and subtly on the recipient reveal page when hovering an opened bloom.

## Greenery — `src/content/greenery.json`
Same idea, simpler: `id` (matches `src/assets/svg/greenery/<id>.svg`), `name`, `fill`/`fillDeep`.

## Presentation — `src/content/presentation.json`
Four sections: `wraps`, `vases`, `ribbons` (each an `id` matching `src/assets/svg/presentation/<id>.svg`, plus material colors), and `themes` (each with an `accent`/`accentDeep` used to retint the ribbon and card accents — **not** the flowers or the wrap material — plus a `paper` color that sets a subtle background "mood" tint on the recipient reveal page specifically, nowhere else in the app).

## Occasions — `src/content/occasions.json`
Each preset (`birthday`, `anniversary`, ...) has a `suggestedTheme`, `suggestedBlooms`, and a `suggestedCardMessage` — clicking the preset in Pick Blooms pre-fills all three, but never locks any of it; the visitor can still add/remove any flower, change the theme, or rewrite the card message afterward. Picking a different preset always overwrites the previous one's suggestions (consistent with how it already overwrote blooms/theme).

## Card fonts — `src/content/cardFonts.json`
Each entry needs a CSS `family` string and, if it's a Google Font not already loaded, a `googleFont` value matching the Google Fonts API query param (see the `@import` at the top of `src/styles/global.css`, where new fonts need to be added alongside the existing ones).

## Card themes — `src/content/cardThemes.json`
Three named visual styles for the card panel itself (not the surrounding page) — Classic Cream, Torn Vintage, Midnight. Each entry: `id`, `name`, `paper`/`paperDeep` (card background), `ink` (text + signature-doodle color), `borderColor`, and `edge` (`"clean"` or `"torn"` — a CSS discriminator; `"torn"` gets a deckle-edge `clip-path` in `src/styles/components/cardThemes.css`, no image assets involved). Shown identically in the Write step's live preview and the recipient reveal's card via the shared `.card-surface` class, so the two can't visually drift apart. Adding a 4th theme is a new JSON entry plus a case in that CSS file if it needs a different `edge` treatment than the two that already exist.

## Brand copy, colors, wordmark
- Colors/fonts: `src/styles/tokens.css`
- Header/footer/logo mark: `src/components/layout/SiteHeader.astro`, `SiteFooter.astro`, and `public/logo/everbloom-stamp.png` (the real Everbloom stamp badge, background removed — see `docs/architecture.md` for how it was processed)
- Landing page copy: `src/pages/index.astro`
