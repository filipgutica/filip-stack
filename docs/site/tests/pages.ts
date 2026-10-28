import { readdirSync } from "node:fs";

export const pageTypes = [
  { path: "", title: "Skills and setup for Claude and Codex." },
  { path: "cli/", title: "filip-stack CLI" },
  { path: "design-language/", title: "Design language" },
  { path: "field-guide/", title: "Field Guide" },
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
  ...skillNames.map((name) => `skills/${name}/`),
];
export const widths = [320, 390, 768, 801, 1280];
export const themes = ["light", "dark"] as const;
