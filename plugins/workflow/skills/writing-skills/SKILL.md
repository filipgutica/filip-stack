---
name: writing-skills
description: "Use when creating, changing, reviewing, or preparing an agent skill for distribution across Codex and Claude hosts."
---

# Writing skills

Create a focused skill that teaches reusable judgment or a repeatable workflow. Keep project-specific rules in project instructions.

## Workflow

1. Define concrete prompts that must and must not activate the skill.
2. Inspect current host metadata, plugin patterns, and related skills.
3. Classify the skill as routing, state-changing, technique, or reference guidance.
4. Select the evaluation level in [evaluations.md](references/evaluations.md).
5. Run the required baseline before writing a new routing or state-changing skill.
6. Create or update the smallest skill body and required resources.
7. Keep trigger conditions in the description. Keep the workflow in the body.
8. Add matching `agents/openai.yaml` metadata.
9. Run structural checks and the selected behavioral evaluations.
10. Revise only for observed gaps, unsafe behavior, or unclear retrieval.

Use progressive disclosure. Keep the main skill short. Put detailed methods, templates, or schemas in directly linked references.

Do not add a skill for a one-time solution or a mechanical rule that a validator can enforce better.

Read [upstream.md](references/upstream.md) for provenance and local adaptation decisions.
