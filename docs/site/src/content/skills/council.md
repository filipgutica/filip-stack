---
related: [merge-council]
---

## What it does

No member sees another member's answer. Your agent then checks the important
claims, weighs the reasoning, and keeps any disagreement visible instead of
averaging it away.

## When to use it

Before you install it, check that your agent can run both OpenAI and Claude
models. In T3 Code, that means both the Codex and Claude providers are set up.
On another host, its subagents must be able to run the models you ask for.

Ask for a council on a question, decision, plan, design, document, or code.
No special command is needed. For example:

> Council: should we cache these API responses in Redis or in the browser?

By default, a separate designer agent chooses the members, so your agent never
picks the judges for its own question. It starts from four models, all at high
reasoning effort:

| Member | Model |
| --- | --- |
| Astra | OpenAI's `gpt-6-astra` |
| Sol | OpenAI's `gpt-6.1-sol` |
| Opus | Claude Opus 5.5 (`claude-opus-5-5`) |
| Fable | Claude Fable 5.2 (`claude-fable-5-2`) |

You can set the members, goal, and criteria yourself, or give members a lens
such as security or user experience:

> Council with a security lens and a UX lens: should the login form remember
> the email address?

Or name a preset, which needs no designer. `pair` is Sol and Opus, for
everyday questions. `frontier` is Astra and Fable, for harder ones. `full` is
all four:

> Frontier council: should we split the billing service now or after the
> migration?

For a PR review with a merge verdict, use [merge-council](../merge-council/).

## How it works

The agent writes the question, context, and criteria without its own
preferred answer. The designer may ask you questions first. Each member
returns a recommendation, its reasons, the strongest objection, and what it
is unsure about.

Before launch, the agent checks which models are available and states the
lineup. If a member you named is unavailable, it asks you what to do. If the
designer chose that member, the agent uses a comparable model or drops it,
and says so. It never swaps a model silently. If a member fails after launch,
the council is reported as incomplete and keeps the answers it has.

One round is the default. Another round needs your request or a specific open
question.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis rules.

## What you get

- A recommendation and why.
- Each position, credited to the model that actually ran.
- The agreements, disagreements, and doubts that affect the decision.
- The next action, including any decision you must make.
- A report with each member's position, confidence, and strongest objection
  for every round. It goes to a temporary folder unless you give a path.

Council advice does not authorize edits, publishing, or merging.
