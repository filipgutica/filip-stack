---
name: writing-tickets
description: Use when drafting, rewriting, enriching, or reviewing engineering Jira tickets, GitHub issues, implementation tickets, backlog items, acceptance criteria, rollout steps, or repository-specific work instructions.
---

# Writing Tickets

## Principle

Write the smallest ticket that lets an engineer complete the required work correctly. Every instruction must be necessary, evidenced, and unambiguous. Named repositories define investigation scope; they do not prove that each needs a change.

## Workflow

1. Confirm the outcome, compatibility constraints, scope boundaries, and selected design. Confirm authorization only before editing a live ticket.
2. Read the current ticket and inspect the relevant code, PRs, or documentation. Preserve user revisions and exact contract names.
3. Search the tracker for the correct parent, existing children, dependencies, and related tickets. Verify each ticket key, URL, and relationship direction.
4. Inspect enough of the current behavior to substantiate each instruction. Trace end to end only when ownership or flow is unclear. Do not infer work from naming symmetry, architectural preference, or nearby code.
5. For each proposed instruction, identify its evidence, required outcome, owner, necessity, and completion signal. Treat unverified user-supplied claims as assumptions, not proof of current behavior.
6. Remove anything unsupported or unnecessary to the ticket's required outcome.
7. Select the ticket type, draft with the matching template below, run the critic pass, and revise until it passes.
8. Edit a live ticket only when authorized. If asked to review, report without editing.

## Execution-ready gate

Before drafting implementation steps, verify the current location, behavior, and owner for each proposed change. If any is missing, return an **Evidence needed before this is execution-ready** brief containing only confirmed decisions and missing evidence. Do not disguise `identify`, `inspect`, or `confirm` tasks as implementation work. For an explicitly requested discovery ticket, make the evidence or decision its deliverable.

## Ticket hierarchy and relationships

Use the tracker hierarchy and relationship types supported by the target project.

- **External parent:** Use one tracker-supported parent for a decision-complete specification or ERD. Reuse a verified epic or parent issue. Draft one if none exists. After verification, prepare a metadata link with the system, ID, and URL. Require explicit external-artifact authority for the local source before changing its `Ticket` metadata. Without that authority, return the proposed link in the conversation. Do not require the external parent to link back to the local file.
- **Story or issue:** Put each independently reviewable outcome under the verified external parent when the tracker supports hierarchy. Do not create an orphan child when its specification or ERD has a parent.
- **Subtask:** Use a subtask for a bounded part of a complex story when it needs separate ownership, sequencing, or verification. Keep ordinary implementation steps in the parent story.
- **Relationships:** Link each relevant verified ticket that blocks or is blocked by the current ticket. Also link tickets that precede, follow, supersede, or are superseded by it. Link duplicates and material relations. Use the exact relationship and direction that the tracker supports.

Include each relevant ticket key and verified link in the draft. Verify the project, issue type, parent, and relationship direction before publication. If the correct parent or relationship is unclear, add it to the evidence gap instead of guessing.

Drafting a hierarchy or relationship does not grant authority to change the tracker. Create the parent, assign children, and add ticket links only with explicit publishing authority.

## Local ticket links

This section applies only to canonical local Markdown tickets. For a Jira or GitHub backend, the external issue is canonical. Do not create a mirrored local ticket file or local status.

Keep the stable local filename when a local Markdown ticket maps to external work. Do not add the external ID to the filename.

For a new local Markdown ticket, include the `topic` and `source` frontmatter from [Engineering Workflow storage](../setup/references/storage.md). Link `topic` to `../../TOPIC.md`. Use `Direct request` when the ticket is the first persisted work artifact. Use a relative link or verified HTTPS link for a durable source. A Jira or GitHub ticket must not link to a machine-local specification or plan.

Store each verified external ID and URL in the `externalLinks` frontmatter from [Engineering Workflow storage](../setup/references/storage.md). Do not add speculative links or external status.

The lifecycle directory remains the authoritative local status. An external link does not grant authority to create, update, or transition external work.

## Ticket templates

Use the matching template and keep its sections in the listed order. Do not combine ticket templates unless the user explicitly requests it.

Render every template section as an exact level-two Markdown heading (`## Section name`), never as a bold inline label. In **Observed behaviour**, use a numbered list for two or more sequential reproduction steps; prose is fine for a single-step observation. In **Suspected root cause**, use a bulleted list for more than one contributing fact; one fact can stay as a sentence. In **Testing**, use a bulleted list for more than one verification item; one item can stay as a sentence. Apply the **Code references** rules below within both prose and lists.

### Story

- `## Goal` — one short outcome statement.
- `## Work` — one item per proven, independently owned deliverable. State what changes, where, and how to verify it.
- `## Acceptance criteria` — observable outcomes, not repeated implementation steps.
- `## Non-goals` — only likely sources of scope drift.
- `## Testing` — follow explicit testing constraints. Otherwise, update coverage in proportion to changed behavior and risk.

### External parent

- `## Goal` — state the outcome shared by the child tickets.
- `## Children` — list the verified child tickets in dependency order.
- `## Acceptance criteria` — state the observable outcome that closes the parent.
- `## Non-goals` — only likely sources of scope drift.

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
- **Hierarchy:** Does the ticket use the correct project, issue type, and verified parent? Does a subtask need separate ownership, sequencing, or verification?
- **Relationships:** Are relevant tickets linked with verified keys, URLs, relationship types, and directions?
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
- creates a story outside its verified epic, or uses a subtask for an ordinary implementation step;
- omits a relevant verified ticket link, or invents a parent or relationship;
- omits a verified GitHub file link from the first reference to a code entity or from any filename or file path occurrence, or uses a local filesystem path;
- changes user-authored text outside the requested scope.
