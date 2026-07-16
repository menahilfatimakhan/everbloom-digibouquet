import type { BouquetStore } from '../state/bouquetState';
import { CARD_FONTS, CARD_THEMES, cardThemeCssVars } from '../assetRegistry';
import { attachHoverPop } from '../animation/microInteractions';

function pointFromEvent(svg: SVGSVGElement, evt: PointerEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const x = ((evt.clientX - rect.left) / rect.width) * viewBox.width;
  const y = ((evt.clientY - rect.top) / rect.height) * viewBox.height;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function initWriteCard(store: BouquetStore, root: HTMLElement) {
  const greetingInput = root.querySelector<HTMLInputElement>('[data-card-field="greeting"]');
  const messageInput = root.querySelector<HTMLTextAreaElement>('[data-card-field="message"]');
  const signatureInput = root.querySelector<HTMLInputElement>('[data-card-field="signature"]');
  const fontPicker = root.querySelector<HTMLElement>('[data-font-picker]');
  const themePicker = root.querySelector<HTMLElement>('[data-card-theme-picker]');
  const doodlePad = root.querySelector<SVGSVGElement>('[data-doodle-pad]');
  const doodleClearBtn = root.querySelector<HTMLButtonElement>('[data-doodle-clear]');
  const previewGreeting = root.querySelector<HTMLElement>('[data-preview-greeting]');
  const previewMessage = root.querySelector<HTMLElement>('[data-preview-message]');
  const previewSignature = root.querySelector<HTMLElement>('[data-preview-signature]');
  const previewDoodle = root.querySelector<SVGSVGElement>('[data-preview-doodle]');
  const previewPanel = root.querySelector<HTMLElement>('[data-card-preview]');
  if (
    !greetingInput ||
    !messageInput ||
    !signatureInput ||
    !fontPicker ||
    !themePicker ||
    !doodlePad ||
    !previewPanel
  ) {
    return;
  }
  // Re-bound as fresh, non-nullable consts: TS narrowing from the guard
  // above doesn't cross into the render() closure defined below.
  const greetingInputEl = greetingInput;
  const messageInputEl = messageInput;
  const signatureInputEl = signatureInput;
  const fontPickerEl = fontPicker;
  const themePickerEl = themePicker;
  const previewPanelEl = previewPanel;

  greetingInput.addEventListener('input', () => store.setCard({ greeting: greetingInput.value }));
  messageInput.addEventListener('input', () => store.setCard({ message: messageInput.value }));
  signatureInput.addEventListener('input', () => store.setCard({ signature: signatureInput.value }));

  fontPicker.querySelectorAll<HTMLButtonElement>('.font-chip').forEach((chip) => {
    attachHoverPop(chip, 1.04);
    chip.addEventListener('click', () => {
      const fontId = chip.dataset.font;
      if (fontId) store.setCard({ font: fontId });
    });
  });

  themePicker.querySelectorAll<HTMLButtonElement>('.card-theme-chip').forEach((chip) => {
    attachHoverPop(chip, 1.04);
    chip.addEventListener('click', () => {
      const themeId = chip.dataset.cardTheme;
      if (themeId) store.setCard({ theme: themeId });
    });
  });

  // --- signature doodle pad (freehand, pointer-driven SVG path) ---
  let drawing = false;
  let committedPath = '';
  let strokePath = '';
  const livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  livePath.setAttribute('fill', 'none');
  livePath.setAttribute('stroke', 'var(--card-doodle-stroke, var(--color-ink-purple))');
  livePath.setAttribute('stroke-width', '2.5');
  livePath.setAttribute('stroke-linecap', 'round');
  livePath.setAttribute('stroke-linejoin', 'round');
  doodlePad.appendChild(livePath);

  function updateLivePath() {
    livePath.setAttribute('d', `${committedPath} ${strokePath}`.trim());
  }

  doodlePad.addEventListener('pointerdown', (evt) => {
    drawing = true;
    doodlePad.setPointerCapture(evt.pointerId);
    const { x, y } = pointFromEvent(doodlePad, evt);
    strokePath = `M${x},${y}`;
    updateLivePath();
  });
  doodlePad.addEventListener('pointermove', (evt) => {
    if (!drawing) return;
    const { x, y } = pointFromEvent(doodlePad, evt);
    strokePath += ` L${x},${y}`;
    updateLivePath();
  });
  function endStroke() {
    if (!drawing) return;
    drawing = false;
    committedPath = `${committedPath} ${strokePath}`.trim();
    strokePath = '';
    store.setCard({ doodle: committedPath || null });
  }
  doodlePad.addEventListener('pointerup', endStroke);
  doodlePad.addEventListener('pointerleave', endStroke);

  doodleClearBtn?.addEventListener('click', () => {
    committedPath = '';
    strokePath = '';
    updateLivePath();
    store.setCard({ doodle: null });
  });

  function render() {
    const { card } = store.getState();

    // Keep the actual field values in sync with the store, not just the
    // preview — needed now that something other than the user's own typing
    // (an occasion preset) can set card.message. Reassigning to a value that
    // already matches is a safe no-op, so this can't fight the user's typing
    // or jump their cursor.
    if (greetingInputEl.value !== card.greeting) greetingInputEl.value = card.greeting;
    if (messageInputEl.value !== card.message) messageInputEl.value = card.message;
    if (signatureInputEl.value !== card.signature) signatureInputEl.value = card.signature;

    if (previewGreeting) previewGreeting.textContent = card.greeting || 'Beloved';
    if (previewMessage) {
      previewMessage.textContent =
        card.message || 'I have so much to tell you, but only this much space on this card! Still, you must know...';
    }
    if (previewSignature) previewSignature.textContent = card.signature || 'Secret Admirer';

    const font = CARD_FONTS.find((f) => f.id === card.font) ?? CARD_FONTS[0];
    previewPanelEl.style.fontFamily = font.family;

    const theme = CARD_THEMES.find((t) => t.id === card.theme) ?? CARD_THEMES[0];
    previewPanelEl.dataset.cardTheme = theme.id;
    const vars = cardThemeCssVars(theme.id);
    for (const [key, value] of Object.entries(vars)) previewPanelEl.style.setProperty(key, value);

    fontPickerEl.querySelectorAll<HTMLElement>('.font-chip').forEach((chip) => {
      chip.dataset.active = String(chip.dataset.font === card.font);
    });
    themePickerEl.querySelectorAll<HTMLElement>('.card-theme-chip').forEach((chip) => {
      chip.dataset.active = String(chip.dataset.cardTheme === theme.id);
    });

    if (previewDoodle) {
      previewDoodle.innerHTML = card.doodle
        ? `<path d="${card.doodle}" fill="none" stroke="var(--card-doodle-stroke, var(--color-ink-purple))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
        : '';
    }
  }

  store.subscribe(render);
  render();
}
