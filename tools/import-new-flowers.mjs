#!/usr/bin/env node
// One-time import of the hand-illustrated flower set the user dropped into
// assets/SVGs/ (watercolor + ink style, feTurbulence filters, radialGradient
// fills — a different authoring style than src/assets/svg/flowers/'s
// rotated-<use>-ring convention). Normalizes them to fit the app's rendering
// pipeline:
//
// 1. Strips the hardcoded width/height on the root <svg> — renderPlacements.ts
//    injects its own width/height for sizing, and having both would leave two
//    conflicting attributes on one element (invalid, and the source values
//    would likely win, silently breaking footprintRadius-based sizing).
// 2. Namespaces every `id="X"` (and its `url(#X)` references) with the
//    species name. All 9 source files reuse the exact same filter ids
//    ("wc"/"ink"/"wash") — harmless within a single species (duplicates are
//    byte-identical) but a real collision once two *different* species are
//    composed into the same bouquet SVG, where the browser resolves every
//    url(#wc) etc. to whichever species' copy appears first in the document.
// 3. Tightens the viewBox around the actual drawn content (estimated from the
//    petals' `translate(x,y)` anchors + their max path length) so the fill
//    ratio roughly matches the existing hand-authored flowers' ~85%-of-half-
//    width convention — the source viewBox has far more empty margin, which
//    would otherwise render these blooms much smaller than their
//    footprintRadius reserves, undoing the footprint-to-render-size fix.
//
// Usage: node tools/import-new-flowers.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(root, 'assets', 'SVGs');
const outDir = path.join(root, 'src', 'assets', 'svg', 'flowers');

// source filename (no ext) -> output species id. "daisy" maps onto the
// existing "gerbera-daisy" id so occasions.json/floriography.json keep working.
const ID_MAP = {
  rose: 'rose',
  peony: 'peony',
  tulip: 'tulip',
  lily: 'lily',
  daisy: 'gerbera-daisy',
  sunflower: 'sunflower',
  carnation: 'carnation',
  delphinium: 'delphinium',
  orchid: 'orchid',
};

const files = readdirSync(srcDir).filter((f) => f.endsWith('.svg'));

for (const file of files) {
  const stem = path.basename(file, '.svg');
  const id = ID_MAP[stem];
  if (!id) {
    console.warn(`No id mapping for ${file}, skipping`);
    continue;
  }

  let svg = readFileSync(path.join(srcDir, file), 'utf8');

  // 1. Strip the hardcoded width/height on the root <svg ...> tag only.
  svg = svg.replace(/^(<svg\b[^>]*?)\s+width="[^"]*"\s+height="[^"]*"/, '$1');

  // 2. Namespace every id + its url(#id) references with the species name.
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const rawId of new Set(ids)) {
    const namespaced = `${rawId}-${id}`;
    svg = svg.replaceAll(`id="${rawId}"`, `id="${namespaced}"`);
    svg = svg.replaceAll(`url(#${rawId})`, `url(#${namespaced})`);
  }

  // 3. Tighten the viewBox around the actual content. Every source file also
  // carries one <ellipse> "watercolor wash" backdrop behind the petals —
  // easy to miss since it's not a translate()-positioned group like the
  // petals/stem, but it's routinely the single largest shape in the file
  // (e.g. tulip's wash spans y 44-160 against petals confined to y 78-140).
  // An earlier version of this script only looked at translate() anchors,
  // so the wash routinely got left outside the cropped viewBox — since the
  // renderer nests these with overflow:visible, that didn't clip it, it just
  // let it spill out past the size the layout engine budgeted for that
  // bloom, producing an oversized pale halo that swallowed neighboring
  // blooms. Bounding-box math below must include every shape kind that can
  // appear, not just petal groups.
  const points = [];
  for (const m of svg.matchAll(/translate\(([-\d.]+),\s*([-\d.]+)\)/g)) {
    points.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  for (const m of svg.matchAll(/<ellipse\b[^>]*\/?>/g)) {
    const tag = m[0];
    const cx = parseFloat(tag.match(/\bcx="([-\d.]+)"/)?.[1] ?? 'NaN');
    const cy = parseFloat(tag.match(/\bcy="([-\d.]+)"/)?.[1] ?? 'NaN');
    const rx = parseFloat(tag.match(/\brx="([-\d.]+)"/)?.[1] ?? 'NaN');
    const ry = parseFloat(tag.match(/\bry="([-\d.]+)"/)?.[1] ?? 'NaN');
    if ([cx, cy, rx, ry].every((n) => !Number.isNaN(n))) {
      points.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
    }
  }
  for (const m of svg.matchAll(/<circle\b[^>]*\/?>/g)) {
    const tag = m[0];
    const cx = parseFloat(tag.match(/\bcx="([-\d.]+)"/)?.[1] ?? 'NaN');
    const cy = parseFloat(tag.match(/\bcy="([-\d.]+)"/)?.[1] ?? 'NaN');
    const r = parseFloat(tag.match(/\br="([-\d.]+)"/)?.[1] ?? 'NaN');
    if ([cx, cy, r].every((n) => !Number.isNaN(n))) {
      points.push([cx - r, cy - r], [cx + r, cy + r]);
    }
  }
  if (points.length > 0) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    // Petal/floret "length" in this generated style is the path's largest
    // control-point magnitude, typically 15-36 units — pad generously
    // enough to not clip any petal tip, tight enough to matter.
    const pad = 42;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = maxX - minX;
    const h = maxY - minY;
    svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}"`);
  }

  const outPath = path.join(outDir, `${id}.svg`);
  writeFileSync(outPath, svg);
  console.log(`${file} -> src/assets/svg/flowers/${id}.svg`);
}
