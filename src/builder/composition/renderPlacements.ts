import type { Placement } from './layoutEngine';

const NATIVE_SIZE = 160;

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
  const nested = positionSvgRoot(rawSvg, NATIVE_SIZE);
  return `<g class="placement placement--${placement.kind}" data-id="${placement.id}" data-layer="${placement.layer}" style="${styleAttr}" transform="translate(${placement.x.toFixed(2)},${placement.y.toFixed(2)}) rotate(${placement.rotation.toFixed(2)}) scale(${placement.scale.toFixed(3)})">${nested}</g>`;
}

export function placementsToSvgBody(
  placements: Placement[],
  getRawSvg: (placement: Placement) => string,
  getVars: (placement: Placement) => RenderableCssVars
): string {
  return placements.map((p) => placementToGroup(p, getRawSvg(p), getVars(p))).join('');
}
