// Further reading for the lesson. The page links a few of these inline where
// the reader may want the original.
export const sources = {
  claudeCodeBestPractices: {
    title: "Anthropic: Best practices for Claude Code",
    href: "https://code.claude.com/docs/en/best-practices",
  },
  contextEngineering: {
    title: "Anthropic: Effective context engineering for AI agents (2025)",
    href: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
  },
  longRunningHarnesses: {
    title: "Anthropic: Effective harnesses for long-running agents (2025)",
    href: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents",
  },
  skillAuthoring: {
    title: "Anthropic: Skill authoring best practices",
    href: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices",
  },
  runAndVerify: {
    title: "Anthropic: Claude Code skills, Run and verify your app",
    href: "https://code.claude.com/docs/en/skills",
  },
  harnessEngineering: {
    title: "OpenAI: Harness engineering, leveraging Codex in an agent-first world (February 2026)",
    href: "https://openai.com/index/harness-engineering/",
    note: "Published before the current model generation.",
  },
  codexAgentsMd: {
    title: "OpenAI: Codex, AGENTS.md",
    href: "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  },
  codexBestPractices: {
    title: "OpenAI: Codex best practices",
    href: "https://learn.chatgpt.com/guides/best-practices",
  },
  agentsMd: {
    title: "Agentic AI Foundation: AGENTS.md",
    href: "https://agents.md/",
  },
  copilotEnvironment: {
    title: "GitHub: Customize the agent environment (Copilot)",
    href: "https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment",
  },
} satisfies Record<string, { title: string; href: string; note?: string }>;
