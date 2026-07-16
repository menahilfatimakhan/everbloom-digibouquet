import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 667 } });

test('builder flow has no horizontal overflow and remains usable at 375px', async ({ page }) => {
  await page.goto('/build');

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for sub-pixel rounding

  for (let i = 0; i < 6; i++) {
    await page.locator('.flower-card[data-species="tulip"] .flower-card__add').click();
  }
  await expect(page.locator('.builder-step[data-step="1"] [data-next]')).toBeEnabled();
  await page.locator('.builder-step[data-step="1"] [data-next]').click();

  await expect(page.locator('.builder-step[data-step="2"]')).toBeVisible();
  const scrollWidthStep2 = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidthStep2).toBeLessThanOrEqual(clientWidth + 1);
});
