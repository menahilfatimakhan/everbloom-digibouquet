import { gsap, prefersReducedMotion } from './gsapSetup';

export function updateStepProgress(current: number) {
  const nav = document.querySelector<HTMLElement>('[data-step-progress]');
  if (!nav) return;
  nav.dataset.current = String(current);
  nav.querySelectorAll<HTMLElement>('.step-progress__item').forEach((item) => {
    const n = Number(item.dataset.step);
    const dot = item.querySelector('.step-progress__dot');
    const state = n < current ? 'done' : n === current ? 'active' : 'upcoming';
    item.dataset.state = state;
    if (dot) dot.textContent = n < current ? '✓' : String(n);
  });
  const fill = nav.querySelector<HTMLElement>('[data-step-progress-fill]');
  if (fill) fill.style.width = `${((current - 1) / 3) * 100}%`;
}

/** Shared timeline for every Next/Back transition between builder steps. */
export function transitionSteps(outEl: HTMLElement, inEl: HTMLElement, direction: 'forward' | 'backward') {
  return new Promise<void>((resolve) => {
    if (prefersReducedMotion()) {
      outEl.hidden = true;
      inEl.hidden = false;
      resolve();
      return;
    }
    const offset = direction === 'forward' ? 24 : -24;
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(outEl, { opacity: 0, x: -offset, duration: 0.25, ease: 'power2.in' }).call(() => {
      outEl.hidden = true;
      inEl.hidden = false;
      gsap.set(inEl, { opacity: 0, x: offset });
    }).to(inEl, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
  });
}

export function staggerGrowIn(elements: Element[] | NodeListOf<Element>) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    elements,
    { scale: 0.3, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.02 }
  );
}
