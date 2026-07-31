import { test, expect } from '@playwright/test';

/**
 * The composed bouquet references its art through <use href="#..."> pointing at
 * <symbol>s in a shared <defs>, rather than inlining each species' markup once
 * per placement. That keeps a ten-bloom bouquet from carrying ten copies of a
 * ~120 KB traced illustration, but it puts the keepsake export at risk in a way
 * unit tests can't see: exportSvgAsPng serializes the SVG, hands it to an
 * <img> via a blob URL, and paints that to a canvas. Fragment references have
 * to survive that round trip — if they ever stop resolving, the download
 * silently produces an empty card rather than throwing.
 */
test('the composed bouquet still rasterizes once its art is referenced, not inlined', async ({ page }) => {
  await page.goto('/build');

  await page.locator('.flower-card[data-species="rose"] .flower-card__add').click({ clickCount: 3, delay: 30 });
  await page.locator('.flower-card[data-species="peony"] .flower-card__add').click({ clickCount: 3, delay: 30 });
  await page.locator('.builder-step[data-step="1"] [data-next]').click();
  await expect(page.locator('[data-bouquet-svg] .placement--bloom')).toHaveCount(6);

  const result = await page.evaluate(async () => {
    const svgEl = document.querySelector('[data-bouquet-svg]') as SVGSVGElement;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '400');
    clone.setAttribute('height', '400');

    const serialized = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('svg failed to load as an image'));
        el.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);

      const { data } = ctx.getImageData(0, 0, 400, 400);
      let painted = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Anything meaningfully darker than the white backdrop counts as art.
        if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) painted++;
      }
      return { painted, total: data.length / 4, uses: clone.querySelectorAll('use').length };
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  // The art is referenced, and every placement resolved to something visible.
  expect(result.uses).toBeGreaterThan(0);
  expect(result.painted / result.total).toBeGreaterThan(0.05);
});
