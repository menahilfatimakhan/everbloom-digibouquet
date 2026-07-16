import type { BouquetStore } from '../state/bouquetState';
import { composeLayout, flattenForRender, type Placement } from '../composition/layoutEngine';
import { placementsToSvgBody } from '../composition/renderPlacements';
import { FLOWER_META, FLOWER_SVGS, GREENERY, GREENERY_SVGS, flowerCssVars, greeneryCssVars } from '../assetRegistry';
import { attachHoverPop } from '../animation/microInteractions';
import { staggerGrowIn } from '../animation/transitions';

/** Converts a pointer event's screen coordinates into the SVG's own
 * viewBox-space coordinates, accounting for however the browser is currently
 * scaling/positioning the element — the robust way to do this conversion,
 * unlike a manual bounding-box ratio which drifts under non-uniform scaling. */
function screenToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function initArrange(store: BouquetStore, root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-bouquet-svg]');
  const reshuffleBtn = root.querySelector<HTMLButtonElement>('[data-reshuffle]');
  const greeneryBtn = root.querySelector<HTMLButtonElement>('[data-change-greenery]');
  if (!svg || !reshuffleBtn || !greeneryBtn) return;

  attachHoverPop(reshuffleBtn, 1.04);
  attachHoverPop(greeneryBtn, 1.04);

  reshuffleBtn.addEventListener('click', () => store.reshuffleArrangement());
  greeneryBtn.addEventListener('click', () => {
    const ids = GREENERY.map((g) => g.id);
    const current = store.getState().greenery ?? ids[0];
    const idx = ids.indexOf(current);
    store.setGreenery(ids[(idx + 1) % ids.length]);
  });

  let latestBlooms: Placement[] = [];
  let drag: { id: string; rotation: number; scale: number; startPoint: { x: number; y: number }; originX: number; originY: number } | null = null;

  svg.addEventListener('pointerdown', (event) => {
    const target = (event.target as Element).closest<SVGGElement>('.placement--bloom');
    if (!target) return;
    const id = target.dataset.id;
    const placement = latestBlooms.find((p) => p.id === id);
    if (!id || !placement) return;
    target.setPointerCapture(event.pointerId);
    drag = {
      id,
      rotation: placement.rotation,
      scale: placement.scale,
      startPoint: screenToSvgPoint(svg, event.clientX, event.clientY),
      originX: placement.x,
      originY: placement.y,
    };
  });

  svg.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const target = (event.target as Element).closest<SVGGElement>('.placement--bloom');
    const el = target?.dataset.id === drag.id ? target : svg.querySelector<SVGGElement>(`[data-id="${drag.id}"]`);
    if (!el) return;
    const point = screenToSvgPoint(svg, event.clientX, event.clientY);
    const x = drag.originX + (point.x - drag.startPoint.x);
    const y = drag.originY + (point.y - drag.startPoint.y);
    el.setAttribute(
      'transform',
      `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${drag.rotation.toFixed(2)}) scale(${drag.scale.toFixed(3)})`
    );
  });

  function endDrag(event: PointerEvent) {
    if (!drag) return;
    const point = screenToSvgPoint(svg!, event.clientX, event.clientY);
    const x = drag.originX + (point.x - drag.startPoint.x);
    const y = drag.originY + (point.y - drag.startPoint.y);
    store.setArrangementOverride(drag.id, { x, y });
    drag = null;
  }

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  function render() {
    const state = store.getState();
    const layout = composeLayout(state, FLOWER_META);
    latestBlooms = layout.blooms;
    svg!.setAttribute('viewBox', layout.viewBox);
    const placements = flattenForRender(layout);
    svg!.innerHTML = placementsToSvgBody(
      placements,
      (p) => (p.kind === 'bloom' ? FLOWER_SVGS[p.assetId] : GREENERY_SVGS[p.assetId]),
      (p) => (p.kind === 'bloom' ? flowerCssVars(p.assetId) : greeneryCssVars(p.assetId))
    );
    staggerGrowIn(svg!.querySelectorAll('.placement'));
  }

  store.subscribe(render);
  render();
}
