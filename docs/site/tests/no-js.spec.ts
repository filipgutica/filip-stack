import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openPageType, pageTypes, routes, widths } from "./pages";
import {
  expectSkillLinks,
  followPillarFromMap,
  openGuideFromOverview,
  openMaintenanceFromContents,
} from "./guide";

// The dark theme changes only color tokens, so layout and navigation run in one theme;
// the OS theme test below covers dark mode without JavaScript.
for (const width of widths)
  for (const entry of pageTypes) {
    test(`${entry.path || "overview"} is readable and navigable at ${width}px without JavaScript`, async ({
      page,
    }) => {
      await openPageType({ page, entry, width });
      await expect(page.getByRole("button", { name: /^Copy / })).toHaveCount(
        0,
      );
      if (width <= 800) await page.locator(".fg-site-rail__summary").click();
      const nav = page.getByRole("navigation", {
        name: "Documentation",
        exact: true,
      });
      await expect(nav.getByRole("link")).toHaveCount(routes.length);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
        "href",
        `/filip-stack/${entry.path}`,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await nav
        .getByRole("link", { name: "filip-stack CLI", exact: true })
        .click();
      await expect(page).toHaveURL("/filip-stack/cli/");
      await expect(page.locator("main h1")).toHaveText("filip-stack CLI");
    });
  }

// A skill page's lede is its README skill-table row. Read the rows as plain text here,
// apart from the site's catalog, so a page that stops showing its row fails.
const readmeLedes = new Map(
  readFileSync("../../README.md", "utf8")
    .split("\n")
    .flatMap((line) => {
      const row = line.match(/^\| `([a-z-]+)` \| (.+) \|$/);
      if (!row) return [];
      const text = row[2]!
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replaceAll("`", "");
      return [[row[1]!, text] as const];
    }),
);

test("all skill prose and README traits render without JavaScript", async ({
  page,
}) => {
  for (const route of routes.filter((route) => route.startsWith("skills/"))) {
    await page.goto(`/filip-stack/${route}`);
    const name = route.slice("skills/".length, -1);
    await expect(page.locator("main .lede")).toHaveText(
      readmeLedes.get(name) ?? `no README row for ${name}`,
    );
    await expect(page.locator("main > section > h2")).toHaveText([
      "What it does",
      "When to use it",
      "How it works",
      "What you get",
      "Related skills",
    ]);
    for (const section of await page.locator("main .prose").all())
      await expect(section).not.toBeEmpty();
    if (route === "skills/engineering/")
      await expect(page.locator("main .fg-site-facts")).toContainText(
        "Picked when a request matches",
      );
    if (route === "skills/simplify/")
      await expect(page.locator("main .fg-site-facts")).toContainText(
        "Manual · /workflow:simplify",
      );
    if (route === "skills/grill-me/") {
      const credit = page
        .locator("main .fg-site-facts > div")
        .filter({ hasText: "Adapted from" })
        .locator("dd");
      await expect(credit).toHaveText("grill-me by Matt Pocock");
      await expect(
        credit.getByRole("link", { name: "grill-me" }),
      ).toHaveAttribute(
        "href",
        "https://github.com/mattpocock/skills/tree/HEAD/skills/productivity/grill-me",
      );
    }
    if (route === "skills/full-send/")
      await expect(
        page.locator("main .fg-site-facts").getByRole("link", { name: "full-send" }),
      ).toHaveAttribute(
        "href",
        "https://github.com/t3dotgg/tstack/tree/HEAD/skills/full-send",
      );
    if (route === "skills/walkthrough/")
      await expect(page.locator("main .fg-site-facts")).not.toContainText(
        "Adapted from",
      );
  }
  await page.goto("/filip-stack/");
  await expect(
    page
      .locator("#standalone .skill-rows li")
      .filter({
        has: page.getByRole("link", { name: "full-send", exact: true }),
      }),
  ).toContainText("Manual");
  await expect(
    page
      .locator("#standalone .skill-rows li")
      .filter({
        has: page.getByRole("link", { name: "babysit-pr", exact: true }),
      })
      .getByRole("link", { name: "tstack" }),
  ).toHaveAttribute("href", "https://github.com/t3dotgg/tstack");
});

test("native project menu and OS theme work without JavaScript", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/filip-stack/");
  const project = page.getByLabel("Project: Filip Stack", { exact: true });
  const menu = page.getByRole("navigation", { name: "Projects" });
  await project.click();
  await expect(menu.locator('[aria-current="page"]')).toHaveText("Filip Stack");
  await project.click();
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Site links" }).getByRole("link"),
  ).toHaveText(["GitHub", "Releases", "Changelog"]);
  const background = () =>
    page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  const lightBackground = await background();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(background).not.toBe(lightBackground);
});

test("the Workflow map links each skill and lists every engineering step without JavaScript", async ({
  page,
}) => {
  await page.goto("/filip-stack/");
  const map = page.locator("#workflow");
  await expect(map.getByRole("button")).toHaveCount(0);
  await expect(
    map.getByRole("link", { name: "sol-loop", exact: true }),
  ).toHaveAttribute("href", "/filip-stack/skills/sol-loop/");
  await expect(map.locator(".map-steps > li")).toHaveCount(6);
  await expect(map.locator(".map-steps")).toBeVisible();
});

test("the lesson reads in full and its anchor links work without JavaScript", async ({
  page,
}) => {
  await page.goto("/filip-stack/");
  await openGuideFromOverview(page);
  // Readers get inline links and further reading, not the skill's citation keys.
  await expect(page.locator("main")).not.toContainText(/\[[AOSG]\d/);
  // The figure lists both outcomes for every problem instead of toggles.
  const figure = page.locator(".catch");
  await expect(figure.getByRole("button")).toHaveCount(0);
  await expect(figure.getByText("Without it", { exact: true })).toHaveCount(4);
  // The fix order counts steps 1 to 8, and each step names its pillar.
  const steps = page.locator(".order li");
  await expect(steps.locator(".order__step")).toHaveText(
    [1, 2, 3, 4, 5, 6, 7, 8].map((step) => `Step ${step}`),
  );
  await expect(steps.getByRole("link")).toHaveText(
    [7, 6, 3, 2, 5, 1, 8, 4].map((pillar) => `Pillar ${pillar}`),
  );
  // Every audit mode is visible as its own heading.
  for (const name of ["New project", "Existing repository", "Engineering guidance"])
    await expect(page.getByRole("heading", { level: 3, name, exact: true })).toBeVisible();
  // The published #scoring anchor still lands on the scoring rules.
  await expect(page.locator("#scoring")).toHaveText("How a pillar is scored");
  const handAudit = page.locator("details.lesson-disclosure");
  await handAudit.locator("summary").click();
  await expect(handAudit.getByText(/Mark a pillar N\/A/)).toBeVisible();
  await followPillarFromMap(page, {
    link: "Reproducible environment Pillar 6",
    anchor: "pillar-6-reproducible-environment",
    heading: "Pillar 6: Reproducible environment",
  });
  const more = page
    .locator("#pillar-6-reproducible-environment")
    .locator("xpath=ancestor::article")
    .locator("details");
  await more.locator("summary").click();
  await expect(more.getByText(/throwaway host home/)).toBeVisible();
  await openMaintenanceFromContents(page);
  await expectSkillLinks(page);
});
