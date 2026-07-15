# Everbloom Digibouquet

A digital bouquet builder for Everbloom by Meena ([@everbloombymeena](https://www.instagram.com/everbloombymeena/)). Visitors pick 6-10 blooms, watch them arrange into a composed bouquet, write a card, and send it as a link — the recipient opens an animated reveal.

Built with [Astro](https://astro.build), framework-free TypeScript for the interactive builder, and [GSAP](https://gsap.com)/[Lenis](https://lenis.darkroom.engineering) for animation. Deploys as a mostly-static site with one narrow serverless endpoint (short share links). See `docs/architecture.md` for the full design.

## Getting started

```bash
npm install
npm run dev
```

Visit http://localhost:4321. The four-step builder is at `/build`; a sent bouquet's recipient page is `/r/<id>`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (outputs a Vercel-ready `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Astro/TypeScript diagnostics |
| `npm test` | Unit tests (Vitest) — layout engine, state encode/decode, store mutators |
| `npm run test:e2e` | End-to-end tests (Playwright) — full builder flow, share-link roundtrip, mobile viewport |
| `npm run new-flower -- <id> "<Name>" "<meaning>"` | Scaffolds a new flower species (starter SVG + content entry) |

## Editing content (no code required)
Flower roster, greenery, presentation options, occasion presets, and card fonts are all plain JSON in `src/content/`. See `docs/content-editing-guide.md`.

## Swapping in real flower art
The shipped art is original hand-authored SVG (vector line-art in the brand's purple ink). It's built so real illustrated art can drop in later without touching any code — see `docs/flower-art-guide.md`.

## Deploying
Configured for Vercel by default (`@astrojs/vercel` adapter). Push to a repo connected to Vercel, or run `npx vercel`. **Before a real launch**, swap the in-memory share-link store in `src/lib/kv.ts` for `@vercel/kv` (or Netlify Blobs, if deploying to Netlify instead) — it currently doesn't persist across serverless cold starts. Details in `docs/architecture.md`.

## Project structure
See `docs/architecture.md` for the full breakdown. Short version:
- `src/pages/` — routes: landing (`index.astro`), builder (`build.astro`), recipient reveal (`r/[id].astro`), the one API route (`api/links*.ts`)
- `src/builder/` — the interactive builder: state store, procedural bouquet composition, the four steps, animation, reveal
- `src/content/` — owner-editable data (flowers, greenery, presentation, occasions, card fonts)
- `src/assets/svg/` — the flower/greenery/presentation art
- `src/components/`, `src/styles/` — site chrome and design tokens
- `tests/` — Vitest unit tests + Playwright E2E tests
- `docs/` — architecture, state schema, content editing, flower art conventions
