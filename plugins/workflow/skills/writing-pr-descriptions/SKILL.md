---
name: writing-pr-descriptions
description: "Use when drafting, rewriting, or updating a pull request description or PR body before creation or publication."
---

# Writing PR Descriptions

Write a concise PR description from the current diff, ticket context, and verified repository evidence.

## Workflow

1. Inspect the current diff and the source ticket or request.
2. Find the repository's active PR template before choosing a format.
3. Follow an explicit user format first. Otherwise, the repository template takes precedence.
4. If neither exists, read and use [default-format.md](references/default-format.md).
5. Preserve required headings, checklists, comments, links, and placeholders from the selected template.
6. State only changes and reasons supported by the diff or source context.
7. Run `$humanizer` as an internal editorial pass. Then run `$workflow:ste-writing` in strict mode.
8. Return or publish only the final PR body. Do not include the editorial audit.

## Content rules

- Keep the body short unless the repository template or user asks for more detail.
- Explain a non-obvious root cause when it helps a reviewer understand the change.
- Describe each material change and its reason. Do not narrate files or commits.
- Preserve ticket, issue, preview, screenshot, and related-PR links that help review the change.
- Do not invent a ticket, link, test result, risk, or reviewer instruction.
- Do not add a validation, testing, or checklist section unless the user or repository template requires it.
- Update stale framing when the PR scope changes.

The selected template controls the structure. Humanizer and STE can revise its prose but must not change its syntax or required fields.
