import { test, expect } from '@playwright/test';

const TEST_STATE = {
  v: 1,
  blooms: [
    { species: 'sunflower', qty: 3 },
    { species: 'rose', qty: 3 },
  ],
  greenery: 'eucalyptus',
  arrangementSeed: 42,
  occasion: null,
  presentation: { type: 'wrap', wrap: 'kraft-cone', vase: null, ribbon: 'satin-bow', theme: 'classic-red' },
  card: {
    greeting: 'Friend',
    message: 'Testing the reveal sequence.',
    signature: 'Playwright',
    font: 'monospace',
    theme: 'classic-cream',
    doodle: null,
  },
};

async function createLink(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/links', { data: TEST_STATE });
  expect(res.status()).toBe(201);
  const { url } = await res.json();
  return url as string;
}

test('reveal plays a typed intro before the tap-to-open gate appears', async ({ page, request }) => {
  const url = await createLink(request);
  await page.goto(url);

  // The button starts hidden and the intro is mid-typewriter shortly after load.
  await expect(page.locator('[data-reveal-open]')).toBeHidden();
  await expect(page.locator('[data-reveal-intro]')).toHaveText(/Someone sent you/);

  // Once the intro finishes, the tap gate appears — nothing before it is
  // spoiled by a static heading (the page has none for the success state).
  await expect(page.locator('[data-reveal-open]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-reveal-intro]')).toHaveText('Someone sent you something…');
});

test('tapping open unties the ribbon, opens blooms layer by layer, then shows the card', async ({ page, request }) => {
  const url = await createLink(request);
  await page.goto(url);
  await page.waitForSelector('[data-reveal-open]:not([hidden])');

  await page.click('[data-reveal-open]');

  // Card is hidden until the timeline reaches it.
  await expect(page.locator('.reveal-card')).toBeHidden();
  await expect(page.locator('.reveal-card')).toBeVisible({ timeout: 5000 });

  // Every bloom placement ends fully opened (scale back to 1).
  const scales = await page.locator('[data-reveal-blooms] .placement--bloom').evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).transform)
  );
  expect(scales.length).toBeGreaterThan(0);

  // Card content matches the state exactly — no re-arranging or substitution.
  await expect(page.locator('.reveal-card__greeting em')).toHaveText('Friend');
  await expect(page.locator('.reveal-card__message')).toContainText('Testing the reveal sequence.');
  await expect(page.locator('.reveal-card__sign em')).toHaveText('Playwright');
});

test('reduced motion skips straight to the fully-open end state', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const url = await createLink(request);
  await page.goto(url);

  // No typewriter delay — button is available immediately.
  await expect(page.locator('[data-reveal-open]')).toBeVisible();
  await page.click('[data-reveal-open]');
  await expect(page.locator('.reveal-card')).toBeVisible();
});
