import { expect, test } from "@playwright/test";
import { pageTypes, routes, skillNames, themes, widths } from "./pages";

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

test("the Workflow map explains requests, skills, and engineering steps after hydration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/filip-stack/");
  const map = page.locator("#workflow");
  const detail = map.locator(".map-skill-detail");
  await map.getByRole("button", { name: "Review this diff" }).click();
  await expect(
    map.getByRole("button", { name: "review", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toContainText("Read-only review or final verification");
  await expect(map.locator(".map-load").last()).toContainText(
    "No reference loaded",
  );
  await map.getByRole("button", { name: "merge-council", exact: true }).click();
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
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  const drawer = page.getByRole("dialog", { name: "Navigation" });
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
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(drawer.locator('[aria-current="page"]')).toHaveText(
    "engineering",
  );
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
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/filip-stack/${entry.path}`);
        await expect(page.locator("main h1")).toHaveText(entry.title);
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
