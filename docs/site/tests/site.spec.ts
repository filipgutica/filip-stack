import { expect, test } from "@playwright/test";
import {
  openPageType,
  pageTypes,
  routes,
  skillNames,
  themes,
  widths,
} from "./pages";
import {
  expectSkillLinks,
  followPillarFromMap,
  openGuideFromOverview,
  openMaintenanceFromContents,
} from "./guide";

test("the lesson's figures and links work after hydration", async ({
  page,
}) => {
  await page.goto("/filip-stack/");
  await expect(
    page.locator("#standalone").getByRole("link", {
      name: "agent-ready-environments", exact: true,
    }),
  ).toHaveAttribute("href", "/filip-stack/skills/agent-ready-environments/");
  await openGuideFromOverview(page);
  // Appearance controls only exist once the shared shell has hydrated.
  await expect(page.getByRole("group", { name: "Color theme" })).toBeVisible();

  const channels = page.locator(".channels > li");
  await expect(channels).toHaveCount(4);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        channels.first().evaluate((element) =>
          getComputedStyle(element, "::before").content,
        ),
      )
      .toBe("none");
    for (const card of await channels.all()) {
      await expect(card).toHaveCSS("grid-template-columns", /^\d+(?:\.\d+)?px$/);
    }
  }
  const pillarLink = page.locator(".pillar-map").getByRole("link").first();
  await expect(pillarLink, "Pillar links keep a 44px minimum on phones").toHaveCSS(
    "min-height",
    "44px",
  );
  await page.setViewportSize({ width: 1280, height: 900 });

  const figure = page.locator(".catch");
  const tally = figure.locator(".catch__tally");
  await expect(tally).toHaveText(
    "4 of 4 problems get past the agent, so you are the test suite.",
  );
  const check = figure.getByRole("button", { name: /^One check command/ });
  await check.click();
  await expect(check).toHaveAttribute("aria-pressed", "true");
  await expect(tally).toHaveText("3 of 4 problems get past the agent.");
  await expect(figure.locator(".catch__problems > li").first()).toContainText(
    "Agent fixes it",
  );
  for (const name of [
    /^Tests with signal/,
    /^Seeded app, one command/,
    /^Deny rule on secrets/,
  ])
    await figure.getByRole("button", { name }).click();
  await expect(tally).toContainText("All 4 are stopped before the agent says done.");

  // Figure 2 answers when each piece runs: one task, setup to merge, with
  // each stage linking the pillars at work there.
  const timeline = page.getByRole("list", { name: "One task, from setup to merge" });
  await expect(timeline.getByRole("listitem")).toHaveCount(8);
  await timeline
    .getByRole("listitem")
    .filter({ hasText: /^Merge/ })
    .getByRole("link", { name: "Pillar 7" })
    .click();
  await expect(page).toHaveURL(/#pillar-7-bounded-autonomy$/);
  await expect(
    page.getByRole("heading", { name: "Pillar 7: Bounded autonomy", exact: true }),
  ).toBeInViewport();

  await followPillarFromMap(page, {
    link: "Code shape Pillar 1",
    anchor: "pillar-1-code-shape",
    heading: "Pillar 1: Code shape",
  });
  await openMaintenanceFromContents(page);
  await expectSkillLinks(page);
});

test("Previous and Next walk the sidebar order", async ({ page }) => {
  await page.goto("/filip-stack/");
  const order = await page
    .getByRole("navigation", { name: "Documentation", exact: true })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(order).toHaveLength(routes.length);
  for (const [index, href] of order.entries()) {
    await page.goto(href!);
    const previous = page.locator('a[rel="prev"]');
    const next = page.locator('a[rel="next"]');
    if (index === 0) await expect(previous).toHaveCount(0);
    else await expect(previous).toHaveAttribute("href", order[index - 1]!);
    if (index === order.length - 1) await expect(next).toHaveCount(0);
    else await expect(next).toHaveAttribute("href", order[index + 1]!);
  }
});

test("every route is reachable and marks only its current navigation link", async ({
  page,
}) => {
  await page.goto("/filip-stack/");
  for (const route of routes) {
    const nav = page.getByRole("navigation", {
      name: "Documentation",
      exact: true,
    });
    await nav.locator(`a[href="/filip-stack/${route}"]`).click();
    await expect(page).toHaveURL(`/filip-stack/${route}`);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      `/filip-stack/${route}`,
    );
    await expect(nav.getByRole("link")).toHaveCount(routes.length);
    if (route.startsWith("skills/")) {
      await expect(page.locator("main h1")).toHaveText(route.split("/")[1]!);
      await expect(page.locator("main > section > h2")).toHaveText([
        "What it does",
        "When to use it",
        "How it works",
        "What you get",
        "Related skills",
      ]);
    }
  }
  for (const name of skillNames) {
    await expect(
      page
        .getByRole("navigation", { name: "Documentation", exact: true })
        .getByRole("link", { name, exact: true })
        .locator("code"),
    ).toHaveText(name);
  }
});

test("copies install commands and command-table rows after hydration", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/filip-stack/");
  await page
    .locator("#install")
    .getByRole("button", { name: "Copy code" })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      "claude plugin marketplace add filipgutica/filip-stack\nclaude plugin install workflow@filip-stack",
    );
  await page.goto("/filip-stack/cli/");
  await page
    .getByRole("button", {
      name: "Copy filip-stack field-guide-sync",
      exact: true,
    })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("filip-stack field-guide-sync");
  for (const [skill, command] of [
    [
      "full-send",
      "npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send sol-loop babysit-pr council -y",
    ],
    [
      "full-stop",
      "npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-stop full-send sol-loop babysit-pr council -y",
    ],
    [
      "hill-climb",
      "npx skills add filipgutica/filip-stack -g -a claude-code codex -s hill-climb council -y",
    ],
  ]) {
    await page.goto(`/filip-stack/skills/${skill}/`);
    await page.getByRole("button", { name: "Copy code", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(command);
  }
});

test("wide code scrolls inside a region keyboard readers can scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/filip-stack/skills/grill-me/");
  const region = page.getByRole("region", { name: "How it works code" });
  expect(
    await region.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => region.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});

test("the shared appearance picker persists dark across routes and resets to system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/filip-stack/");
  await page
    .getByRole("group", { name: "Color theme" })
    .getByRole("button", { name: "Dark theme" })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("navigation", { name: "Documentation", exact: true })
    .getByRole("link", { name: "Field Guide", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("group", { name: "Color theme" })
    .getByRole("button", { name: "System theme" })
    .click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("on a phone, Previous and Next share one row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/filip-stack/skills/engineering/");
  const prev = await page.locator('.pager a[rel="prev"]').boundingBox();
  const next = await page.locator('.pager a[rel="next"]').boundingBox();
  expect(next!.y).toBe(prev!.y);
  expect(next!.x).toBeGreaterThan(prev!.x + prev!.width);
});

test("the phone drawer supports escape, focus return, and cross-page navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/filip-stack/");
  const trigger = page.getByRole("button", {
    name: "Documentation: Overview",
    exact: true,
  });
  const drawer = page.getByRole("dialog", { name: "Documentation" });
  await trigger.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link")).toHaveCount(routes.length);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole("link", { name: "engineering", exact: true }).click();
  await expect(page).toHaveURL("/filip-stack/skills/engineering/");
  await expect(drawer).toBeHidden();
  await expect(page.locator("main h1")).toHaveText("engineering");
  await page
    .getByRole("button", { name: "Documentation: engineering", exact: true })
    .click();
  await expect(drawer.locator('[aria-current="page"]')).toHaveText(
    "engineering",
  );
  await drawer
    .getByRole("link", { name: "Agent-ready environments", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 812 });
  const longLabel = page.getByRole("button", {
    name: "Documentation: Agent-ready environments",
    exact: true,
  });
  await expect(longLabel).toBeVisible();
  expect(
    await longLabel.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

for (const theme of themes)
  for (const width of widths)
    for (const entry of pageTypes) {
      test(`${entry.path || "overview"} renders at ${width}px in ${theme} without overflow or runtime errors`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error" || message.type() === "warning")
            errors.push(message.text());
        });
        await page.emulateMedia({ colorScheme: theme });
        await openPageType({ page, entry, width });
        await expect(
          page.getByRole("group", { name: "Color theme" }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(errors).toEqual([]);
      });
    }

test("the design system page links the catalogue", async ({ page }) => {
  const site = "https://filipgutica.github.io/design-system/";
  // Keep the test offline: answer design system requests with a stub page.
  await page.route(`${site}**`, (route) => route.fulfill({ contentType: "text/html", body: "<title>Design system</title>" }));
  await page.goto("/filip-stack/design-system/");
  await expect(page.getByRole("link", { name: "Component catalogue", exact: true })).toHaveAttribute(
    "href",
    `${site}components.html`,
  );
});

// A local copy of the button drifts from the library's raise, hover, and press.
test("actions with the button fill are library buttons", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  for (const route of routes.map((route) => `/filip-stack/${route}`)) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const strays = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.background = "var(--color-accent)";
      const fill = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [...document.querySelectorAll("a, button")]
        .filter(
          (element) =>
            getComputedStyle(element).backgroundColor === fill &&
            !element.closest(".fg-button"),
        )
        .map((element) => element.outerHTML.slice(0, 80));
    });
    expect(strays, route).toEqual([]);
  }
});
