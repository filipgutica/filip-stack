import { expect, type Locator, type Page } from "@playwright/test";

// Steps shared by the hydrated and no-JavaScript tests of the environment guide.
export const openGuideFromOverview = async (page: Page) => {
  await page
    .getByRole("region", { name: "Guides", exact: true })
    .getByRole("link", { name: "Agent-ready environments", exact: true })
    .click();
  await expect(page).toHaveURL("/filip-stack/agent-ready-environments/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Agent-ready environments",
  );
};

export const pillarTable = async (page: Page) => {
  const pillars = page.getByRole("table").filter({
    has: page.getByRole("columnheader", { name: "Observable audit check" }),
  });
  await expect(pillars.getByRole("row")).toHaveCount(9);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Pillar \d:/ }),
  ).toHaveCount(8);
  return pillars;
};

export const followPillarLink = async (
  page: Page,
  pillars: Locator,
  { number, anchor, heading }: { number: string; anchor: string; heading: string },
) => {
  const link = pillars.getByRole("link", { name: number, exact: true });
  await expect(link).toHaveAttribute("href", `#${anchor}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeInViewport();
};

export const openMaintenance = async (page: Page) => {
  await page.getByRole("link", { name: "maintenance.md", exact: true })
    .first().click();
  const maintenance = page.getByRole("region", {
    name: "Maintaining this skill", exact: true,
  });
  await expect(maintenance.getByRole("heading", {
    name: "Maintaining this skill", exact: true,
  })).toBeInViewport();
  return maintenance;
};

export const expectNoFileLinks = (page: Page) =>
  expect(page.locator(
    'main a[href^="references/"], main a[href^="../"], main a[href="maintenance.md"]',
  )).toHaveCount(0);
