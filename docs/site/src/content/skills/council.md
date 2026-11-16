---
related: [full-send, full-stop, hill-climb]
---

## What it does

No member sees another member's answer. Your agent then checks the important
claims, weighs the reasoning, and keeps disagreement visible instead of
averaging it away.

## When to use it

Use a council when one model's view is not enough: a choice that is costly to
reverse, a plan you want tested before work starts, or a PR you want several
models to approve. You can use it in three ways.

To ask a question, start with "Council":

> Council: should we cache these API responses in Redis or in the browser?

Each member gives its own recommendation and how confident it is.

To score a plan, give the council the plan, or ask for its thoughts on work
to do. When you give no plan, your agent, or a planner agent, drafts one
first. Members score the plan from 0 to 10 and say what would raise the
score.

> Council: score this plan for moving sessions to Redis. (Paste the plan or
> link it.)

> Council thoughts: how should we add rate limiting to the public API?

To gate a PR, add a score threshold to [full-send](../full-send/) or
[full-stop](../full-stop/). The agent keeps working on the PR until every
council member scores it at or above the threshold. Full send merges only
then. Full stop reports the PR as ready only then, and leaves the merge to
you.

> /full-stop fix the flaky login test council 9.5

In Claude, a skill command works only at the start of a message, so write
the threshold as plain text. In Codex, you can write
`$full-stop fix the flaky login test $council 9.5`. Both forms start the
gate.

The default members mix OpenAI and Claude models, all at high reasoning
effort. The council works best when your agent can run both: in T3 Code, set
up the Codex and Claude providers, and on another host, its subagents must
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

## How it works

On its own:

1. The agent writes the question, context, and criteria. For a plan, it
   adds your plan or drafts one. For an open question, it leaves out its
   own answer.
2. It states the lineup before launch. If a member you named is
   unavailable, it asks you. If the designer chose that member, the agent
   swaps in a comparable model or drops it, and says so.
3. Each member answers separately with its reasons, its strongest
   objection, what it is unsure about, and a score from 0 to 10. For a plan,
   the score rates the plan. For an open question, it is the member's
   confidence.
4. The agent checks the important claims and writes the synthesis.

A member that fails after launch makes the council incomplete, and the agent
keeps the answers it has. One round is the default. Another needs your
request or a specific open question.

With full send or full stop:

1. The agent makes the change, opens the PR, proves the change, and waits
   for green checks.
2. The `full` council reviews the PR, with no designer, so the agent never
   picks the judges of its own work. Each member scores merge readiness from
   0 to 10 and does not see the threshold or earlier scores. A blocking
   finding caps the score at 6 and a should-fix finding at 8.9, so only a PR
   with nits left can reach 9.5. A threshold below 9.5 runs as 9.5.
3. The agent fixes the findings, pushes, and starts a new round. A new
   commit voids every score, so all members score the same commit.
4. The gate passes when every member reaches the threshold on that commit.
5. After three rounds below the threshold, or when a round makes no
   progress or the diff grows past its scope, the gate fails. The agent leaves the PR unmerged and asks you
   once: accept the scores, allow more rounds, or rescope.

Council's
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis rules. Full send's
[council gate](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-gate.md)
has the exact gate rules.

## What you get

On its own:

- A recommendation and why.
- Each position, credited to the model that actually ran.
- The agreements, disagreements, and doubts that affect the decision.
- The next action, including any decision you must make.
- A per-round report of each member's position, score, and strongest
  objection, in a temporary folder unless you give a path.

With full send or full stop:

- A pass or `FAIL: council <lowest>/<threshold> after <rounds> rounds`.
- Each member's score per round, in a collapsed section at the end of the PR
  description.

Council advice does not authorize edits, publishing, or merging.
