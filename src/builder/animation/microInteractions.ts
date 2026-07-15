import { gsap, prefersReducedMotion } from './gsapSetup';

/** Hover/tap "pop" used on flower cards, chips, and swatches. */
export function attachHoverPop(el: HTMLElement, scale = 1.06) {
  if (prefersReducedMotion()) return;
  const quickScale = gsap.quickTo(el, 'scale', { duration: 0.25, ease: 'back.out(2)' });
  el.addEventListener('pointerenter', () => quickScale(scale));
  el.addEventListener('pointerleave', () => quickScale(1));
  el.addEventListener('pointerdown', () => quickScale(0.94));
  el.addEventListener('pointerup', () => quickScale(scale));
}

/** Satisfying pop for a newly-added element (e.g. a fresh tally chip). */
export function popIn(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(el, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' });
}

/** Rejection feedback — e.g. trying to add an 11th bloom. */
export function shake(el: HTMLElement) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { x: -6 },
    { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)', clearProps: 'x' }
  );
}

/** Rolling number tween for the bloom tally count. */
export function tweenNumber(el: HTMLElement, from: number, to: number) {
  if (prefersReducedMotion()) {
    el.textContent = String(to);
    return;
  }
  const obj = { value: from };
  gsap.to(obj, {
    value: to,
    duration: 0.35,
    ease: 'power1.out',
    onUpdate: () => {
      el.textContent = String(Math.round(obj.value));
    },
  });
}
