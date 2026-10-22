---
name: shared-policy-editor
description: Use when editing AGENTS.md, CLAUDE.md, Codex skills, hooks, workflow policy, or shared agent instructions where minimal vendor-neutral changes matter.
---

# Shared Policy Editor

Use this when editing shared instructions, skills, hooks, agent policy, or workflow guidance. The goal is a small durable rule, not a broad rewrite.

## Procedure

1. Read the current wording before proposing or editing.
2. Identify the smallest existing section that should own the change.
3. Prefer editing existing wording over adding a new section.
4. Keep host-specific details as examples unless the policy is explicitly host-specific.
5. Avoid duplicating rules already present elsewhere.
6. Surface ambiguity instead of silently resolving it with broad policy.
7. Keep the diff focused on the user's requested behavior.

## Review Checklist

- Does the change solve the stated problem directly?
- Did it avoid style-only churn?
- Did it preserve vendor-neutral wording where possible?
- Did it avoid adding model names, tools, or host details as hard requirements unless requested?
- Did it keep reviewer, planner, explorer, implementer, and critic responsibilities separate?
- Did it avoid changing unrelated instructions?

## Output

Summarize the actual policy change, the file touched, and any ambiguity that remains.
