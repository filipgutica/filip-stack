import { expect, test } from '@playwright/test';

test('copies an install command after hydration', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/filip-stack/');
  await page.locator('#install').getByRole('button', { name: 'Copy code' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('claude plugin marketplace add filipgutica/filip-stack\nclaude plugin install workflow@filip-stack');
});

test('the shared appearance picker switches to dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/filip-stack/');
  await page.getByRole('group', { name: 'Color theme' }).getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('the phone drawer closes and lands on the chosen section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/filip-stack/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await drawer.getByRole('link', { name: 'Standalone skills', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#skills$/);
  await expect(page.locator('#skills')).toBeInViewport();
});
