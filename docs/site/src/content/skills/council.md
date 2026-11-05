---
related: [merge-council]
---

## What it does

One model can be confidently wrong. In a council, each member answers in its
own context, with no view of the others' answers, and your agent weighs the
reasoning instead of counting votes. The default members are:

| Member | Model |
| --- | --- |
| Astra | OpenAI's GPT-6 Astra |
| Sol 6.1 | OpenAI's GPT-6.1 Sol |
| Opus 5.5 | Anthropic's Claude Opus 5.5 |

All three run at high reasoning effort. You can name different members when
you ask.

## When to use it

Ask for a council when a question, decision, plan, design, document, or piece
of code deserves more than one opinion. For a pull request review that ends in
a merge verdict, use [merge-council](../merge-council/) instead.

Install it with the command above, then ask in plain words. An illustrative
request:

> Council: should we cache these API responses in Redis or in the browser?

## How it works

Your agent gives every member the same question, context, constraints, and
criteria for a useful answer, without its own preferred answer. Members only
read and advise. Each one returns a recommendation, its reasoning, the
strongest objection, and what it is unsure about.

Before it starts, your agent checks that it can reach each model. If one is
unavailable, it asks whether to change the lineup or go ahead with fewer, and
it never swaps in another model without telling you. If a member fails after
the start, the council is reported as incomplete.

A council runs one round by default. Another round runs only when you ask, or
when a specific question is still open.

## What you get

- A recommendation with its reasoning.
- Each member's position, named by the model that actually ran.
- Where the members agree and disagree, and what is still uncertain.
- The next step, including any decision you need to make.

A council's advice does not authorize edits, publishing, or merging.
