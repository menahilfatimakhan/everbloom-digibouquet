import type { Placement } from './layoutEngine';

/** Flower/greenery art is authored on a square viewBox where the drawn shape's
 * visual radius is roughly 85% of the half-width. This factor converts a
 * placement's `footprintRadius` (the spacing the layout engine actually
 * reserved for it) into the art's render size, so a bloom never renders larger
 * than the room it was spaced for — the earlier fixed render size regardless
 * of footprint was what made arrangements look like an overlapping tangle. */
export const FOOTPRINT_TO_RENDER_SIZE = 2.35;

export interface RenderableCssVars {
  [customProperty: string]: string;
}

/** Stable, collision-proof id for a species' art within the composed document. */
function symbolId(kind: string, assetId: string): string {
  return `art-${kind}-${assetId}`;
}

/** Rewraps a standalone art file as a reusable <symbol>. The source's viewBox
 * is carried over so <use>'s width/height scales the art exactly as nesting
 * the original <svg> did. */
function toSymbol(raw: string, id: string): string {
  const rootMatch = /^[\s\S]*?<svg\b([^>]*)>/.exec(raw);
  if (!rootMatch) return '';
  const attrs = rootMatch[1];
  const viewBox = /viewBox="([^"]*)"/.exec(attrs)?.[1] ?? '0 0 200 200';
  const inner = raw.slice(rootMatch[0].length).replace(/<\/svg>\s*$/, '');
  return `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
}

/** Turns one Placement into a positioned, rotated, scaled, themeable <g> —
 * pure string building, so it runs identically on the server (landing-page
 * showcase) and in the browser (Arrange step).
 *
 * The art itself is referenced rather than inlined. CSS custom properties set
 * here still reach it: they inherit into the <use> shadow content, which is
 * what keeps the var-driven greenery and presentation art themeable. */
function placementToUse(placement: Placement, id: string, vars: RenderableCssVars): string {
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
  const size = placement.footprintRadius * FOOTPRINT_TO_RENDER_SIZE;
  const half = size / 2;
  let art = `<use href="#${id}" x="${-half}" y="${-half}" width="${size}" height="${size}"/>`;
  // Nested in its own <g> rather than folded into the placement's transform
  // below: GSAP animates .placement and rewrites that attribute as a matrix,
  // which drops a non-uniform scale and shifts the element off its anchor.
  if (placement.widthScale && placement.widthScale !== 1) {
    art = `<g transform="scale(${placement.widthScale.toFixed(3)},1)">${art}</g>`;
  }
  return `<g class="placement placement--${placement.kind}" data-id="${placement.id}" data-asset-id="${placement.assetId}" data-layer="${placement.layer}" style="${styleAttr}" transform="translate(${placement.x.toFixed(2)},${placement.y.toFixed(2)}) rotate(${placement.rotation.toFixed(2)}) scale(${placement.scale.toFixed(3)})">${art}</g>`;
}

/**
 * Builds the bloom/greenery layer: a <defs> carrying one <symbol> per distinct
 * species, followed by one <g><use/></g> per placement.
 *
 * Inlining each placement's full art was affordable when the art was small
 * procedural shapes, but the traced watercolor set is ~120 KB per species —
 * duplicated across a ten-bloom bouquet that is over a megabyte of markup, and
 * the Arrange step rebuilds this string on every pointer move while dragging.
 * Referencing shared symbols makes the cost per placement a single short tag
 * regardless of how detailed the art is.
 */
export function placementsToSvgBody(
  placements: Placement[],
  getRawSvg: (placement: Placement) => string,
  getVars: (placement: Placement) => RenderableCssVars
): string {
  const symbols = new Map<string, string>();
  const body: string[] = [];

  for (const placement of placements) {
    const id = symbolId(placement.kind, placement.assetId);
    if (!symbols.has(id)) {
      const raw = getRawSvg(placement);
      if (!raw) continue;
      symbols.set(id, toSymbol(raw, id));
    }
    body.push(placementToUse(placement, id, getVars(placement)));
  }

  if (!symbols.size) return '';
  return `<defs>${[...symbols.values()].join('')}</defs>${body.join('')}`;
}
