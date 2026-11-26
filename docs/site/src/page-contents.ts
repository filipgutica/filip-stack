import type { UiSiteNavGroup } from "@filipgutica/ui/site";

export const pageContents: Partial<Record<string, readonly UiSiteNavGroup[]>> = {
  "/filip-stack/": [
    {
      items: [
        { href: "#first-skill", label: "Try your first skill" },
        { href: "#workflow-title", label: "How Workflow works" },
        { href: "#standalone-title", label: "Standalone skills" },
        { href: "#setup", label: "Optional setup" },
        { href: "#guides", label: "Guides" },
      ],
    },
  ],
  "/filip-stack/cli/": [
    {
      items: [
        { href: "#install", label: "Install" },
        { href: "#writes", label: "Apply the setup" },
        { href: "#update", label: "Keep up to date" },
        { href: "#sync", label: "Sync your Field Guide preferences" },
        { href: "#edits", label: "Recover from a local edit" },
        { href: "#commands", label: "Command reference" },
      ],
    },
  ],
  "/filip-stack/design-system/": [
    {
      items: [
        { href: "#install", label: "Install the plugin" },
        { href: "#catalogue", label: "Component catalogue" },
        { href: "#how", label: "How agents use it" },
        { href: "#formats", label: "Pick the format first" },
        { href: "#reuse", label: "Reuse it in a new project" },
        { href: "#theme", label: "Theme and token names" },
        { href: "#files", label: "Rules and examples in the plugin" },
        { href: "#change", label: "Where to make changes" },
      ],
    },
  ],
  "/filip-stack/field-guide/": [
    {
      items: [
        { href: "#install", label: "Install" },
        { href: "#first-use", label: "Save your first preference" },
        { href: "#manage", label: "See or undo what it saved" },
        { href: "#confirm", label: "Confirm guidance for a gated action" },
        { href: "#maintain", label: "Keep the guide small" },
        { href: "#decide", label: "What it keeps" },
        { href: "#how", label: "How it works" },
        { href: "#sync", label: "Advanced: share preferences between machines" },
      ],
    },
  ],
  "/filip-stack/agent-ready-environments/": [
    {
      label: "The idea",
      items: [
        { href: "#who-does-what", label: "Who does what" },
        { href: "#when-each-piece-runs", label: "When each piece runs" },
        { href: "#why-agents-stop-early", label: "See it in action" },
      ],
    },
    {
      label: "The pillars",
      items: [
        { href: "#the-pillars", label: "The eight pillars" },
        { href: "#tell-check-bound", label: "Three jobs" },
        { href: "#placement-advisory-or-enforced", label: "Advisory or enforced" },
      ],
    },
    {
      label: "Put it to work",
      items: [
        { href: "#where-to-start", label: "Where to start" },
        { href: "#audit-procedure", label: "Run an audit" },
        { href: "#worked-example", label: "Worked example" },
      ],
    },
    {
      label: "Keep it current",
      items: [{ href: "#maintenance", label: "Keeping guidance current" }],
    },
  ],
};
