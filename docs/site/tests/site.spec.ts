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

test("the lesson's figure, audit modes, and links work after hydration", async ({
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

  const modes = page.getByRole("tablist", { name: "Audit mode" });
  await expect(modes.getByRole("tab", { selected: true })).toHaveText(
    "Existing repository",
  );
  await modes.getByRole("tab", { name: "Engineering guidance" }).click();
  await expect(
    page.getByText("Check the instruction files, skills, and review gates."),
  ).toBeVisible();
  // The new-project steps sit under "Where to start", outside the tabs.
  await expect(
    page.getByText("Add the gates before you write code, while they cost the least."),
  ).toBeVisible();

  await followPillarFromMap(page, {
    link: "Code shape Pillar 1",
    anchor: "pillar-1-code-shape",
    heading: "Pillar 1: Code shape",
  });
  await openMaintenanceFromContents(page);
  await expectSkillLinks(page);
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
  await page.goto("/filip-stack/skills/full-send/");
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      "npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send -y",
    );
});

test("the Workflow map follows example requests, skills, and engineering steps after hydration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/filip-stack/");
  const map = page.locator("#workflow");
  const examples = map.getByRole("group", { name: "Example request" });
  const turn = map.locator(".map-turn");
  const detail = map.locator(".map-skill-detail");
  const load = map.locator(".map-load");
  const skill = (name: string) => map.getByRole("radio", { name, exact: true });

  // The feature example walks one request per turn through the stages.
  await expect(examples.getByRole("button", { name: "Feature" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(turn).toContainText("Turn 1 of 5");
  await expect(skill("planning")).toBeChecked();
  await expect(load).toContainText("Depends on the request");
  await map.getByRole("button", { name: "Next turn" }).click();
  await expect(turn).toContainText("Turn 2 of 5");
  await expect(turn).toContainText("Implement the rate-limiting spec.");
  await expect(skill("engineering")).toBeChecked();
  await expect(load).toContainText("references/testing-and-debugging.md");
  await expect(
    map.getByRole("button", { name: "Step 2: Reproduce or test" }),
  ).toHaveAttribute("aria-pressed", "true");
  await map.getByRole("button", { name: "Back" }).click();
  await expect(skill("planning")).toBeChecked();
  // Picking the skill a turn already selected still leaves the example.
  await map.locator(".map-stages").getByText("planning", { exact: true }).click();
  await expect(turn).toContainText("No example selected");
  await examples.getByRole("button", { name: "Feature" }).click();
  await skill("planning").press("Space");
  await expect(turn).toContainText("No example selected");
  await examples.getByRole("button", { name: "Feature" }).click();

  // A one-request example selects its skill and the reference it loads.
  await examples.getByRole("button", { name: "Review" }).click();
  await expect(turn).toContainText("One request");
  await expect(map.getByRole("button", { name: "Next turn" })).toHaveCount(0);
  await expect(skill("review")).toBeChecked();
  await expect(detail).toContainText("Reviews one exact change or document");
  await expect(load).toContainText("No reference loaded");

  // Picking a skill directly leaves the example.
  // Readers click the row; the radio inside it is visually hidden.
  await map.locator(".map-stages").getByText("merge-council", { exact: true }).click();
  await expect(skill("merge-council")).toBeChecked();
  await expect(examples.locator("[aria-pressed='true']")).toHaveCount(0);
  await expect(turn).toContainText("No example selected");
  await expect(load).toContainText("Depends on the request");
  await expect(detail.getByRole("heading")).toContainText("Standalone");
  await expect(
    detail.getByRole("link", { name: "Open skill page" }),
  ).toHaveAttribute("href", "/filip-stack/skills/merge-council/");

  await map.getByRole("button", { name: "Step 1: Define the boundary" }).click();
  await expect(map.locator(".map-step-detail")).toContainText(
    "1. Define the boundary",
  );
  await map.getByRole("button", { name: "Step 5: Read the diff" }).press("Enter");
  await expect(map.locator(".map-step-detail")).toContainText(
    "5. Read the diff",
  );

  // Phones have no room for the ring, so the steps become a list of buttons.
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(map.locator(".map-ring")).toBeHidden();
  await map.getByRole("button", { name: "Step 3: Smallest change" }).click();
  await expect(map.locator(".map-step-detail")).toContainText(
    "3. Smallest change",
  );
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

test("the design language page links the catalogue, and old catalogue links redirect to it", async ({ page }) => {
  const site = "https://filipgutica.github.io/design-system/";
  // Keep the test offline: answer design system requests with a stub page.
  await page.route(`${site}**`, (route) => route.fulfill({ contentType: "text/html", body: "<title>Design system</title>" }));
  await page.goto("/filip-stack/design-language/");
  await expect(page.getByRole("link", { name: "Component catalogue", exact: true })).toHaveAttribute(
    "href",
    `${site}components.html`,
  );
  await page.goto("/filip-stack/design-language/catalogue/reference.html#foundations");
  await expect(page).toHaveURL(`${site}reference.html#foundations`);
  const tokens = await page.request.get("/filip-stack/design-language/catalogue/tokens.css");
  expect(await tokens.text()).toContain(`@import url("${site}tokens.css")`);
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
      probe.style.background = "var(--color-button-bg)";
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
