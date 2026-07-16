import type { BouquetStore } from '../state/bouquetState';
import { composeLayout, flattenForRender } from '../composition/layoutEngine';
import { placementsToSvgBody } from '../composition/renderPlacements';
import { FLOWER_META, FLOWER_SVGS, GREENERY, GREENERY_SVGS, flowerCssVars, greeneryCssVars } from '../assetRegistry';
import { attachHoverPop } from '../animation/microInteractions';
import { staggerGrowIn } from '../animation/transitions';

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

  function render() {
    const state = store.getState();
    const layout = composeLayout(state, FLOWER_META);
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
