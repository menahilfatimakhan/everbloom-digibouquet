import type { BouquetStore } from '../state/bouquetState';
import { composePresentedBouquet } from '../composition/composePresentedBouquet';
import { PRESENTATION } from '../assetRegistry';
import { attachHoverPop } from '../animation/microInteractions';
import { exportSvgAsPng } from '../cardExport/exportImage';
import { createShareLink } from '../../lib/http';
import { playRevealPreview } from '../reveal/revealAnimation';

export function initSend(store: BouquetStore, root: HTMLElement) {
  const svgQuery = root.querySelector<SVGSVGElement>('[data-send-bouquet-svg]');
  const typeToggleQuery = root.querySelector<HTMLElement>('[data-wrap-vase-toggle]');
  const wrapOptionsQuery = root.querySelector<HTMLElement>('[data-wrap-options]');
  const vaseOptionsQuery = root.querySelector<HTMLElement>('[data-vase-options]');
  const themeRowQuery = root.querySelector<HTMLElement>('[data-theme-row]');
  const previewRevealBtn = root.querySelector<HTMLButtonElement>('[data-preview-reveal]');
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-download-keepsake]');
  const createLinkBtn = root.querySelector<HTMLButtonElement>('[data-create-link]');
  const sendResult = root.querySelector<HTMLElement>('[data-send-result]');
  const sendLinkInput = root.querySelector<HTMLInputElement>('[data-send-link]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy-link]');
  if (!svgQuery || !typeToggleQuery || !wrapOptionsQuery || !vaseOptionsQuery || !themeRowQuery || !createLinkBtn) return;
  // Re-bound as fresh, non-nullable consts: TS narrowing from the guard
  // above doesn't cross into the render() closure defined below.
  const svg = svgQuery;
  const typeToggle = typeToggleQuery;
  const wrapOptions = wrapOptionsQuery;
  const vaseOptions = vaseOptionsQuery;
  const themeRow = themeRowQuery;

  [...root.querySelectorAll<HTMLElement>('.chip, .theme-swatch')].forEach((el) => attachHoverPop(el, 1.08));

  typeToggle.querySelectorAll<HTMLButtonElement>('[data-presentation-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.presentationType as 'wrap' | 'vase';
      const current = store.getState().presentation;
      // Switching to a type that's never been picked before had no default
      // selected, so nothing rendered — always ensure one is set.
      if (type === 'vase' && !current.vase) {
        store.setPresentation({ type, vase: PRESENTATION.vases[0].id });
      } else if (type === 'wrap' && !current.wrap) {
        store.setPresentation({ type, wrap: PRESENTATION.wraps[0].id });
      } else {
        store.setPresentation({ type });
      }
    });
  });

  wrapOptions.querySelectorAll<HTMLButtonElement>('[data-wrap]').forEach((btn) => {
    btn.addEventListener('click', () => store.setPresentation({ wrap: btn.dataset.wrap ?? null }));
  });
  vaseOptions.querySelectorAll<HTMLButtonElement>('[data-vase]').forEach((btn) => {
    btn.addEventListener('click', () => store.setPresentation({ vase: btn.dataset.vase ?? null }));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-ribbon]').forEach((btn) => {
    btn.addEventListener('click', () => store.setPresentation({ ribbon: btn.dataset.ribbon ?? null }));
  });
  themeRow.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => store.setPresentation({ theme: btn.dataset.theme ?? 'lavender-dream' }));
  });

  previewRevealBtn?.addEventListener('click', () => playRevealPreview(store.getState()));

  downloadBtn?.addEventListener('click', () => {
    if (svg) void exportSvgAsPng(svg, 'everbloom-bouquet.png');
  });

  createLinkBtn.addEventListener('click', async () => {
    createLinkBtn.disabled = true;
    createLinkBtn.textContent = 'Creating link…';
    try {
      const { url } = await createShareLink(store.getState());
      if (sendResult && sendLinkInput) {
        sendResult.hidden = false;
        sendLinkInput.value = url;
      }
      createLinkBtn.textContent = 'Create Shareable Link';
    } catch (err) {
      createLinkBtn.textContent = 'Something went wrong — try again';
      setTimeout(() => {
        createLinkBtn.textContent = 'Create Shareable Link';
      }, 2500);
      console.error(err);
    } finally {
      createLinkBtn.disabled = false;
    }
  });

  copyBtn?.addEventListener('click', async () => {
    if (!sendLinkInput) return;
    await navigator.clipboard.writeText(sendLinkInput.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
  });

  function render() {
    const state = store.getState();
    const { presentation } = state;

    typeToggle.querySelectorAll<HTMLElement>('[data-presentation-type]').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.presentationType === presentation.type);
    });
    wrapOptions.hidden = presentation.type !== 'wrap';
    vaseOptions.hidden = presentation.type !== 'vase';
    wrapOptions.querySelectorAll<HTMLElement>('[data-wrap]').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.wrap === presentation.wrap);
    });
    vaseOptions.querySelectorAll<HTMLElement>('[data-vase]').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.vase === presentation.vase);
    });
    root.querySelectorAll<HTMLElement>('[data-ribbon]').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.ribbon === presentation.ribbon);
    });
    themeRow.querySelectorAll<HTMLElement>('[data-theme]').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.theme === presentation.theme);
    });
    const composed = composePresentedBouquet(state);
    svg!.setAttribute('viewBox', composed.viewBox);
    svg!.innerHTML = `${composed.materialSvg}${composed.bloomsSvg}${composed.ribbonSvg}`;
  }

  store.subscribe(render);
  render();
}
