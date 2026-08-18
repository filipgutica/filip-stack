# ERD format

An engineering requirements document (ERD) lets another engineer pick up the listed work without re-deriving open decisions. Keep settled decisions and unresolved decisions distinct. Never let a gate resolution remain stale in another part of the ERD.

## Required structure

Copy these headings in this order:

```md
# <title>

## Metadata

| Field | Value |
|---|---|
| Status | Draft or Ready |
| Date | YYYY-MM-DD or TBD |
| Author | known value or TBD |
| Version | known value or TBD |
| Ticket | link or TBD |

## Intro

## Gates

## Context

## Threat Modeling

## Architectural Diagram and Data Flow

### Key design points

### Component changes

## Order of Operations / High Level Tasks

## Scalability, Cost Modeling, Failure Modes, and Robustness

## Open Questions
```

Use every section. State `None` when a section has no applicable content. Do not omit the section or invent content to fill it.

## Evidence discipline

Write each detail as one of these forms:

- a fact supported by the request, repository, or linked source
- a resolved decision with its source
- an unresolved Gate or Open Question
- `TBD`

Do not generate likely options, components, interfaces, behaviors, owners, tests, or non-goals. If the source does not provide gate options, write `Options: TBD`. If a component detail is unknown, keep the supported outcome and write `Verification signal: TBD pending Gate N`.

## Section contract

### Metadata

Use the current date for a new ERD. Preserve supported metadata when editing. Do not infer the author from Git configuration, create an initial version, or derive a ticket from a branch name.

Set `Ticket` to a Markdown link whose label includes the external system and verified parent ID. For example, use `[Jira MA-1234](https://example.atlassian.net/browse/MA-1234)` or `[GitHub #456](https://github.com/example/repository/issues/456)`. Use the verified external parent URL as the target. Write `TBD` until the parent exists and its ID and URL are verified. This link points from the local ERD to the external parent. Do not require the external parent to link back to the local file.

### Intro

Write one paragraph. State what the ERD covers and what prior ERD or pull request it builds on. State only supported non-goals. Write `Out of scope: TBD` when the source provides none. Use `TBD` for an unavailable prior-artifact link.

### Gates

Number every decision that blocks listed component work. State only supported options and any leadership or product leaning. Write `Options: TBD` when the source provides none. A leaning is not a resolution. Mark a resolved gate explicitly and name the selected option. If there are no gates, state `None`.

### Context

Use one subsection per gate. Explain the tension or tradeoff, the supported options, and the selected option or `Not yet settled`. Preserve resolved gate context so readers can understand why the decision was made.

### Threat Modeling

Name the risk categories considered, such as access control, data exposure, integrity, abuse, and availability. If a full assessment depends on a gate or missing evidence, state that it is deferred and name the dependency. Do not invent threats or claim an assessment is complete without evidence.

### Architectural Diagram and Data Flow

Provide the diagram link or `TBD`. Follow it with one paragraph that describes only the supported flow. Mark unknown steps as `TBD`.

Under **Key design points**, group decisions by concern rather than by file. Under **Component changes**, group concrete deliverables by repository. Use `TBD` for an unknown repository. Mark work as `pending Gate N` when blocked. Each deliverable must include its supported outcome and verification signal. Use `TBD pending Gate N` when the source does not support a detail.

### Order of Operations / High Level Tasks

Use a numbered, dependency-aware sequence. Cross-reference gate and task numbers. Keep the steps at component or outcome level. Do not turn them into a file-level plan.

### Scalability, Cost Modeling, Failure Modes, and Robustness

Use bold lead-ins for **Scalability**, **Cost Modeling**, **Failure Modes**, and **Robustness**. Write one paragraph for each. State `TBD` or the evidence needed when the topic cannot yet be assessed.

### Open Questions

Use a numbered list with a bold lead phrase. Include only questions that do not block Component changes. Move a blocking question to Gates.

## Gate propagation

When a gate resolves, update every reference to its number or name:

- the Gates summary
- its Context subsection
- each conditional Component changes entry
- Order of Operations
- Open Questions

Before resolution:

```md
Gate 2 (rendering approach): Choose client-side capture or server-side rendering.

**dashboard-renderer** (pending Gate 2): Add blob output if client-side capture is selected.
```

After resolution:

```md
Gate 2 (rendering approach) is resolved: use server-side rendering.

**New rendering service** (repo TBD): Reproduce pagination and branding. Verify the generated PDF against the approved fixtures.
**dashboard-renderer**: No changes are required for this milestone.
```

## Code pointers

Link every file reference to the exact Git ref that contains the code. Add a line number or range when known. After a pull request merges, replace feature-branch links with `blob/main/...` links and remove stale `unmerged` wording.

## Final proofreading

Proofread after the structure and facts are stable. Use active voice. Remove filler. Do not use semicolons or contractions. Split compound sentences when that improves clarity.

## Common mistakes

- Treating a leadership or product leaning as a settled gate.
- Updating a resolved gate in one section while leaving downstream work conditional.
- Filing an implementation blocker under Open Questions.
- Inventing metadata, repository names, interfaces, behavior, or code links.
- Adding plausible components, options, tests, or non-goals that the source does not support.
- Leaving feature-branch links or `unmerged` wording after a merge.
- Attempting a complete threat model before the decisions that define its scope resolve.
