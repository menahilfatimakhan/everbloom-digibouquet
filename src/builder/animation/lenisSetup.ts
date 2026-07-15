import Lenis from 'lenis';
import { gsap, prefersReducedMotion } from './gsapSetup';

let lenis: Lenis | null = null;

export function initLenis(): Lenis | null {
  if (lenis || typeof window === 'undefined' || prefersReducedMotion()) return lenis;

  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollToTop() {
  if (lenis) {
    lenis.scrollTo(0, { duration: 0.6 });
  } else {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}
