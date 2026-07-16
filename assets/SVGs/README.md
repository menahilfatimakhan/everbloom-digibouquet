# Everbloom Digibouquet — Bloom Set

9 hand-illustrated flowers in a loose watercolor + ink style, matched to the
Everbloom brand (cream paper, hand-drawn line). Each is a self-contained SVG with
no external dependencies — the watercolor look is done with inline SVG filters
(feTurbulence + feDisplacementMap), so there are no image files to manage.

## Files
- `svg/` — the 9 flowers: rose, peony, tulip, lily, daisy, sunflower,
  carnation, delphinium, orchid
- `gallery.html` — open in any browser to preview the whole set

## Dropping them into the app
These are meant to slot into the existing flower swap-in system.

1. Copy the SVGs into wherever the app keeps flower art (e.g. `/assets/flowers/`).
2. Point each flower's `id` at its filename. The ids match the existing
   picker names (rose, peony, tulip, lily, daisy, sunflower, carnation,
   delphinium, orchid) so the mapping should be 1:1.
3. Because each file is a standalone `<svg>`, you can also inline them directly
   into components if you want them to inherit CSS transitions (hover pop, etc.).

## Recoloring / tuning
Colors live in the `<radialGradient>` defs at the top of each SVG (two stops:
light center → saturated edge). Adjust those hex values to shift a bloom's palette
without touching the shapes.

## Note on style
This is the loose watercolor + ink look (like the original Digibouquet reference).
It is NOT the fine botanical-painting look — that style is raster artwork and
can't be reproduced as code. If you ever want that instead, these files can be
swapped out one-for-one; the app won't care which style the SVGs are.
