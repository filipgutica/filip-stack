import { expect, type Page } from "@playwright/test";

// Steps shared by the hydrated and no-JavaScript tests of the lesson.
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

// The pillar map and the contents list jump to sections that keep the
// anchors the page has always published.
export const followPillarFromMap = async (
  page: Page,
  { link, anchor, heading }: { link: string; anchor: string; heading: string },
) => {
  await expect(
    page.getByRole("heading", { level: 3, name: /^Pillar \d:/ }),
  ).toHaveCount(8);
  await page
    .locator(".pillar-map")
    .getByRole("link", { name: link, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeInViewport();
};

export const openMaintenanceFromContents = async (page: Page) => {
  const contents = page.getByRole("navigation", {
    name: "In this lesson",
    exact: true,
  });
  await expect(contents.getByRole("link")).toHaveCount(9);
  await contents
    .getByRole("link", { name: "Keeping guidance current", exact: true })
    .click();
  await expect(page).toHaveURL(/#maintenance$/);
  await expect(
    page.getByRole("heading", { name: "Keeping guidance current", exact: true }),
  ).toBeInViewport();
};

export const expectSkillLinks = (page: Page) =>
  expect(
    page
      .getByRole("region", { name: "Next steps", exact: true })
      .getByRole("link", { name: "Skill source", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://github.com/filipgutica/filip-stack/blob/main/skills/agent-ready-environments/SKILL.md",
  );
