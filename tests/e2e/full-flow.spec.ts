import { test, expect } from '@playwright/test';

test('walks the full builder flow and produces a share link', async ({ page }) => {
  await page.goto('/build');

  // Step 1: Pick blooms
  await page.locator('.flower-card[data-species="rose"]').click({ clickCount: 3, delay: 30 });
  await page.locator('.flower-card[data-species="peony"]').click({ clickCount: 3, delay: 30 });
  await expect(page.locator('.builder-step[data-step="1"] [data-next]')).toBeEnabled();
  await page.locator('.builder-step[data-step="1"] [data-next]').click();

  // Step 2: Arrange
  await expect(page.locator('.builder-step[data-step="2"]')).toBeVisible();
  await expect(page.locator('[data-bouquet-svg] .placement--bloom')).toHaveCount(6);
  await page.locator('[data-reshuffle]').click();
  await page.locator('.builder-step[data-step="2"] [data-next]').click();

  // Step 3: Write the card
  await page.fill('[data-card-field="greeting"]', 'Friend');
  await page.fill('[data-card-field="message"]', 'Full flow test message.');
  await page.fill('[data-card-field="signature"]', 'Tester');
  await expect(page.locator('[data-preview-greeting]')).toHaveText('Friend');
  await page.locator('.builder-step[data-step="3"] [data-next]').click();

  // Step 4: Send
  await expect(page.locator('.builder-step[data-step="4"]')).toBeVisible();
  await page.locator('[data-create-link]').click();
  await expect(page.locator('[data-send-result]')).toBeVisible();
  const link = await page.locator('[data-send-link]').inputValue();
  expect(link).toMatch(/\/r\/[a-zA-Z0-9]+$/);
});
