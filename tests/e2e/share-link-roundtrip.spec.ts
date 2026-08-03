import { test, expect } from '@playwright/test';

/**
 * Exercises the link a sender is actually handed, not the API behind it.
 *
 * The previous version of this test POSTed to /api/links and followed the URL
 * that route returned, which passed while the real feature was broken twice
 * over: the route built its URL from `request.url` — reported as
 * https://localhost behind Vercel's proxy, so senders were handed a link to
 * their own machine — and it stored the bouquet in an in-memory Map that every
 * serverless invocation recreates empty. Neither failure could show up there,
 * because a local dev server is a single long-lived process on one origin.
 *
 * Reading the link out of the UI and opening it in a fresh browser context is
 * what makes both visible.
 */
test('the link the sender is given opens the same bouquet for someone else', async ({ page, browser }) => {
  await page.goto('/build');

  await page.locator('.flower-card[data-species="sunflower"] .flower-card__add').click({ clickCount: 4, delay: 25 });
  await page.locator('.flower-card[data-species="lily"] .flower-card__add').click({ clickCount: 3, delay: 25 });
  await page.locator('.builder-step[data-step="1"] [data-next]').click();
  await page.locator('.builder-step[data-step="2"] [data-next]').click();

  await page.fill('[data-card-field="greeting"]', 'Roundtrip');
  await page.fill('[data-card-field="message"]', 'This came from an automated share-link roundtrip test.');
  await page.fill('[data-card-field="signature"]', 'Playwright');
  await page.locator('.builder-step[data-step="3"] [data-next]').click();

  await page.locator('[data-create-link]').click();
  await expect(page.locator('[data-send-result]')).toBeVisible();
  const url = await page.locator('[data-send-link]').inputValue();

  // The link must point at the site the sender is actually on. This is the
  // assertion that would have caught the https://localhost/... links.
  expect(new URL(url).origin).toBe(new URL(page.url()).origin);

  // A fresh context shares no storage or memory with the sender's session —
  // the recipient's browser, in effect.
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(url);

  await expect(recipient.locator('[data-reveal-intro]')).toHaveText('Someone sent you something…', { timeout: 5000 });
  await recipient.locator('[data-reveal-open]').click();

  await expect(recipient.locator('.reveal-card__greeting em')).toHaveText('Roundtrip');
  await expect(recipient.locator('.reveal-card__message')).toContainText('automated share-link roundtrip test');
  await expect(recipient.locator('.reveal-card__sign em')).toHaveText('Playwright');

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
