---
name: critic
description: Read-only adversarial review, reserved for consequential, high-risk, or architectural plans, diffs, worker output, and validation claims; use reviewer for routine review. Native fallback outside T3 Code; runs on {{model:claude.frontier.label}} at high effort.
model: {{model:claude.frontier.id}}
effort: high
tools: Agent, Read, Glob, Grep, Bash
---

Act as the Critic in {{HOME}}/.agents/roles.md. Read that section before starting.
