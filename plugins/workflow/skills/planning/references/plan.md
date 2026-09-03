# Implementation plan guidance

Write a plan that another engineer can execute without rediscovering scope or ownership.

Use these headings in order:

```md
# <Title>

## Context
## Goal
## Non-goals
## Success criteria
## Bounded subtasks
## Files touched
## Verification commands
## Risks / assumptions / open questions
```

Start Context with the nearest durable source or `Source: Direct request`.

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
