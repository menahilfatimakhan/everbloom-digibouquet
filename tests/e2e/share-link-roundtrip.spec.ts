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
    // theme intentionally omitted — this payload also doubles as a check
    // that a pre-card-theme record still decodes and hydrates a default
    // (see hydrateBouquetState in schema.ts / docs/state-schema.md).
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

  await expect(page.locator('[data-reveal-intro]')).toHaveText('Someone sent you something…', { timeout: 5000 });
  await page.locator('[data-reveal-open]').click();

  await expect(page.locator('.reveal-card__greeting em')).toHaveText('Roundtrip');
  await expect(page.locator('.reveal-card__message')).toContainText('automated share-link roundtrip test');
  await expect(page.locator('.reveal-card__sign em')).toHaveText('Playwright');
  // card.theme was omitted from TEST_STATE — confirms hydrateBouquetState()
  // filled in the default rather than the field silently being undefined.
  await expect(page.locator('.reveal-card')).toHaveAttribute('data-card-theme', 'classic-cream');

  await context.close();
});

test('an unknown id shows the graceful fallback, not an error page', async ({ page }) => {
  await page.goto('/r/this-id-does-not-exist');
  // Scoped to the page's own heading, not a bare `h1` — Astro's dev-toolbar
  // overlay injects its own h1 elements (audit panel, etc.) that a generic
  // locator can pick up and turn into a Playwright strict-mode violation.
  await expect(page.locator('.reveal-page__missing h1')).toContainText('wilted');
  await expect(page.getByRole('link', { name: /build your own bouquet/i })).toBeVisible();
});
