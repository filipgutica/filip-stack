// The lesson cites the same keys as the skill's Sources list
// (skills/agent-ready-environments/SKILL.md). Keep both lists in step.
export const sources = {
  A1: {
    title: "Anthropic, Best practices for Claude Code",
    href: "https://code.claude.com/docs/en/best-practices",
  },
  A2: {
    title: "Anthropic Engineering, Effective context engineering for AI agents, 2025-09-29",
    href: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
    note: "Predates the current model generation.",
  },
  A3: {
    title: "Anthropic Engineering, Effective harnesses for long-running agents, 2025-11-26",
    href: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents",
    note: "Predates the current model generation.",
  },
  A4: {
    title: "Anthropic, Skill authoring best practices",
    href: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices",
  },
  A5: {
    title: "Anthropic, Claude Code skills: Run and verify your app",
    href: "https://code.claude.com/docs/en/skills",
  },
  O1: {
    title: "OpenAI (Ryan Lopopolo), Harness engineering: leveraging Codex in an agent-first world, February 2026",
    href: "https://openai.com/index/harness-engineering/",
    note: "Predates the current model generation. The page refused automated fetches, so its claims come from secondary summaries and are not verified.",
  },
  O2: {
    title: "OpenAI, Codex: AGENTS.md",
    href: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  },
  O3: {
    title: "OpenAI, Codex best practices",
    href: "https://learn.chatgpt.com/guides/best-practices",
  },
  S1: {
    title: "Agentic AI Foundation (Linux Foundation), AGENTS.md",
    href: "https://agents.md/",
  },
  G1: {
    title: "GitHub, Customize the agent environment (Copilot)",
    href: "https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment",
  },
} satisfies Record<string, { title: string; href: string; note?: string }>;

export type SourceKey = keyof typeof sources;
