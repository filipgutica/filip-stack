# Walkthrough presentation patterns

Use the smallest format that makes the current relationship clear.

## Source evidence

### Last completed agent turn

Use conversation evidence only to identify the claimed scope. Confirm the scope against the current repository state, commit, or diff.

If no reliable boundary remains, state that limit. Ask the user to select the working tree or a branch range.

### Working tree

Inspect staged, unstaged, and untracked files. State which states are present.

Do not claim that the agent created an unrelated or pre-existing change. Include each file in the coverage map.

### Branch

Use the base that the user provides. Otherwise, select a local upstream or default branch only when the evidence is unambiguous.

Compute and state the merge base. If several bases remain plausible, ask the user to select one.

Branch mode covers committed changes. Report separate working tree changes before the first slice.

## Visual selection

| Format | Use it for |
|---|---|
| Code snippet | Local logic, a condition, or a data shape |
| Inline diff | A small before-and-after behavior change |
| Table | Repeated mappings, contracts, or alternatives |
| Mermaid diagram | Data flow, control flow, sequence, ownership, or lifecycle |
| Plain prose | One fact or a simple decision |

Show only the lines needed for the point. Include a file link and line number when the host supports local links.

## Slice shape

Use this shape as a guide. Omit a field when it adds no value.

```text
Change: What changed and where
Behavior: What happens before and after
Decision: Why this approach was selected
Evidence: Code, diff, test, or contract
Risk: What could be brittle or ambiguous
Question: One focused checkpoint for the user
```

Do not turn these labels into a long report. Write a natural explanation around the evidence.

## Coverage map

Start with a compact table when the change has several files or concerns.

| Slice | Files | Purpose | State |
|---|---|---|---|
| Configuration | `config.ts`, `config.test.ts` | Add the selected backend | Pending |
| Documentation | `README.md` | Explain the public contract | Pending |

Update the state in conversation as the walkthrough proceeds. Do not copy the full map into the walkthrough log. Persist one curated record after the user resolves a slice.

## Review findings

When the user challenges a decision:

1. Restate the concern as a technical requirement.
2. Inspect the live code, tests, and contract.
3. Show the smallest decisive evidence.
4. Classify the concern.
5. Explain the effect on the remaining walkthrough.

Do not implement a valid finding inside the read-only walkthrough. If the user explicitly authorizes a correction, pause and use the authorized correction cycle in `SKILL.md`.
