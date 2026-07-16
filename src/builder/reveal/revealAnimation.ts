import type { BouquetState } from '../state/schema';
import { composePresentedBouquet } from '../composition/composePresentedBouquet';
import { CARD_FONTS, CARD_THEMES, MEANING_BY_ID, cardThemeCssVars } from '../assetRegistry';
import { gsap, prefersReducedMotion } from '../animation/gsapSetup';
import { attachFloriographyTooltip } from '../floriography/tooltip';

const INTRO_TEXT = 'Someone sent you something…';

function cardMarkup(state: BouquetState): string {
  const font = CARD_FONTS.find((f) => f.id === state.card.font) ?? CARD_FONTS[0];
  const theme = CARD_THEMES.find((t) => t.id === state.card.theme) ?? CARD_THEMES[0];
  const vars = cardThemeCssVars(theme.id);
  const styleAttr = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .concat(`font-family:${font.family}`)
    .join(';');
  const doodle = state.card.doodle
    ? `<svg class="reveal-card__doodle" viewBox="0 0 300 100"><path d="${state.card.doodle}" fill="none" stroke="var(--card-doodle-stroke, var(--color-ink-purple))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : '';
  return `
    <div class="reveal-card card-surface" data-card-theme="${theme.id}" style="${styleAttr}">
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

/** Every part an untie animation might find inside the ribbon group, keyed
 * by the `data-bow-part` convention (see satin-bow.svg / twine.svg / the
 * flower-art-guide docs). Any of these may be absent depending on the asset. */
function findBowParts(ribbonGroupEl: Element) {
  return {
    loopLeft: ribbonGroupEl.querySelector('[data-bow-part="loop-left"]'),
    loopRight: ribbonGroupEl.querySelector('[data-bow-part="loop-right"]'),
    knot: ribbonGroupEl.querySelector('[data-bow-part="knot"]'),
    wrap: ribbonGroupEl.querySelector('[data-bow-part="wrap"]'),
    tailLeft: ribbonGroupEl.querySelector('[data-bow-part="tail-left"]'),
    tailRight: ribbonGroupEl.querySelector('[data-bow-part="tail-right"]'),
  };
}

/**
 * Mounts a closed/wrapped bouquet behind a typed intro line and a
 * "Tap to Open" affordance into `container`, and returns a handle whose
 * open() plays the untie → settle → layered-bloom-open → card timeline.
 * Shared by the recipient page and the in-builder preview so they can never
 * drift apart.
 */
export function mountReveal(container: HTMLElement, state: BouquetState): RevealHandle {
  const composed = composePresentedBouquet(state);

  container.innerHTML = `
    <div class="reveal-stage">
      <p class="reveal-stage__intro" data-reveal-intro aria-hidden="true"></p>
      <svg class="reveal-stage__svg" viewBox="${composed.viewBox}" data-reveal-svg>
        ${composed.materialSvg}
        <g data-reveal-blooms>${composed.bloomsSvg}</g>
        ${composed.ribbonSvg}
      </svg>
      <button
        type="button"
        class="btn btn-primary reveal-stage__cta"
        data-reveal-open
        hidden
        aria-label="Someone sent you something. Tap to open your bouquet."
      >Tap to Open</button>
    </div>
    <div class="reveal-card-slot" data-reveal-card-slot hidden></div>
  `;

  const svg = container.querySelector<SVGSVGElement>('[data-reveal-svg]');
  const introEl = container.querySelector<HTMLElement>('[data-reveal-intro]');
  const bloomGroup = container.querySelector<SVGGElement>('[data-reveal-blooms]');
  const openBtn = container.querySelector<HTMLButtonElement>('[data-reveal-open]');
  const cardSlot = container.querySelector<HTMLElement>('[data-reveal-card-slot]');
  const ribbonGroupEl = container.querySelector<SVGGElement>('.placement--ribbon');

  if (bloomGroup) {
    gsap.set(bloomGroup.querySelectorAll('.placement'), { scale: 0, transformOrigin: 'center' });
    // Floriography on the reveal page: subtle, hover/tap-only, attached even
    // while blooms are invisible — zero-size elements don't receive pointer
    // events, so this is harmless before the bouquet opens.
    bloomGroup.querySelectorAll<SVGGElement>('.placement--bloom').forEach((el) => {
      const meaning = MEANING_BY_ID[el.dataset.assetId ?? ''];
      if (meaning) attachFloriographyTooltip(el, meaning);
    });
  }

  function revealOpenButton() {
    if (!openBtn) return;
    openBtn.hidden = false;
    if (prefersReducedMotion()) return;
    gsap.fromTo(openBtn, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' });
  }

  // --- typed intro, plays automatically on mount ---
  if (introEl) {
    if (prefersReducedMotion()) {
      introEl.textContent = INTRO_TEXT;
      revealOpenButton();
    } else {
      const progress = { n: 0 };
      gsap.to(progress, {
        n: INTRO_TEXT.length,
        duration: 1.3,
        ease: 'none',
        onUpdate: () => {
          introEl.textContent = INTRO_TEXT.slice(0, Math.round(progress.n));
        },
        onComplete: revealOpenButton,
      });
    }
  } else {
    revealOpenButton();
  }

  async function open() {
    if (openBtn) openBtn.hidden = true;

    if (prefersReducedMotion()) {
      if (ribbonGroupEl) gsap.set(ribbonGroupEl, { opacity: 0 });
      if (bloomGroup) gsap.set(bloomGroup.querySelectorAll('.placement'), { scale: 1 });
      if (cardSlot) {
        cardSlot.hidden = false;
        cardSlot.innerHTML = cardMarkup(state);
      }
      return;
    }

    const tl = gsap.timeline();
    let bloomsStart = 0;

    if (ribbonGroupEl) {
      const { loopLeft, loopRight, knot, wrap, tailLeft, tailRight } = findBowParts(ribbonGroupEl);
      const hasTaggedParts = loopLeft || loopRight || knot || wrap;

      if (hasTaggedParts) {
        if (loopLeft) tl.to(loopLeft, { rotate: -50, x: -14, y: -6, opacity: 0, duration: 0.35, ease: 'back.in(1.4)' }, 0);
        if (loopRight) tl.to(loopRight, { rotate: 50, x: 14, y: -6, opacity: 0, duration: 0.35, ease: 'back.in(1.4)' }, 0);
        if (wrap) tl.to(wrap, { scale: 0.7, opacity: 0, duration: 0.3, ease: 'power1.in' }, 0);
        if (knot) tl.to(knot, { scale: 0.6, opacity: 0, duration: 0.25, ease: 'power1.in' }, 0.05);
        if (tailLeft) tl.to(tailLeft, { y: 30, opacity: 0, rotate: -15, duration: 0.4, ease: 'power2.in' }, 0.05);
        if (tailRight) tl.to(tailRight, { y: 30, opacity: 0, rotate: 15, duration: 0.4, ease: 'power2.in' }, 0.05);
      } else {
        // Graceful degrade for a ribbon asset that doesn't carry the
        // data-bow-part convention — a plain fade instead of an error.
        tl.to(ribbonGroupEl, { scale: 0.8, opacity: 0, duration: 0.35, ease: 'power1.in' }, 0);
      }
      bloomsStart = 0.3;
    }

    // Wrap settle — the existing whole-SVG wiggle, now timed to read as
    // "the wrap relaxes once the ribbon's gone" rather than firing on its own.
    if (svg) tl.fromTo(svg, { rotate: -2 }, { rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, bloomsStart > 0 ? '-=0.1' : 0);

    // Blooms open layer by layer: back (with greenery) -> mid -> front,
    // instead of one flat center-out stagger across everything at once.
    if (bloomGroup) {
      const stagger = { each: 0.03, from: 'center' } as const;
      const backEls = bloomGroup.querySelectorAll('[data-layer="back"].placement');
      const midEls = bloomGroup.querySelectorAll('[data-layer="mid"].placement');
      const frontEls = bloomGroup.querySelectorAll('[data-layer="front"].placement');
      if (backEls.length) tl.to(backEls, { scale: 1, duration: 0.5, ease: 'back.out(1.8)', stagger }, bloomsStart);
      if (midEls.length) tl.to(midEls, { scale: 1, duration: 0.5, ease: 'back.out(1.8)', stagger }, '-=0.28');
      if (frontEls.length) tl.to(frontEls, { scale: 1, duration: 0.5, ease: 'back.out(1.8)', stagger }, '-=0.28');
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
