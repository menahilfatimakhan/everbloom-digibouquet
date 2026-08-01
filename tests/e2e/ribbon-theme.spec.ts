import { test, expect } from '@playwright/test';

/**
 * The Ribbon control offers only a kind of tie — Ribbon, Twine or none — and
 * when "Ribbon" is chosen it is the *colour theme* that decides which of the
 * eight bows is drawn. That indirection is invisible in the markup the picker
 * renders, so nothing else would catch it silently resolving to the wrong bow
 * (or to none at all) after a content edit.
 */
test('choosing Ribbon draws the bow belonging to the selected colour theme', async ({ page }) => {
  await page.goto('/build');
  await page.locator('.flower-card[data-species="rose"] .flower-card__add').click({ clickCount: 6, delay: 25 });
  await page.locator('.builder-step[data-step="1"] [data-next]').click();
  await page.waitForTimeout(600);
  await page.locator('.builder-step[data-step="2"] [data-next]').click();
  await page.locator('.builder-step[data-step="3"] [data-next]').click();
  await expect(page.locator('.builder-step[data-step="4"]')).toBeVisible();

  await page.locator('[data-ribbon="ribbon"]').click();
  for (const [theme, bow] of [['violet', 'bow violet'], ['gold', 'bow gold'], ['powder-blue', 'bow blue']]) {
    await page.locator(`[data-theme="${theme}"]`).click();
    await expect(page.locator(`[data-send-bouquet-svg] [aria-label="${bow}"]`)).toHaveCount(1);
  }

  // Twine carries its own art and ignores the theme; "No Ribbon" draws nothing.
  await page.locator('[data-ribbon="twine"]').click();
  await expect(page.locator('[data-send-bouquet-svg] [aria-label="twine"]')).toHaveCount(1);
  await page.locator('[data-ribbon="none"]').click();
  await expect(page.locator('[data-send-bouquet-svg] .placement--ribbon')).toHaveCount(0);
});
