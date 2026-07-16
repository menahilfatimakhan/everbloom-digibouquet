import type { BouquetState } from '../state/schema';
import { composePresentedBouquet } from '../composition/composePresentedBouquet';
import { CARD_FONTS } from '../assetRegistry';
import { gsap, prefersReducedMotion } from '../animation/gsapSetup';

function cardMarkup(state: BouquetState): string {
  const font = CARD_FONTS.find((f) => f.id === state.card.font) ?? CARD_FONTS[0];
  const doodle = state.card.doodle
    ? `<svg class="reveal-card__doodle" viewBox="0 0 300 100"><path d="${state.card.doodle}" fill="none" stroke="var(--color-ink-purple)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : '';
  return `
    <div class="reveal-card" style="font-family:${font.family}">
      <p class="reveal-card__greeting"><span>Dear</span> <em>${escapeHtml(state.card.greeting || 'Beloved')}</em>,</p>
      <p class="reveal-card__message">${escapeHtml(state.card.message || 'A bouquet, just for you.')}</p>
      <p class="reveal-card__sign"><span>Sincerely,</span><br /><em>${escapeHtml(state.card.signature || 'Someone who thinks of you')}</em></p>
      ${doodle}
    </div>`;
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

export interface RevealHandle {
  open: () => Promise<void>;
}

/**
 * Mounts a closed/wrapped bouquet with a tap-to-open affordance into
 * `container`, and returns a handle whose open() plays the unwrap → bloom →
 * card timeline. Shared by the recipient page and the in-builder preview so
 * they can never drift apart.
 */
export function mountReveal(container: HTMLElement, state: BouquetState): RevealHandle {
  const composed = composePresentedBouquet(state);

  container.innerHTML = `
    <div class="reveal-stage">
      <svg class="reveal-stage__svg" viewBox="${composed.viewBox}" data-reveal-svg>
        ${composed.materialSvg}
        <g data-reveal-blooms>${composed.bloomsSvg}</g>
        ${composed.ribbonSvg}
      </svg>
      <button type="button" class="btn btn-primary reveal-stage__cta" data-reveal-open>Tap to Open</button>
    </div>
    <div class="reveal-card-slot" data-reveal-card-slot hidden></div>
  `;

  const svg = container.querySelector<SVGSVGElement>('[data-reveal-svg]');
  const bloomGroup = container.querySelector<SVGGElement>('[data-reveal-blooms]');
  const openBtn = container.querySelector<HTMLButtonElement>('[data-reveal-open]');
  const cardSlot = container.querySelector<HTMLElement>('[data-reveal-card-slot]');

  if (bloomGroup) {
    gsap.set(bloomGroup.querySelectorAll('.placement'), { scale: 0, transformOrigin: 'center' });
  }

  async function open() {
    if (openBtn) openBtn.hidden = true;

    if (prefersReducedMotion()) {
      if (bloomGroup) gsap.set(bloomGroup.querySelectorAll('.placement'), { scale: 1 });
      if (cardSlot) {
        cardSlot.hidden = false;
        cardSlot.innerHTML = cardMarkup(state);
      }
      return;
    }

    const tl = gsap.timeline();
    if (svg) tl.fromTo(svg, { rotate: -2 }, { rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    if (bloomGroup) {
      tl.to(
        bloomGroup.querySelectorAll('.placement'),
        { scale: 1, duration: 0.6, ease: 'back.out(1.8)', stagger: { each: 0.035, from: 'center' } },
        '-=0.2'
      );
    }
    if (cardSlot) {
      tl.call(() => {
        cardSlot.hidden = false;
        cardSlot.innerHTML = cardMarkup(state);
      });
      tl.fromTo(cardSlot, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
    }
    await tl.then();
  }

  openBtn?.addEventListener('click', () => void open());

  return { open };
}

/** Lightweight modal preview used by the Send step's "Preview the Reveal"
 * button — same visuals/timeline as the real recipient page, no link
 * required. */
export function playRevealPreview(state: BouquetState) {
  const overlay = document.createElement('div');
  overlay.className = 'reveal-preview-overlay';
  overlay.innerHTML = `
    <div class="reveal-preview-panel">
      <button type="button" class="reveal-preview-close" aria-label="Close preview">×</button>
      <div data-reveal-preview-mount></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const mount = overlay.querySelector<HTMLElement>('[data-reveal-preview-mount]')!;
  mountReveal(mount, state);

  function close() {
    overlay.remove();
  }
  overlay.querySelector('.reveal-preview-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
