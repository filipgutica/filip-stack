---
related: [merge-council]
---

## What it does

Each member receives the same question in a separate context, without the
other members' answers. Your agent checks consequential claims and weighs
the reasoning, keeping disagreements visible.

## When to use it

Install the skill with the command above, then ask for a council on a
question, decision, plan, design, document, or code. The request selects the
skill; no special command is required. For example:

> Council: should we cache these API responses in Redis or in the browser?

You can set the members, goal, and criteria. Otherwise a separate designer
agent designs the council, so your agent never picks the judges for its own
question. The designer starts from the default members: GPT-6 Astra,
GPT-6.1 Sol, Claude Opus 5.5, and Claude Fable 5.2, all at high reasoning
effort. Members can take a lens, such as security or user experience. Your
host must be able to reach the requested models and effort settings.

> Council with a security lens and a UX lens: should the login form remember
> the email address?

For a PR review with a merge verdict, use [merge-council](../merge-council/).

## How it works

The agent frames the question, context, constraints, and criteria without
including its preferred answer. The designer can send questions back to you
first when the answer would change the design. Members read and advise; they return a
recommendation, supporting reasons, the strongest objection or alternative,
and material uncertainties.

Before launch, the agent checks model availability and states the design.
If a member you named is unavailable, it asks whether to change the lineup or
proceed with fewer members. If the designer chose the member, the agent uses a
comparable model or drops that member, and reports the change. It never
silently substitutes a model. A failure after launch leaves the council
incomplete, with completed opinions retained.

One round is the default. Another needs your request or a specific unresolved
question within the task's scope.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis contract.

## What you get

- A recommendation and its rationale.
- Each position attributed to the model that actually ran.
- Agreement, disagreement, and uncertainty that affect the decision.
- The next action, including any decision you need to make.
- A report in `~/.council/reports/` with each member's position, confidence
  score, and strongest objection for every round.

Council advice does not authorize edits, publication, or merging.
