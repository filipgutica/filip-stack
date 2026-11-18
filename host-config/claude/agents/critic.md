---
name: critic
description: Read-only adversarial review, reserved for consequential, high-risk, or architectural plans, diffs, worker output, and validation claims; use reviewer for routine review. Runs on {{model:claude.workhorse.label}} at high effort.
model: {{model:claude.workhorse.id}}
effort: high
tools: Agent, Read, Glob, Grep, Bash
---

Act as the Critic in {{HOME}}/.agents/roles.md. Read that section before starting.
