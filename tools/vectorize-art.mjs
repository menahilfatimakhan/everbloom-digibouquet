#!/usr/bin/env node
// Vectorizes the raster flower/greenery art in assets/Flowers&Leaves/ into the
// inline SVG the bouquet compositor needs.
//
// Why vectorize at all, when the sources are already finished artwork? Because
// renderPlacements.ts inlines a species' *entire* SVG string once per placement
// — a 10-bloom bouquet duplicates it 10 times, and that markup is rebuilt on
// every drag in the Arrange step. Base64-embedding a raster would put megabytes
// through that loop. Traced paths stay in the same size class as the art they
// replace (see SIZE BUDGET below).
//
// Pipeline per source PNG:
//   1. sharp: trim the transparent margin, square the canvas, pad back out so
//      the drawn shape occupies ~FILL_RATIO of the box (matching the
//      "visual radius ~85% of half-width" convention renderPlacements.ts sizes
//      against), downscale to TRACE_PX.
//   2. Flatten onto a sentinel color that does not occur in the art, so the
//      tracer emits one flat background shape we can identify and drop —
//      vtracer clusters transparent pixels rather than skipping them, so
//      tracing RGBA directly leaves a filled rectangle behind the flower.
//   3. vtracer -> stacked color splines.
//   4. Normalize for the compositor: drop the sentinel path, strip width/height
//      off the root (renderPlacements injects its own), namespace any ids, and
//      add role/aria-label.
//
// Usage: node tools/vectorize-art.mjs [--only=rose,peony] [--trace-px=700]

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { vectorize, ColorMode, Hierarchical, PathSimplifyMode } from '@neplex/vectorizer';
import { checkerMask, contentBounds } from './lib/dechecker.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(root, 'assets', 'Flowers&Leaves');

// Source basename -> { id, dir }. "Daisy" maps onto the existing
// "gerbera-daisy" id so occasions.json / floriography.json keep resolving.
// Lotus and Zinnia are new species; the leaf set replaces greenery art whose
// ids are already referenced by greenery.json.
const TARGETS = {
  Rose: { id: 'rose', kind: 'flowers' },
  Peony: { id: 'peony', kind: 'flowers' },
  Carnation: { id: 'carnation', kind: 'flowers' },
  Sunflower: { id: 'sunflower', kind: 'flowers' },
  Daisy: { id: 'gerbera-daisy', kind: 'flowers' },
  Tulip: { id: 'tulip', kind: 'flowers' },
  Lily: { id: 'lily', kind: 'flowers' },
  Orchid: { id: 'orchid', kind: 'flowers' },
  Delphinium: { id: 'delphinium', kind: 'flowers' },
  Lotus: { id: 'lotus', kind: 'flowers' },
  Zinnia: { id: 'zinnia', kind: 'flowers' },
  // The generator never renamed this one; it's the purple anemone, which is
  // also the species whose hand-drawn art was dropped in the previous commit.
  Gemini_Generated_Image_e9bxj6e9bxj6e9bx: { id: 'anemone', kind: 'flowers' },
  Eucalyptus: { id: 'eucalyptus', kind: 'greenery' },
  Fern: { id: 'fern', kind: 'greenery' },
  Willow: { id: 'willow', kind: 'greenery' },
  Leafy: { id: 'leafy', kind: 'greenery' },
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const TRACE_PX = Number(args['trace-px'] ?? 700);
/** Decimal places kept in path coordinates. */
const PRECISION = Number(args.precision ?? 0);
// Fraction of the output box the drawn art should span. renderPlacements.ts
// converts a placement's footprintRadius into a render size assuming the art
// fills ~85% of its viewBox; trimming to the content bounds alone would fill
// 100% and render every bloom ~18% oversized against the spacing the layout
// engine reserved for it.
const FILL_RATIO = 0.85;
// Sentinel background. Chosen outside the art's gamut (no pure-saturated
// magenta in watercolor botanicals) so step 4 can drop it unambiguously.
const SENTINEL = { r: 255, g: 0, b: 255 };
const SENTINEL_HEX = '#ff00ff';

const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;

/** vtracer settings. Tuned for watercolor-wash + fine-ink-line botanicals:
 * filterSpeckle stays low so the ink linework survives (it reads as many small
 * dark clusters), while layerDifference stays high enough that the soft washes
 * collapse into a handful of layers instead of a gradient ramp of hundreds. */
const TRACE_OPTS = {
  colorMode: ColorMode?.Color ?? 0,
  // Cutout, not Stacked. Under Stacked each layer also covers everything
  // painted above it, so the bottom layer spans the whole canvas — dropping
  // the sentinel background then exposes the *next* layer at full-canvas size,
  // which rendered the carnation as a solid maroon square. Cutout emits
  // disjoint regions, so removing the background leaves exactly the art.
  hierarchical: Hierarchical?.Cutout ?? 1,
  mode: PathSimplifyMode?.Spline ?? 2,
  // filterSpeckle/layerDifference are the size dials. The traced set is inlined
  // in full on the picker page (one card per species), so detail that survives
  // no further than a 120px thumbnail is pure payload: at 12 the set came to
  // ~620 KB gzipped, at 28 it's ~400 KB with no visible loss — the sunflower's
  // seed texture alone accounted for hundreds of sub-pixel paths.
  filterSpeckle: Number(args['filter-speckle'] ?? 28),
  colorPrecision: Number(args['color-precision'] ?? 5),
  layerDifference: Number(args['layer-difference'] ?? 44),
  cornerThreshold: 60,
  lengthThreshold: 5,
  maxIterations: 10,
  spliceThreshold: 45,
};

/** Replaces the painted-in checkerboard with the sentinel, crops to the art,
 * squares + pads it so the drawn shape spans FILL_RATIO of the box, then
 * downsamples to trace resolution.
 *
 * The compositing and the resize are deliberately two separate sharp calls:
 * sharp applies resize *before* composite regardless of chain order, so doing
 * both in one pipeline shrinks the canvas first and then fails to composite
 * the full-size art onto it. */
async function prepare(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Background becomes genuinely transparent rather than sentinel-colored, so
  // the downsample below blends art against alpha instead of against magenta —
  // flattening first leaves a bright magenta fringe traced right around the
  // bloom's outline.
  const mask = checkerMask(data, width, height, 2);
  const rgba = Buffer.from(data);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) rgba[i * 4 + 3] = 0;
  }

  const bounds = contentBounds(mask, width, height);
  const side = Math.max(bounds.width, bounds.height);
  const box = Math.round(side / FILL_RATIO);

  const cropped = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract(bounds)
    .png()
    .toBuffer();

  const padded = await sharp({
    create: { width: box, height: box, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: cropped,
        left: Math.round((box - bounds.width) / 2),
        top: Math.round((box - bounds.height) / 2),
      },
    ])
    .png()
    .toBuffer();

  const small = await sharp(padded)
    .resize(TRACE_PX, TRACE_PX, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Hard-threshold the resampled alpha before handing the tracer a flat
  // image. A soft alpha ramp would flatten into a gradient of part-magenta
  // pixels, which trace as their own pale ring; snapping to in/out keeps the
  // sentinel a single flat region the normalize step can drop cleanly.
  const px = small.data;
  for (let i = 0; i < small.info.width * small.info.height; i++) {
    const p = i * 4;
    if (px[p + 3] < 128) {
      px[p] = SENTINEL.r;
      px[p + 1] = SENTINEL.g;
      px[p + 2] = SENTINEL.b;
    }
    px[p + 3] = 255;
  }

  return sharp(px, { raw: { width: small.info.width, height: small.info.height, channels: 4 } })
    .png()
    .toBuffer();
}

function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** The sentinel itself, after the tracer's color quantization (#FE00FE and
 * the near-pure variants next to it). */
function isPureSentinel(hex) {
  const [r, g, b] = rgb(hex);
  return r - g > 150 && b - g > 150;
}

/** How magenta a color is: red and blue close together with green well below
 * both. A rose pink keeps red clearly ahead of blue and a delphinium violet
 * keeps blue ahead of red, so neither scores; only the sentinel and the shades
 * the tracer blends toward it do. */
function magentaScore(hex) {
  const [r, g, b] = rgb(hex);
  if (Math.abs(r - b) > 30) return -1;
  return Math.min(r, b) - g;
}

/** Measured across the whole traced set, the most magenta color belonging to
 * actual artwork is the orchid's #813964 at 43; the fringe left around the
 * fern and willow scores 140. Anything past this threshold is sentinel bleed
 * and is dropped on sight. */
const FRINGE_CERTAIN = 60;

/** Below that, the call is genuinely ambiguous — a pale mauve could be either.
 * Those are dropped only when they're also small, since fringe artifacts are
 * specks and petals are not. */
const FRINGE_MAYBE = 45;

/** Rough bounding box of a path, from its coordinate pairs. vtracer emits only
 * absolute M/C/Z commands, so the numbers alternate x,y. */
function pathExtent(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** Rounds every number in a path's `d`. vtracer emits full float precision
 * ("12.678795363509948"), which is the single largest contributor to file size
 * and is orders of magnitude finer than one device pixel at the ~100-200px
 * these blooms actually render at. */
function roundPathData(d, precision) {
  const f = 10 ** precision;
  return d.replace(/-?\d+(?:\.\d+)?/g, (n) => String(Math.round(Number(n) * f) / f));
}

/** Drops sentinel-filled paths, shrinks coordinate precision, strips the
 * root's width/height, namespaces ids so two species composed into one
 * document can't collide on url(#...) refs, and labels the root. */
function normalize(svg, id) {
  let out = svg;
  let dropped = 0;

  out = out.replace(/<path\b[^>]*\/>\s*/g, (tag) => {
    const fill = /fill="(#[0-9a-fA-F]{6})"/.exec(tag)?.[1];
    const d = /d="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (fill) {
      const magenta = magentaScore(fill);
      const isFringe =
        isPureSentinel(fill) ||
        magenta >= FRINGE_CERTAIN ||
        (magenta >= FRINGE_MAYBE && pathExtent(d) < TRACE_PX * 0.12);
      if (isFringe) {
        dropped++;
        return '';
      }
    }
    // Every path carries an identity transform; it costs bytes and does nothing.
    return tag
      .replace(/\s*transform="translate\(0,0\)"/, '')
      .replace(/d="([^"]*)"/, (_, d) => `d="${roundPathData(d, PRECISION)}"`);
  });

  if (!dropped) {
    console.warn(`  ! ${id}: no sentinel path found — background may be baked in`);
  }

  // Namespace any generated ids (defs/gradients) per species.
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const rawId of new Set(ids)) {
    const scoped = `${rawId}-${id}`;
    out = out
      .replaceAll(`id="${rawId}"`, `id="${scoped}"`)
      .replaceAll(`url(#${rawId})`, `url(#${scoped})`);
  }

  // The tracer emits an XML prolog and a generator comment ahead of the root.
  // Both have to go: the art is inlined into a larger document, where a
  // prolog is invalid, and an anchored /^<svg/ match would silently skip the
  // rewrite below — which is how these shipped once with no viewBox at all.
  out = out.replace(/^\s*<\?xml[^>]*\?>\s*/, '').replace(/^\s*<!--[\s\S]*?-->\s*/, '');

  // renderPlacements.ts injects x/y/width/height when it references the art,
  // so the traced width/height must come off — but their values are the only
  // record of the coordinate system, so they become the viewBox.
  out = out.replace(/<svg\b[^>]*>/, (tag) => {
    const w = /\swidth="(\d+)"/.exec(tag)?.[1];
    const h = /\sheight="(\d+)"/.exec(tag)?.[1];
    let next = tag.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/viewBox=/.test(next) && w && h) {
      next = next.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
    }
    if (!/xmlns=/.test(next)) next = next.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return next.replace('<svg', `<svg role="img" aria-label="${id.replace(/-/g, ' ')}"`);
  });

  if (!/viewBox=/.test(out)) {
    throw new Error(`${id}: traced output has no viewBox — it would render clipped`);
  }

  return out.trim();
}

const entries = Object.entries(TARGETS).filter(([name]) => !only || only.has(name.toLowerCase()));
let totalBytes = 0;

for (const [name, { id, kind }] of entries) {
  const srcPath = path.join(srcDir, `${name}.png`);
  try {
    statSync(srcPath);
  } catch {
    console.warn(`- ${name}.png missing, skipped`);
    continue;
  }

  const prepared = await prepare(srcPath);
  const traced = await vectorize(prepared, TRACE_OPTS);
  const svg = normalize(traced, id);

  const outDir = path.join(root, 'src', 'assets', 'svg', kind);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${id}.svg`);
  writeFileSync(outPath, svg);

  const kb = Buffer.byteLength(svg) / 1024;
  totalBytes += Buffer.byteLength(svg);
  const paths = (svg.match(/<path/g) || []).length;
  console.log(`✓ ${name.padEnd(12)} -> ${kind}/${id}.svg  ${kb.toFixed(1)} KB  ${paths} paths`);
}

console.log(`\nTotal: ${(totalBytes / 1024).toFixed(1)} KB across ${entries.length} files`);
