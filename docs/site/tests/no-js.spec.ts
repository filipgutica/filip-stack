import { expect, test } from '@playwright/test';

const claudeInstall = 'claude plugin marketplace add filipgutica/filip-stack\nclaude plugin install workflow@filip-stack';

for (const width of [320, 390, 768, 801, 1280]) {
  test(`static content and native navigation at ${width}px without JavaScript`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/filip-stack/');
    const projectTrigger = page.getByLabel('Project: Filip Stack', { exact: true });
    await expect(projectTrigger).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Site links' }).getByRole('link')).toHaveText([
      'Guide',
      'GitHub',
      'Releases',
    ]);
    await expect(page.getByRole('heading', { name: 'Skills and setup for Claude and Codex.', level: 1 })).toBeVisible();
    await expect(page.locator('#install code')).toHaveText(claudeInstall);
    await expect(page.getByRole('button', { name: 'Copy code' })).toHaveCount(0);

    const projectMenu = page.getByRole('navigation', { name: 'Projects' });
    await projectTrigger.click();
    await expect(projectMenu.locator('[aria-current="page"]')).toHaveText('Filip Stack');
    await projectTrigger.click();
    await expect(projectMenu).toBeHidden();

    if (width <= 800) await page.locator('.site-menu > summary').click();
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Host config', exact: true }).click();
    await expect(page).toHaveURL(/#host-config$/);
    await expect(page.locator('#host-config')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('the skill lists come from the README and SKILL.md files', async ({ page }) => {
  await page.goto('/filip-stack/');
  const row = (section: string, name: string) =>
    page
      .locator(`section[aria-labelledby="${section}"] .rows.skills .row`)
      .filter({ has: page.locator(':scope > code', { hasText: new RegExp(`^${name}$`) }) });
  await expect(row('workflow', 'engineering')).toContainText('Selected by request');
  await expect(row('workflow', 'simplify')).toContainText('/workflow:simplify');
  await expect(row('skills', 'full-send')).toContainText('/full-send');
  await expect(row('skills', 'babysit-pr').getByRole('link', { name: 'tstack' })).toHaveAttribute(
    'href',
    'https://github.com/t3dotgg/tstack',
  );
});

test('no-JavaScript readers follow the OS dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/filip-stack/');
  const background = () => page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  const lightBackground = await background();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(background).not.toBe(lightBackground);
});
