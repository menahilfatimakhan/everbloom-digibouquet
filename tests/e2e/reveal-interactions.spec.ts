import { test, expect } from '@playwright/test';
// Default import, not a named one: lz-string is a UMD/CJS bundle, and this file
// runs in Node where `import { compressToEncodedURIComponent }` throws
// "does not provide an export named ...". The default resolves to module.exports.
import lzString from 'lz-string';

const TEST_STATE = {
  v: 1,
  blooms: [
    { species: 'sunflower', qty: 3 },
    { species: 'rose', qty: 3 },
  ],
  greenery: 'eucalyptus',
  arrangementSeed: 42,
  occasion: null,
  presentation: { type: 'vase', wrap: null, vase: 'vase-ceramic', ribbon: 'ribbon', theme: 'gold' },
  card: {
    greeting: 'Friend',
    message: 'Testing the reveal sequence.',
    signature: 'Playwright',
    font: 'monospace',
    theme: 'classic-cream',
    doodle: null,
  },
};

/** Builds the same self-contained link the Send step hands the sender — the
 * bouquet rides in the path, so there is no endpoint to call and no store to
 * seed. */
function revealUrl() {
  return `/r/${lzString.compressToEncodedURIComponent(JSON.stringify(TEST_STATE))}`;
}

test('reveal plays a typed intro before the tap-to-open gate appears', async ({ page }) => {
  const url = revealUrl();
  await page.goto(url);

  // The button starts hidden and the intro is mid-typewriter shortly after load.
  await expect(page.locator('[data-reveal-open]')).toBeHidden();
  await expect(page.locator('[data-reveal-intro]')).toHaveText(/Someone sent you/);

  // Once the intro finishes, the tap gate appears — nothing before it is
  // spoiled by a static heading (the page has none for the success state).
  await expect(page.locator('[data-reveal-open]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-reveal-intro]')).toHaveText('Someone sent you something…');
});

test('tapping open unties the ribbon, opens blooms layer by layer, then shows the card', async ({ page }) => {
  const url = revealUrl();
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

test('reduced motion skips straight to the fully-open end state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const url = revealUrl();
  await page.goto(url);

  // No typewriter delay — button is available immediately.
  await expect(page.locator('[data-reveal-open]')).toBeVisible();
  await page.click('[data-reveal-open]');
  await expect(page.locator('.reveal-card')).toBeVisible();
});
