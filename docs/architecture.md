# Architecture

## Stack
Astro (server output) + framework-free TypeScript for the interactive builder + GSAP/Lenis for animation. No client-side UI framework — `.astro` files are close to plain HTML, and `src/builder/*` is plain DOM-manipulating TypeScript with a hand-rolled store (see `src/builder/state/bouquetState.ts`), chosen so the codebase stays readable without React/Svelte/Vue knowledge.

## The four-step builder
`src/pages/build.astro` server-renders all four step `<section>`s (Pick, Arrange, Write, Send) from the content JSON in `src/content/`. `src/builder/index.ts` is the client-side entry point: it creates a `BouquetStore`, wires each step's `init*` function (`src/builder/steps/*.ts`), and owns step navigation (`Next`/`Back`, the `StepProgress` indicator, GSAP transitions between steps).

State lives in one plain object (`BouquetState`, see `src/builder/state/schema.ts`) with explicit named mutators (`addBloom`, `setGreenery`, `setCard`, ...) and a tiny pub/sub — every step subscribes and re-renders its own DOM on change. There is no cross-step framework wiring; steps only interact through the shared store.

## Bouquet composition
`src/builder/composition/layoutEngine.ts` turns a `BouquetState` into concrete flower/greenery positions: a seeded PRNG (`arrangementSeed`) picks a silhouette envelope (dome / cascade / wild, see `silhouettePresets.ts`) and places each bloom instance with jittered radial sampling, biased by each species' `layerBias` (back/mid/front) and spaced by `footprintRadius` — both declared per-species in `src/content/flowers.json`, so the algorithm never hardcodes assumptions about which or how many species exist. Swapping greenery re-derives from a *separate* sub-seed (`arrangementSeed XOR constant`), so it never reshuffles the blooms; only "Try a New Arrangement" (a fresh `arrangementSeed`) does.

Every `Placement` carries its own `footprintRadius`, and `renderPlacements.ts` sizes the rendered art directly from that number (`FOOTPRINT_TO_RENDER_SIZE`) rather than a fixed size — collision spacing and actual render size are the same number by construction, which is what keeps blooms from rendering larger than the room they were spaced for. The silhouette presets deliberately keep the fan angle within roughly ±20° of vertical (not full horizontal spread) so the whole arrangement stays inside a wrap/vase graphic's opening at any seed.

`src/builder/composition/composePresentedBouquet.ts` is the single source of truth for "what does this bouquet actually look like" — it layers wrap/vase, blooms, and ribbon into one SVG body. Wrap/vase art is authored on a shared 320x320 viewBox with a known anchor point (a wrap's neck, or a vase's rim) that this module maps onto the layout's `CENTER`; ribbon art anchors at its knot the same way. The Arrange step, Send step, keepsake image export, and the recipient reveal page all render through this (or the closely related `renderPlacements.ts`), so they can't visually drift from each other. There are no drawn stems — flowers only.

## State portability (the URL-encodable design)
`BouquetState` is designed to be fully serializable on its own — `src/builder/state/encode.ts`/`decode.ts` compress it into a URL-safe token (`lz-string`), which is what lets an in-progress build restore itself from `/build#state=<token>` alone, no backend involved.

## The one backend endpoint
At Send, the *same* `BouquetState` object is POSTed to `src/pages/api/links.ts`, which generates a short id and stores `{ id, state, createdAt }` via `src/lib/kv.ts`. `src/pages/api/links/[id].ts` is the only other endpoint — a plain read. There's no auth, no update, no delete, and no view-tracking, matching the product decision that a sent bouquet is immutable and viewable unlimited times.

**`src/lib/kv.ts` ships with an in-memory store** so the app runs with zero external provisioning locally. This does **not persist across serverless cold starts or dev-server restarts** — before a real launch, swap `getKv()`'s implementation for `@vercel/kv` (if deploying to Vercel) or Netlify Blobs (if deploying to Netlify). Nothing else in the app touches storage directly, so this is a one-file change.

## Recipient reveal
`src/pages/r/[id].astro` fetches the stored state server-side, embeds it as a `<script type="application/json" is:inline>` payload, and a client script calls `mountReveal()` (`src/builder/reveal/revealAnimation.ts`). On mount, a typed intro line ("Someone sent you something…") plays automatically before anything else is shown — the page deliberately has no static heading above it that would spoil that beat. Once the intro finishes, the existing single "Tap to Open" gate appears (agency + reduced-motion friendly, not autoplay). On tap: ribbon untie (animates `data-bow-part`-tagged elements in the ribbon SVG, see `docs/flower-art-guide.md`) → wrap settle (the pre-existing whole-SVG wiggle, now timed to play after the untie) → blooms open layer by layer (back → mid → front, via each placement's `data-layer`) → card slides in last. The same `mountReveal` powers the Send step's "Preview the Reveal" button, so the preview can never diverge from the real recipient experience — including the "mood" background (see below), which is applied where `mountReveal` is mounted rather than baked into it.

**"Mood"**: the sender's Color Theme choice (`presentation.theme`) also sets a subtle background tint on the reveal page specifically, via that theme's `paper` field (declared in `presentation.json`, previously unused). Implemented server-side in `r/[id].astro` as a CSS custom property + radial-gradient rule, scoped to that one page on purpose — it does not affect `/build` or `/`.

**Floriography**: `src/content/floriography.json` (`{id, meaning}`, separate from `flowers.json`) is shown via `src/builder/floriography/tooltip.ts`, a single shared hover/tap tooltip controller used both by the Pick step's per-flower ⓘ button and by hovering an opened bloom on the reveal page (matched to species via each placement's `data-asset-id`, added in `renderPlacements.ts` since the existing `data-id` can't be losslessly parsed back into a species id).

**Card themes**: `card.theme` (id into `src/content/cardThemes.json`) picks the card panel's own paper/border look — Classic Cream, Torn Vintage, Midnight — applied via the shared `.card-surface` class (`src/styles/components/cardThemes.css`) in both the Write step's live preview and the reveal's card slot. Added without a `SCHEMA_VERSION` bump; see `docs/state-schema.md` for why that was safe here.

## Brand logo assets
`public/logo/everbloom-stamp.png`, `public/favicon.png`, and `public/apple-touch-icon.png` are all derived from `assets/brand assets/everbloom.png` (the real logo, flat lavender background, no alpha) by `tools/process-logo.mjs` (`npm run process-logo`). It flood-fills only the background *connected to the image edges* rather than keying out every lavender-colored pixel, since the stamp's own interior is a near-identical color — a naive global color-key would erase the inside of the stamp too. Re-run it any time the source logo file changes.

## Deploy target
Configured for Vercel (`astro.config.mjs` uses `@astrojs/vercel`, `output: 'server'`). To deploy to Netlify instead, swap the adapter for `@astrojs/netlify` and swap the KV implementation as noted above — routing and everything else is host-agnostic.
