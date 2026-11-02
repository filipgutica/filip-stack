# Pillar 5: Review gates chosen by risk

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** A reviewer in a fresh context, which never saw the conversation, is
not swayed by the reasoning that produced the code [A1]. Limiting the
reviewer's tools to reading enforces that it cannot edit [A1]. A reviewer that
is asked to find problems always finds something. Fixing every finding adds
abstraction layers and tests for impossible cases, so the review prompt should
say what to skip [A1]. Codex recommends concise review rules and leaving
formatting and lint to CI [O2], and says Codex reviews every pull request at OpenAI, with review rules kept in a file that `AGENTS.md` points to [O3].

**Good looks like.**

- Anything a tool can check is a gate ([pillar 2](pillar-2-static-gates.md)), not a review angle.
- **Contract adherence** runs on every change: the diff against the spec or ticket.
- Other angles run when the diff carries their risk:

  | Angle | Trigger |
  | --- | --- |
  | Simplicity and reuse | A new abstraction, helper, or dependency |
  | Test value | Tests added, removed, or changed |
  | Security | Authentication, input handling, secrets, permissions |
  | Performance | Hot paths, queries, loops over unbounded data |
  | Coding standards | Rules no linter can express |

- The reviewer gets the spec and the diff, not the author's reasoning.
- Each finding is checked against the code before anyone fixes it. A findings-audit pass removes false positives and duplicates.
- A human approves the merge.

Example in this repository: `AGENTS.md` treats reviewer findings as
uncalibrated diagnostics, not a quality score.

**Audit check.**

- List each review angle and its trigger. Apart from contract adherence, which runs on every change, an angle that runs on every PR without a trigger is a finding.
- Check that reviewers are read-only and run in fresh context. Accept configuration as evidence (an agent definition with read-only tools, a CI job with read-only permissions); a request in prose is level 1.
- Check for a verification or triage step.
- Sample recent PRs: the share of findings acted on, and repeated human comments that should become a lint rule, a test, or a documented decision.

**Anti-patterns.** Every angle on every PR. Style review by a model. A reviewer
that shares the author's context. Fixing every finding.
