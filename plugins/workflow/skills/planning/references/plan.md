# Implementation plan guidance

Write a plan that another engineer can execute without rediscovering scope or ownership.

Identify the nearest durable source or the direct request. Scale detail to the change; a short linear change needs a short plan.

Each subtask must name:

- owned files or surface
- expected outcome
- narrow verification signal
- real dependency on another subtask
- material risk or decision

Use dependency order. Identify independent tasks only when they can run without shared writes or missing inputs. A short linear change needs a short list, not a graph.

Plan tests before production edits for new or corrected behavior. For behavior-preserving work, plan a passing baseline before the structural change. Use a deterministic validation or focused inspection for prose and mechanical configuration.

Prefer current helpers, modules, tools, and architecture. Do not add speculative abstractions, dependencies, compatibility layers, or unrelated cleanup.

Use actual repository commands. Do not invent package scripts or test paths. State an unverified command as an open item until repository evidence confirms it.

Planning authority does not authorize the edits described by the plan.

## Default structure

```md
# <Title>
## Context
<Nearest durable source, or Source: Direct request.>
## Goal
<Requested outcome.>
## Non-goals
<Relevant scope boundaries.>
## Success criteria
<Observable completion conditions.>
## Bounded subtasks
<Dependency-ordered steps, each with ownership, outcome, and verification.>
## Files touched
<Verified locations or surfaces, when useful.>
## Verification commands
<Actual project commands and the behavior each establishes.>
## Risks / assumptions / open questions
<Material uncertainty, dependencies, or decisions.>
```

- A short linear change needs a short ordered list. Omit empty sections, subject to required project structure.

## Example

Illustrative plan; substitute verified paths and commands when they are needed to execute real work.

```md
# Correct pagination offsets
## Context
Source: Direct request. Later pages repeat results from the first page.
## Goal
Return the requested page without repeating earlier results.
## Non-goals
Changing sort order or pagination parameters.
## Success criteria
The second page returns the expected IDs with no overlap with the first page.
## Bounded subtasks
1. Inspect the API pagination handler and its existing tests. Confirm where offset is lost and identify a focused reproduction.
2. Update that handler and the relevant regression coverage. Verify that the reproduction detects the original defect and passes with the correction.
3. Request consecutive pages from the local API with fixed fixture data. Confirm their IDs match the requested offsets.
## Risks / assumptions / open questions
Confirm that the existing query establishes deterministic ordering before editing.
```
