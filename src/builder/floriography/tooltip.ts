/**
 * One shared floriography tooltip, reused by every trigger (Pick-step info
 * buttons, reveal-page bloom placements) rather than each trigger owning its
 * own tooltip element. Works on both HTML and SVG trigger elements since
 * blooms on the reveal page are `<g>` SVG nodes, not buttons.
 */

let tooltipEl: HTMLDivElement | null = null;
let activeTrigger: Element | null = null;
let outsideListenerAttached = false;

function ensureTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'floriography-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function positionTooltip(trigger: Element) {
  const tooltip = ensureTooltip();
  const rect = trigger.getBoundingClientRect();
  const top = rect.top + window.scrollY - tooltip.offsetHeight - 10;
  const left = rect.left + window.scrollX + rect.width / 2;
  tooltip.style.top = `${Math.max(8, top)}px`;
  tooltip.style.left = `${left}px`;
}

function showTooltip(trigger: Element, meaning: string) {
  const tooltip = ensureTooltip();
  tooltip.textContent = meaning;
  tooltip.hidden = false;
  activeTrigger = trigger;
  positionTooltip(trigger);
}

function hideTooltip() {
  if (!tooltipEl || tooltipEl.hidden) return;
  tooltipEl.hidden = true;
  activeTrigger = null;
}

function ensureOutsideListener() {
  if (outsideListenerAttached) return;
  outsideListenerAttached = true;
  document.addEventListener('pointerdown', (evt) => {
    if (!activeTrigger) return;
    const target = evt.target as Node | null;
    if (target && (activeTrigger.contains(target) || tooltipEl?.contains(target))) return;
    hideTooltip();
  });
  window.addEventListener('scroll', () => hideTooltip(), { passive: true, capture: true });
}

/** Hover (mouse/pen) or focus shows it; tap toggles it; anything else
 * dismisses it. `trigger` can be any Element — HTML button or SVG group. */
export function attachFloriographyTooltip(trigger: Element, meaning: string) {
  ensureOutsideListener();

  trigger.addEventListener('pointerenter', (evt) => {
    if ((evt as PointerEvent).pointerType === 'touch') return;
    showTooltip(trigger, meaning);
  });
  trigger.addEventListener('pointerleave', (evt) => {
    if ((evt as PointerEvent).pointerType === 'touch') return;
    hideTooltip();
  });
  trigger.addEventListener('focus', () => showTooltip(trigger, meaning));
  trigger.addEventListener('blur', () => hideTooltip());
  trigger.addEventListener('pointerup', (evt) => {
    if ((evt as PointerEvent).pointerType !== 'touch') return;
    evt.stopPropagation();
    if (activeTrigger === trigger && tooltipEl && !tooltipEl.hidden) {
      hideTooltip();
    } else {
      showTooltip(trigger, meaning);
    }
  });
}
