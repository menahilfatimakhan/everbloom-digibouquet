import type { BouquetStore } from '../state/bouquetState';
import { MAX_BLOOMS, MIN_BLOOMS, isBloomCountValid, totalBloomCount } from '../state/schema';
import { FLOWER_BY_ID, MEANING_BY_ID, OCCASIONS } from '../assetRegistry';
import { attachHoverPop, popIn, shake, tweenNumber } from '../animation/microInteractions';
import { attachFloriographyTooltip } from '../floriography/tooltip';

export function initPickBlooms(store: BouquetStore, root: HTMLElement) {
  const gridQuery = root.querySelector<HTMLElement>('[data-flower-grid]');
  const chipsQuery = root.querySelector<HTMLElement>('[data-tally-chips]');
  const countQuery = root.querySelector<HTMLElement>('[data-tally-count]');
  const nextBtnQuery = root.querySelector<HTMLButtonElement>('[data-next]');
  if (!gridQuery || !chipsQuery || !countQuery || !nextBtnQuery) return;
  // Re-bound as fresh, non-nullable consts: TS narrowing from the guard
  // above doesn't cross into the render() closure defined below.
  const grid = gridQuery;
  const chipsContainer = chipsQuery;
  const countEl = countQuery;
  const nextBtn = nextBtnQuery;

  let lastCount = 0;
  const renderedSpecies = new Set<string>();

  countEl.innerHTML = `<span data-count-number>0</span> of ${MIN_BLOOMS}–${MAX_BLOOMS} blooms selected`;
  const countNumberEl = countEl.querySelector<HTMLElement>('[data-count-number]')!;

  grid.querySelectorAll<HTMLElement>('.flower-card').forEach((card) => {
    const species = card.dataset.species;
    const addBtn = card.querySelector<HTMLElement>('.flower-card__add');
    const infoBtn = card.querySelector<HTMLElement>('.flower-card__info');
    if (!species || !addBtn) return;

    attachHoverPop(addBtn, 1.05);
    addBtn.addEventListener('click', () => {
      if (totalBloomCount({ blooms: store.getState().blooms }) >= MAX_BLOOMS) {
        shake(card);
        return;
      }
      store.addBloom(species);
    });

    // Two independent sibling controls on purpose: "add this flower" and
    // "show its meaning" must never be able to trigger each other.
    if (infoBtn) {
      const meaning = MEANING_BY_ID[species];
      if (meaning) attachFloriographyTooltip(infoBtn, meaning);
    }
  });

  root.querySelectorAll<HTMLElement>('.occasion-chip').forEach((chip) => {
    attachHoverPop(chip, 1.04);
    chip.addEventListener('click', () => {
      const occasionId = chip.dataset.occasion;
      const occasion = OCCASIONS.find((o) => o.id === occasionId);
      if (!occasion) return;
      store.applyOccasion(
        occasion.id,
        occasion.suggestedBlooms,
        occasion.suggestedTheme,
        occasion.suggestedCardMessage
      );
      root.querySelectorAll('.occasion-chip').forEach((c) => c.removeAttribute('data-active'));
      chip.setAttribute('data-active', 'true');
    });
  });

  function render() {
    const state = store.getState();

    grid.querySelectorAll<HTMLElement>('.flower-card').forEach((card) => {
      const species = card.dataset.species!;
      const qty = store.speciesQty(species);
      const badge = card.querySelector<HTMLElement>('[data-qty-badge]');
      if (badge) {
        badge.hidden = qty === 0;
        badge.textContent = String(qty);
      }
      card.dataset.selected = String(qty > 0);
    });

    chipsContainer.innerHTML = '';
    const currentSpecies = new Set(state.blooms.map((b) => b.species));
    for (const bloom of state.blooms) {
      const flower = FLOWER_BY_ID[bloom.species];
      if (!flower) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tally-chip';
      chip.textContent = `${flower.name.toUpperCase()} ×${bloom.qty}`;
      chip.setAttribute('aria-label', `Remove all ${flower.name}`);
      chip.addEventListener('click', () => store.removeSpecies(bloom.species));
      chipsContainer.appendChild(chip);
      if (!renderedSpecies.has(bloom.species)) popIn(chip);
    }
    renderedSpecies.clear();
    currentSpecies.forEach((s) => renderedSpecies.add(s));

    const total = totalBloomCount(state);
    if (total !== lastCount) {
      tweenNumber(countNumberEl, lastCount, total);
      lastCount = total;
    }

    nextBtn.disabled = !isBloomCountValid(state);
  }

  store.subscribe(render);
  render();
}
