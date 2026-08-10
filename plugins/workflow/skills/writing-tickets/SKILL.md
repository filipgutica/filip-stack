---
name: writing-tickets
description: Use when drafting, rewriting, enriching, or reviewing engineering Jira tickets, implementation tickets, backlog items, acceptance criteria, rollout steps, or repository-specific work instructions.
---

# Writing Tickets

## Principle

Write the smallest ticket that lets an engineer complete the required work correctly. Every instruction must be necessary, evidenced, and unambiguous. Named repositories define investigation scope; they do not prove that each needs a change.

## Workflow

1. Confirm the outcome, compatibility constraints, scope boundaries, and selected design. Confirm authorization only before editing a live ticket.
2. Read the current ticket and inspect the relevant code, PRs, or documentation. Preserve user revisions and exact contract names.
3. Inspect enough of the current behavior to substantiate each instruction. Trace end to end only when ownership or flow is unclear. Do not infer work from naming symmetry, architectural preference, or nearby code.
4. For each proposed instruction, identify its evidence, required outcome, owner, necessity, and completion signal. Treat unverified user-supplied claims as assumptions, not proof of current behavior.
5. Remove anything unsupported or unnecessary to the ticket's required outcome.
6. Select the ticket type, draft with the matching template below, run the critic pass, and revise until it passes.
7. Edit a live ticket only when authorized. If asked to review, report without editing.

## Execution-ready gate

Before drafting implementation steps, verify the current location, behavior, and owner for each proposed change. If any is missing, return an **Evidence needed before this is execution-ready** brief containing only confirmed decisions and missing evidence. Do not disguise `identify`, `inspect`, or `confirm` tasks as implementation work. For an explicitly requested discovery ticket, make the evidence or decision its deliverable.

## Ticket templates

Use the matching template and keep its sections in the listed order. Do not combine Story and Bug templates unless the user explicitly requests it.

Render every template section as an exact level-two Markdown heading (`## Section name`), never as a bold inline label. In **Observed behaviour**, use a numbered list for two or more sequential reproduction steps; prose is fine for a single-step observation. In **Suspected root cause**, use a bulleted list for more than one contributing fact; one fact can stay as a sentence. In **Testing**, use a bulleted list for more than one verification item; one item can stay as a sentence. Apply the **Code references** rules below within both prose and lists.

### Story

- `## Goal` — one short outcome statement.
- `## Work` — one item per proven, independently owned deliverable. State what changes, where, and how to verify it.
- `## Acceptance criteria` — observable outcomes, not repeated implementation steps.
- `## Non-goals` — only likely sources of scope drift.
- `## Testing` — follow explicit testing constraints. Otherwise, update coverage in proportion to changed behavior and risk.

### Bug

- `## Observed behaviour` — state what happens, including concise reproduction steps when they are known.
- `## Environment` — state where the bug was observed, including relevant deployment, feature flag, browser, or version details when verified.
- `## Slack thread` — include the relevant thread when one is available. Omit this section when there is no thread.
- `## Suspected root cause` — explain the evidence-backed hypothesis. Clearly distinguish suspected causes from confirmed causes. Include a verified GitHub file link on the first reference to each code entity.
- `## Proposed fix` — state the evidence-backed change when one is known. Omit this section when there is no proposed fix.
- `## Testing` — require focused regression coverage that reproduces the bug and verifies the corrected behaviour.

State each requirement once. Use one requirement per sentence and consistent terminology. Keep rejected or unresolved alternatives outside an execution-ready ticket.

## Code references

When ticket text references code, the first reference to each file, component, test, symbol, or source location must link to the file on GitHub. Link every filename or file path occurrence. Copy the verified repository URL, owner, repository name, branch or commit, path, and any line anchors exactly; do not infer or rewrite them. Include line anchors only when they were verified. After linking a code reference once, use the component, symbol, or behavior name without repeating the filename when another link would add no value. Never put local filesystem paths in a ticket. If the GitHub location cannot be verified, gather the missing evidence or omit the code reference instead of inventing a link.

## Critic pass

Review the draft using this exact lens:

> Could an engineer follow every instruction literally without confusion or extra unnecessary work?

For every instruction, ask:

- **Evidence:** Is current behavior supported by inspected evidence? Are the location and owner verified for assigned changes? Does the first reference to each code entity, and every filename or file path occurrence, include a verified GitHub file link? Are unverified claims labeled as assumptions?
- **Necessity:** Which required outcome or testing expectation fails if it is omitted?
- **Clarity:** Does it have one reasonable interpretation?
- **Ownership:** Does the named component own the behavior?
- **Consistency:** Does it preserve the selected design and terminology?
- **Duplication:** Is it stated elsewhere?
- **Scope:** Is it required work rather than cleanup or future-proofing?
- **Verification:** Is completion observable without unrelated testing?
- **Formatting:** Does every template section use an exact `##` heading, and are multi-step observations, multi-fact suspected root causes, and multi-item testing instructions rendered as the required lists?

Delete unsupported or repeated instructions. Rewrite confusing ones as short outcome statements. Put unresolved questions outside the work list. When independent review is available, give the critic the draft and inspected evidence without coaching it toward the writer's conclusions.

## Red flags

Revise when the ticket:

- assigns work without inspected evidence;
- assigns changes to every repository named in the request;
- presents alternatives after a design was selected;
- repeats constraints across sections;
- treats consistency with another system as proof of necessity;
- mixes investigation, implementation, rollout, and acceptance;
- broadens tests beyond changed behavior;
- uses the wrong template or changes its section order;
- omits a verified GitHub file link from the first reference to a code entity or from any filename or file path occurrence, or uses a local filesystem path;
- changes user-authored text outside the requested scope.
