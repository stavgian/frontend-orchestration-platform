import { test, expect } from '@playwright/test';

// Needs the MFE dev servers: `npm run serve:all`.
test('landing page lists the scenario records', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Different teams');
  await expect(page.getByRole('link', { name: /^Open case CASE-/ })).toHaveCount(5);
});

test('context switch reaches every app without reloading them, and events cross apps', async ({ page }) => {
  await page.goto('/CASE-2026-1082');
  const tags = ['angular-mfe', 'react-mfe', 'js-mfe', 'vue-mfe', 'svelte-mfe', 'lit-mfe'];
  for (const tag of tags) await expect(page.locator(`${tag}`)).toContainText('CASE-2026-1082');
  const handle = await page.locator('react-mfe').elementHandle();

  // Documents publishes; Compliance and Risk react.
  await page.locator('react-mfe').getByRole('button', { name: 'Upload document' }).click();
  await expect(page.locator('js-mfe')).toContainText('Document screening');
  await expect(page.locator('lit-mfe')).toContainText('Document added');

  // The shell changes the context; the same elements stay mounted and update themselves.
  await page.getByRole('link', { name: 'CASE-2026-1083' }).click();
  for (const tag of tags) await expect(page.locator(`${tag}`)).toContainText('CASE-2026-1083');
  expect(await page.locator('react-mfe').elementHandle().then((h) => h?.evaluate((a, b) => a === b, handle))).toBe(true);
});
