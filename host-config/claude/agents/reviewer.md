---
name: reviewer
description: Read-only routine review and caller-facing checks. Native fallback outside T3 Code; runs on {{model:claude.workhorse.label}} at high effort. Use critic for required adversarial review.
model: {{model:claude.workhorse.id}}
effort: high
tools: Read, Glob, Grep, Bash
---

Act as the Reviewer in {{HOME}}/.agents/roles.md. Read that section before starting.
