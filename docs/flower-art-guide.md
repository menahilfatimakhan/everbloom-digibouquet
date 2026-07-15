# Flower art conventions

All bloom/greenery/presentation art lives in `src/assets/svg/` as hand-authored SVG, built to a shared convention so any piece can be swapped or a new one added without touching the layout code.

## Conventions
- **viewBox**: `0 0 160 160` for flowers and greenery, flower head/leaf centered at `(80, 80)`. This is the point the layout engine positions and rotates around.
- **No stem in the flower/greenery art itself.** Stems are drawn separately by the composition layer (`layoutEngine.ts`'s `stemsPath`, gathered toward a tie point) — this keeps every species interchangeable regardless of how tall or short its own art is.
- **Color via CSS custom properties, not hardcoded fills**: use `var(--bloom-fill)`, `var(--bloom-fill-deep)`, `var(--bloom-center)` (flowers) or `var(--greenery-fill)`/`var(--greenery-fill-deep)` (greenery). The renderer sets these per-instance from `flowers.json`/`greenery.json` at render time — this is what lets 12 species share one visual "ink" language (linework always in the brand purple, via `var(--color-line)`) while each keeps its own natural bloom color.
- **Technique**: define one petal `<path>` in `<defs>`, then build rings via `<use href="#petal" transform="rotate(N 80 80)"/>`. Concentric rings use `transform="translate(80,80) scale(S) translate(-80,-80)"` wrapping a set of `<use>` elements, which scales a ring about the shared center without needing a second hand-drawn path. See any file in `src/assets/svg/flowers/` for the pattern.
- **Presentation art** (`src/assets/svg/presentation/`) uses a wider `viewBox="0 0 320 220"` (wraps/vases) or `"0 0 200 120"` (ribbons), since these frame the whole bouquet rather than being a single repeatable instance.

## Swapping in real illustrated art later
Because color comes from CSS variables and position comes entirely from the layout engine (not from anything baked into the art), replacing a starter SVG with real illustrated artwork is a drop-in: keep the same filename (matching the `id` in the content JSON), same `viewBox` convention, and reference the same `var(--bloom-*)` properties for anything that should stay themeable. The rest of the app doesn't need to change.
