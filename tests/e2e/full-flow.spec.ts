import { test, expect } from '@playwright/test';

test('walks the full builder flow and produces a share link', async ({ page }) => {
  await page.goto('/build');

  // Step 1: Pick blooms
  await page.locator('.flower-card[data-species="rose"] .flower-card__add').click({ clickCount: 3, delay: 30 });
  await page.locator('.flower-card[data-species="peony"] .flower-card__add').click({ clickCount: 3, delay: 30 });
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

  await page.click('.card-theme-chip[data-card-theme="torn-vintage"]');
  await expect(page.locator('[data-card-preview]')).toHaveAttribute('data-card-theme', 'torn-vintage');

  await page.locator('.builder-step[data-step="3"] [data-next]').click();

  // Step 4: Send
  await expect(page.locator('.builder-step[data-step="4"]')).toBeVisible();
  await page.locator('[data-create-link]').click();
  await expect(page.locator('[data-send-result]')).toBeVisible();
  const link = await page.locator('[data-send-link]').inputValue();
  // The bouquet rides inside the link as an lz-string token, whose alphabet
  // includes +, - and $ alongside alphanumerics.
  expect(link).toMatch(/\/r\/[A-Za-z0-9+\-$]+$/);
  expect(new URL(link).origin).toBe(new URL(page.url()).origin);
});

test('an occasion preset pre-fills the card message field, not just the preview', async ({ page }) => {
  await page.goto('/build');

  await page.click('.occasion-chip[data-occasion="anniversary"]');
  await expect(page.locator('.builder-step[data-step="1"] [data-next]')).toBeEnabled();
  await page.locator('.builder-step[data-step="1"] [data-next]').click();
  await page.locator('.builder-step[data-step="2"] [data-next]').click();

  const messageValue = await page.inputValue('[data-card-field="message"]');
  expect(messageValue.length).toBeGreaterThan(0);
  await expect(page.locator('[data-preview-message]')).toHaveText(messageValue);
});

test('hovering a flower shows its meaning without adding it', async ({ page }) => {
  await page.goto('/build');

  const badge = page.locator('.flower-card[data-species="tulip"] [data-qty-badge]');
  await expect(badge).toBeHidden();

  await page.locator('.flower-card[data-species="tulip"] .flower-card__add').hover();
  await expect(page.locator('.floriography-tooltip')).toContainText('love');
  await expect(badge).toBeHidden(); // hover must never add the flower

  await page.locator('.flower-card[data-species="tulip"] .flower-card__add').click();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('1');
});
