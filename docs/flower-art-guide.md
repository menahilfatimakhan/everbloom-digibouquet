# Flower art conventions

All bloom/greenery/presentation art lives in `src/assets/svg/` as hand-authored SVG, built to a shared convention so any piece can be swapped or a new one added without touching the layout code.

## Conventions
- **viewBox**: `0 0 160 160` for flowers and greenery, flower head/leaf centered at `(80, 80)`. The rendered size is *not* fixed — `renderPlacements.ts` scales each instance from the species' `footprintRadius` (in `flowers.json`/`greenery.json`), so a placement never renders larger than the room the layout engine actually spaced it for.
- **No stems are drawn anywhere** — not in the flower/greenery art, and not by the composition layer either. Every species is just its bloom/leaf head; the layout engine only ever positions bloom heads relative to each other.
- **Color via CSS custom properties, not hardcoded fills**: use `var(--bloom-fill)`, `var(--bloom-fill-deep)`, `var(--bloom-center)` (flowers) or `var(--greenery-fill)`/`var(--greenery-fill-deep)` (greenery). The renderer sets these per-instance from `flowers.json`/`greenery.json` at render time — this is what lets 12 species share one visual "ink" language (linework always in the brand purple, via `var(--color-line)`) while each keeps its own natural bloom color.
- **Technique**: define one petal `<path>` in `<defs>`, then build rings via `<use href="#petal" transform="rotate(N 80 80)"/>`. Concentric rings use `transform="translate(80,80) scale(S) translate(-80,-80)"` wrapping a set of `<use>` elements, which scales a ring about the shared center without needing a second hand-drawn path. See any file in `src/assets/svg/flowers/` for the pattern.
- **Presentation art** (`src/assets/svg/presentation/`) uses a wider `viewBox="0 0 320 320"` (wraps/vases) or `"0 0 200 130"` (ribbons), since these frame the whole bouquet rather than being a single repeatable instance.
- **Optional `data-bow-part` convention on ribbon art**: the recipient reveal's ribbon-untie animation looks for child elements tagged `data-bow-part="loop-left"|"loop-right"|"knot"|"wrap"|"tail-left"|"tail-right"` (see `satin-bow.svg`/`twine.svg`) so it can animate them independently. A ribbon asset without any of these tags still works fine — the animation falls back to a plain fade of the whole ribbon group instead of erroring.

## Swapping in real illustrated art later
Because color comes from CSS variables and position comes entirely from the layout engine (not from anything baked into the art), replacing a starter SVG with real illustrated artwork is a drop-in: keep the same filename (matching the `id` in the content JSON), same `viewBox` convention, and reference the same `var(--bloom-*)` properties for anything that should stay themeable. The rest of the app doesn't need to change.
