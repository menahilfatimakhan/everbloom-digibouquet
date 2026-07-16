import type { Placement } from './layoutEngine';

/** Flower/greenery art is authored on a 160x160 viewBox where the drawn
 * shape's visual radius is roughly 85% of the half-width (~68 units). This
 * factor converts a placement's `footprintRadius` (the spacing the layout
 * engine actually reserved for it) into the art's render size, so a bloom
 * never renders larger than the room it was spaced for — the earlier fixed
 * render size regardless of footprint was what made arrangements look like
 * an overlapping tangle. */
const FOOTPRINT_TO_RENDER_SIZE = 2.35;

/** Injects x/y/width/height onto a raw <svg ...> root so it can be nested
 * inside a parent <svg> as a self-contained, independently-viewBoxed unit. */
function positionSvgRoot(raw: string, size: number): string {
  const half = size / 2;
  return raw.replace(
    '<svg ',
    `<svg x="${-half}" y="${-half}" width="${size}" height="${size}" overflow="visible" `
  );
}

export interface RenderableCssVars {
  [customProperty: string]: string;
}

/** Turns one Placement into a positioned, rotated, scaled, themeable <g> —
 * pure string building, so it runs identically on the server (landing-page
 * showcase) and in the browser (Arrange step). */
export function placementToGroup(placement: Placement, rawSvg: string, vars: RenderableCssVars): string {
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
  const size = placement.footprintRadius * FOOTPRINT_TO_RENDER_SIZE;
  const nested = positionSvgRoot(rawSvg, size);
  return `<g class="placement placement--${placement.kind}" data-id="${placement.id}" data-layer="${placement.layer}" style="${styleAttr}" transform="translate(${placement.x.toFixed(2)},${placement.y.toFixed(2)}) rotate(${placement.rotation.toFixed(2)}) scale(${placement.scale.toFixed(3)})">${nested}</g>`;
}

export function placementsToSvgBody(
  placements: Placement[],
  getRawSvg: (placement: Placement) => string,
  getVars: (placement: Placement) => RenderableCssVars
): string {
  return placements.map((p) => placementToGroup(p, getRawSvg(p), getVars(p))).join('');
}
