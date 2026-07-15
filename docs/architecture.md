# Architecture

## Stack
Astro (server output) + framework-free TypeScript for the interactive builder + GSAP/Lenis for animation. No client-side UI framework — `.astro` files are close to plain HTML, and `src/builder/*` is plain DOM-manipulating TypeScript with a hand-rolled store (see `src/builder/state/bouquetState.ts`), chosen so the codebase stays readable without React/Svelte/Vue knowledge.

## The four-step builder
`src/pages/build.astro` server-renders all four step `<section>`s (Pick, Arrange, Write, Send) from the content JSON in `src/content/`. `src/builder/index.ts` is the client-side entry point: it creates a `BouquetStore`, wires each step's `init*` function (`src/builder/steps/*.ts`), and owns step navigation (`Next`/`Back`, the `StepProgress` indicator, GSAP transitions between steps).

State lives in one plain object (`BouquetState`, see `src/builder/state/schema.ts`) with explicit named mutators (`addBloom`, `setGreenery`, `setCard`, ...) and a tiny pub/sub — every step subscribes and re-renders its own DOM on change. There is no cross-step framework wiring; steps only interact through the shared store.

## Bouquet composition
`src/builder/composition/layoutEngine.ts` turns a `BouquetState` into concrete flower/greenery positions: a seeded PRNG (`arrangementSeed`) picks a silhouette envelope (dome / cascade / wild) and places each bloom instance with jittered radial sampling, biased by each species' `layerBias` (back/mid/front) and spaced by `footprintRadius` — both declared per-species in `src/content/flowers.json`, so the algorithm never hardcodes assumptions about which or how many species exist. Swapping greenery re-derives from a *separate* sub-seed (`arrangementSeed XOR constant`), so it never reshuffles the blooms; only "Try a New Arrangement" (a fresh `arrangementSeed`) does.

`src/builder/composition/composePresentedBouquet.ts` is the single source of truth for "what does this bouquet actually look like" — it layers stems, wrap/vase, blooms, and ribbon into one SVG body. The Arrange step, Send step, keepsake image export, and the recipient reveal page all render through this (or the closely related `renderPlacements.ts`), so they can't visually drift from each other.

## State portability (the URL-encodable design)
`BouquetState` is designed to be fully serializable on its own — `src/builder/state/encode.ts`/`decode.ts` compress it into a URL-safe token (`lz-string`), which is what lets an in-progress build restore itself from `/build#state=<token>` alone, no backend involved.

## The one backend endpoint
At Send, the *same* `BouquetState` object is POSTed to `src/pages/api/links.ts`, which generates a short id and stores `{ id, state, createdAt }` via `src/lib/kv.ts`. `src/pages/api/links/[id].ts` is the only other endpoint — a plain read. There's no auth, no update, no delete, and no view-tracking, matching the product decision that a sent bouquet is immutable and viewable unlimited times.

**`src/lib/kv.ts` ships with an in-memory store** so the app runs with zero external provisioning locally. This does **not persist across serverless cold starts or dev-server restarts** — before a real launch, swap `getKv()`'s implementation for `@vercel/kv` (if deploying to Vercel) or Netlify Blobs (if deploying to Netlify). Nothing else in the app touches storage directly, so this is a one-file change.

## Recipient reveal
`src/pages/r/[id].astro` fetches the stored state server-side, embeds it as a `<script type="application/json" is:inline>` payload, and a client script calls `mountReveal()` (`src/builder/reveal/revealAnimation.ts`), which renders a closed/wrapped state with a "Tap to Open" affordance, then plays a GSAP timeline (unwrap → blooms scale in, staggered from center → card slides in). The same `mountReveal` powers the Send step's "Preview the Reveal" button, so the preview can never diverge from the real recipient experience.

## Deploy target
Configured for Vercel (`astro.config.mjs` uses `@astrojs/vercel`, `output: 'server'`). To deploy to Netlify instead, swap the adapter for `@astrojs/netlify` and swap the KV implementation as noted above — routing and everything else is host-agnostic.
