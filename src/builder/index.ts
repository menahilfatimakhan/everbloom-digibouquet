import { createBouquetStore } from './state/bouquetState';
import { createInitialState, isBloomCountValid } from './state/schema';
import { decodeState } from './state/decode';
import { encodeState } from './state/encode';
import { initLenis, scrollToTop } from './animation/lenisSetup';
import { transitionSteps, updateStepProgress } from './animation/transitions';
import { GREENERY } from './assetRegistry';
import { initPickBlooms } from './steps/pickBlooms';
import { initArrange } from './steps/arrange';
import { initWriteCard } from './steps/writeCard';
import { initSend } from './steps/send';

function restoreStateFromHash() {
  const match = window.location.hash.match(/state=([^&]+)/);
  if (!match) return null;
  return decodeState(decodeURIComponent(match[1]));
}

export function initBuilder() {
  const root = document.querySelector<HTMLElement>('[data-builder]');
  if (!root) return;

  initLenis();

  const store = createBouquetStore(restoreStateFromHash() ?? createInitialState());
  if (!store.getState().greenery) store.setGreenery(GREENERY[0].id);

  store.subscribe((state) => {
    const token = encodeState(state);
    history.replaceState(null, '', `#state=${token}`);
  });

  const sections = [...root.querySelectorAll<HTMLElement>('.builder-step')];
  const sectionFor = (n: number) => sections.find((s) => Number(s.dataset.step) === n);

  initPickBlooms(store, sectionFor(1)!);
  initArrange(store, sectionFor(2)!);
  initWriteCard(store, sectionFor(3)!);
  initSend(store, sectionFor(4)!);

  let currentStep = 1;

  async function goToStep(n: number, direction: 'forward' | 'backward') {
    const outEl = sectionFor(currentStep);
    const inEl = sectionFor(n);
    if (!outEl || !inEl || n < 1 || n > sections.length) return;
    await transitionSteps(outEl, inEl, direction);
    currentStep = n;
    updateStepProgress(n);
    scrollToTop();
  }

  root.addEventListener('click', (evt) => {
    const target = evt.target as HTMLElement;
    const nextBtn = target.closest<HTMLButtonElement>('[data-next]');
    const backBtn = target.closest<HTMLButtonElement>('[data-back]');

    if (nextBtn) {
      if (nextBtn.disabled) return;
      if (currentStep === 1 && !isBloomCountValid(store.getState())) return;
      void goToStep(currentStep + 1, 'forward');
    } else if (backBtn) {
      void goToStep(currentStep - 1, 'backward');
    }
  });
}
