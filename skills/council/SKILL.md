---
name: council
description: Gather independent opinions from Astra, Sol 6.1, and Opus 5.5 when the user asks for a council on a question, decision, plan, design, document, or code. An explicit merge council request belongs to merge-council.
---

# Council

Use three independent opinions to help answer the user's request. You coordinate and synthesize in the current thread.

## Frame the question

Give every member the same question, relevant context or artifact, constraints, and criteria for a useful answer. Preserve the user's uncertainty; omit your preferred answer. For changing artifacts, identify the version reviewed, such as commit SHAs and any uncommitted diff.

Council members advise read-only. A council request alone does not authorize implementation, publication, or merging.

## Convene

Use these defaults unless the user names different members:

| Member | Model | Effort |
| --- | --- | --- |
| Astra | `gpt-6-astra` | high |
| Sol 6.1 | `gpt-6.1-sol` | high |
| Opus 5.5 | `claude-opus-5-5` | high |

In T3 Code, resolve targets with `orchestrator_capabilities`, then use `delegate_task` for each member. Search for an omitted model before declaring it unavailable. Map effort through the model's advertised `target.options`. These defaults use two providers; three distinct providers are not required.

Elsewhere, use the host's subagent tools only when they can reach the requested models and effort. Before launching, report unavailable targets and ask whether to change the lineup or proceed with fewer members. Never silently substitute a model. If a member fails after launch, retain the completed opinions and label the council incomplete.

Launch the members in parallel with separate contexts and no access to each other's responses. Each brief includes:

- The shared question, context, constraints, and criteria.
- Read-only responsibility, permitted sources, and any relevant instruction files.
- A request for a recommendation, supporting evidence or reasoning, the strongest objection or alternative, and material uncertainties.
- A direction to do the work themselves without further delegation.

Follow the host's completion mechanism and collect every member's response before synthesis. One round is the default. Run another only when the user requests it or a specific unresolved question warrants it within the authorized task.

## Synthesize

Check consequential claims against available evidence. Weigh reasoning rather than counting votes; keep material dissent visible.

Return a concise answer with:

- The recommendation and its rationale.
- Each member's position, attributed to the model that actually ran.
- Useful agreement, disagreements, and uncertainties that affect the decision.
- The next action, including any decision the user must make.

Report missing members or unverified model settings beside the conclusion. Council advice remains tied to the question and artifacts supplied. Continue any separately authorized work under its existing constraints.
