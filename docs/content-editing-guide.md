# Editing content without touching code

Everything a florist would plausibly want to change day-to-day lives in `src/content/*.json` — plain data files, no code required.

## Flowers — `src/content/flowers.json`
Each entry: `id` (must match an SVG filename in `src/assets/svg/flowers/`), `name`, `meaning` (shown as the floriography caption), `footprintRadius` (roughly how much visual space the bloom needs — bigger flowers like peony/sunflower use 42-48, smaller ones like tulip/delphinium use 26-34), `layerBias` (`"back"`, `"mid"`, or `"front"` — where it tends to sit in the composed bouquet), and `fill`/`fillDeep`/`center` (the flower's natural color — this is **not** affected by the color-theme picker, by design; a sunflower stays yellow in every theme).

To add a new species: run `npm run new-flower -- <id> "<Display Name>" "<meaning>"` (see `tools/new-flower.mjs`), which scaffolds a starter SVG and the JSON entry together, then edit the SVG (see `docs/flower-art-guide.md`).

## Greenery — `src/content/greenery.json`
Same idea, simpler: `id` (matches `src/assets/svg/greenery/<id>.svg`), `name`, `fill`/`fillDeep`.

## Presentation — `src/content/presentation.json`
Four sections: `wraps`, `vases`, `ribbons` (each an `id` matching `src/assets/svg/presentation/<id>.svg`, plus material colors), and `themes` (each with an `accent`/`accentDeep` used to retint the ribbon and card accents — **not** the flowers or the wrap material).

## Occasions — `src/content/occasions.json`
Each preset (`birthday`, `anniversary`, ...) has a `suggestedTheme` and `suggestedBlooms` — clicking the preset in Pick Blooms pre-fills that selection, but never locks it; the visitor can still add/remove any flower afterward.

## Card fonts — `src/content/cardFonts.json`
Each entry needs a CSS `family` string and, if it's a Google Font not already loaded, a `googleFont` value matching the Google Fonts API query param (see the `@import` at the top of `src/styles/global.css`, where new fonts need to be added alongside the existing ones).

## Brand copy, colors, wordmark
- Colors/fonts: `src/styles/tokens.css`
- Header/footer/logo mark: `src/components/layout/SiteHeader.astro`, `SiteFooter.astro`, and `public/logo/everbloom-stamp.png` (the real Everbloom stamp badge, background removed — see `docs/architecture.md` for how it was processed)
- Landing page copy: `src/pages/index.astro`
