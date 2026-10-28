import { expect, test } from "@playwright/test";
import { pageTypes, routes, themes, widths } from "./pages";

for (const theme of themes)
  for (const width of widths)
    for (const entry of pageTypes) {
      test(`${entry.path || "overview"} is readable and navigable at ${width}px in ${theme} without JavaScript`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/filip-stack/${entry.path}`);
        await expect(page.locator("main h1")).toHaveText(entry.title);
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

test("all skill prose and README traits render without JavaScript", async ({
  page,
}) => {
  for (const route of routes.filter((route) => route.startsWith("skills/"))) {
    await page.goto(`/filip-stack/${route}`);
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
