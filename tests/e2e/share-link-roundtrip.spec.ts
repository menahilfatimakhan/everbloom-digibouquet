import { test, expect } from '@playwright/test';

const TEST_STATE = {
  v: 1,
  blooms: [
    { species: 'sunflower', qty: 4 },
    { species: 'lily', qty: 3 },
  ],
  greenery: 'fern',
  arrangementSeed: 777,
  occasion: null,
  presentation: { type: 'wrap', wrap: 'tissue-bundle', vase: null, ribbon: 'twine', theme: 'ivory-sage' },
  card: {
    greeting: 'Roundtrip',
    message: 'This came from an automated share-link roundtrip test.',
    signature: 'Playwright',
    font: 'monospace',
    doodle: null,
  },
};

test('a created share link resolves to the same bouquet in a fresh browser context', async ({ request, browser }) => {
  const createRes = await request.post('/api/links', { data: TEST_STATE });
  expect(createRes.status()).toBe(201);
  const { url } = await createRes.json();

  // Fresh, unrelated browser context — simulates the recipient, not the sender.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);

  await expect(page.locator('h1')).toContainText('An Everbloom bouquet, just for you.');
  await page.locator('[data-reveal-open]').click();

  await expect(page.locator('.reveal-card__greeting em')).toHaveText('Roundtrip');
  await expect(page.locator('.reveal-card__message')).toContainText('automated share-link roundtrip test');
  await expect(page.locator('.reveal-card__sign em')).toHaveText('Playwright');

  await context.close();
});

test('an unknown id shows the graceful fallback, not an error page', async ({ page }) => {
  await page.goto('/r/this-id-does-not-exist');
  await expect(page.locator('h1')).toContainText('wilted');
  await expect(page.getByRole('link', { name: /build your own bouquet/i })).toBeVisible();
});
