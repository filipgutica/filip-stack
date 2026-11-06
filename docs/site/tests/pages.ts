import { readdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const pageTypes = [
  { path: "", title: "Skills and setup for Claude and Codex." },
  { path: "cli/", title: "filip-stack CLI" },
  { path: "design-language/", title: "Design language" },
  { path: "field-guide/", title: "Field Guide" },
  { path: "agent-ready-environments/", title: "Agent-ready environments" },
  { path: "skills/engineering/", title: "engineering" },
  { path: "skills/full-send/", title: "full-send" },
];
export const skillNames = [
  ...readdirSync("../../plugins/workflow/skills"),
  ...readdirSync("../../skills"),
];
export const routes = [
  "",
  "cli/",
  "design-language/",
  "field-guide/",
  "agent-ready-environments/",
  ...skillNames.map((name) => `skills/${name}/`),
];
export const widths = [320, 390, 768, 801, 1280];
export const themes = ["light", "dark"] as const;

/** Opens one page type at a viewport width and waits for its heading. */
export const openPageType = async ({
  page,
  entry,
  width,
}: {
  page: Page;
  entry: (typeof pageTypes)[number];
  width: number;
}) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/filip-stack/${entry.path}`);
  await expect(page.locator("main h1")).toHaveText(entry.title);
};
