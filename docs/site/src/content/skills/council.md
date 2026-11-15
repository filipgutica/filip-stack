---
related: [merge-council]
---

## What it does

No member sees another member's answer. Your agent then checks the important
claims, weighs the reasoning, and keeps disagreement visible instead of
averaging it away.

## When to use it

Ask for a council on a question, decision, plan, design, document, or code:

> Council: should we cache these API responses in Redis or in the browser?

The default members mix OpenAI and Claude models, all at high reasoning
effort, so the council works best when your agent can run both. In T3 Code,
set up the Codex and Claude providers; on another host, its subagents must
run the models. A council needs at least two members.

| Member | Model |
| --- | --- |
| Astra | OpenAI's `gpt-6-astra` |
| Sol | OpenAI's `gpt-6.1-sol` |
| Opus | Claude Opus 5.5 (`claude-opus-5-5`) |
| Fable | Claude Fable 5.2 (`claude-fable-5-2`) |

By default, a separate designer agent picks the members, so your agent never
picks the judges for its own question. You can instead set the members,
goal, criteria, or lenses such as security, or name a preset: `pair` is Sol
and Opus, `frontier` is Astra and Fable, and `full` is all four.

> Frontier council: should we split the billing service now or after the
> migration?

For a PR review with a merge verdict, use [merge-council](../merge-council/).

## How it works

The agent writes the question, context, and criteria without its own
preferred answer. Each member returns a recommendation, its reasons, the
strongest objection, and what it is unsure about.

Before launch, the agent states the lineup. If a member you named is
unavailable, it asks you; if the designer chose it, the agent swaps in a
comparable model or drops it, and says so. A member that fails after launch
makes the council incomplete, and it keeps the answers it has. One round is
the default.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis rules.

## What you get

- A recommendation and why.
- Each position, credited to the model that actually ran.
- The agreements, disagreements, and doubts that affect the decision.
- The next action, including any decision you must make.
- A per-round report of each member's position, confidence, and strongest
  objection, in a temporary folder unless you give a path.

Council advice does not authorize edits, publishing, or merging.
