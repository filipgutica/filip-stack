---
related: [full-send, full-stop, hill-climb]
---

## What it does

Your agent sends the same question to each member in a separate context,
so no member sees another's answer. It then checks the important claims,
weighs the reasoning, and keeps disagreement visible instead of averaging it
away.

## When to use it

Use a council when one model's view is not enough: a choice that is costly to
reverse, a plan you want tested before work starts, or a PR you want several
models to approve. You can use it in three ways.

To ask a question, start with "Council":

> Council: should we cache these API responses in Redis or in the browser?

Each member gives its own recommendation and what it is unsure about.

To review a plan, give the council the plan, or ask for its thoughts on work
to do. When you give no plan, your agent, or a planner agent, drafts one
first. Members rank their findings by severity and say what would fix each.
They give no score, because a number without a rubric means little.

> Council: review this plan for moving sessions to Redis. (Paste the plan or
> link it.)

> Council thoughts: how should we add rate limiting to the public API?

To gate a PR, add a score threshold to [full-send](../full-send/) or
[full-stop](../full-stop/). The agent keeps working on the PR until every
council member reaches the threshold, or every member below it holds only
findings the arbiter overruled. Full send merges only then. Full stop
reports the PR as ready only then, and leaves the merge to you.

> /full-stop fix the flaky login test council 9.5

In Claude, a skill command works only at the start of a message, so write
the threshold as plain text. In Codex, you can write
`$full-stop fix the flaky login test $council 9.5`. Both forms start the
gate.

The default members mix OpenAI, Claude, and Gemini models, all at high
effort. The council works best when your agent can run all three: in T3
Code, set up the Codex, Claude, and Antigravity providers, and on another
host, its subagents must run the models. A council needs at least two
members.

| Member | Model |
| --- | --- |
| Sol 6.2 | OpenAI's `gpt-6.2-sol` |
| Opus | Claude Opus 5.5 (`claude-opus-5-5`) |
| Neon | Google's Gemini 4 Neon (`gemini-4-neon`) |

Claude Fable 5.2 (`claude-fable-5-2`), also at high effort, is the arbiter
rather than a default member.

You don't have to choose members. When you name no members, a separate
designer agent (Opus 5.5) frames the goal, criteria, lenses, and rounds (up
to three, such as a council that reviews a plan, sees it revised, and
reviews it again), so your agent never frames its own question. To choose
yourself, name the members, goal, criteria, rounds, or lenses such as
security.

> Council of Sol and Opus: should we split the billing service now or after
> the migration?

## How it works

On its own:

1. The agent writes the question, context, and criteria. For a plan, it
   adds your plan or drafts one. For an open question, it leaves out its
   own answer.
2. It states the lineup before launch. If a member you named is unavailable,
   it asks you. If a default member is unavailable, such as Neon without the
   Antigravity provider, the agent drops it and says so.
3. Each member answers separately with its reasons, its strongest
   objection, and what it is unsure about. For a plan, it also ranks its
   findings by severity.
4. With more than one round, the agent revises its own draft between
   rounds, and members review it again.
5. When members recommend conflicting actions after the last round,
   Fable 5.2 reads their positions and evidence and rules.
   Its ruling becomes the recommendation, and dissent stays visible. If
   Fable cannot run, or you named it as a member, the disagreement is yours
   to decide.
6. The agent checks the important claims and writes the synthesis.

A member that fails after launch makes the council incomplete, and the agent
keeps the answers it has.

With full send or full stop:

1. The agent makes the change, opens the PR, proves the change, and waits
   for green checks.
2. The default lineup (Sol, Opus, and Neon) reviews the PR. There is no
   designer, so the same panel scores every round. Because the gate sets
   the lineup, if a member cannot run, such as Neon without the Antigravity
   provider, the agent asks you before going on without it. Each member
   scores merge readiness from 0 to 10 and does not see the threshold or
   earlier scores. A blocking finding caps the score at 6 and a should-fix
   finding at 8.9, so only a PR with nothing above a nit can reach 9.5. A
   threshold below 9.5 runs as 9.5.
3. The agent fixes the findings, pushes, and starts a new round. A new
   commit voids every score, so all members score the same commit.
4. When one member reaches the threshold and another stays below it,
   Fable 5.2 rules on the findings the panel cannot settle, such as a
   member stuck at 6 for two rounds while the others score 9.6. It sees
   the findings and both sides' evidence, not the scores. It upholds a
   finding, which the agent fixes, or overrules it, which stops it from
   holding the PR back.
5. The gate passes when every member reaches the threshold on that commit,
   or Fable overruled every finding that holds a member below it.
6. The gate fails after three rounds without a pass, or earlier, for
   example when a round makes no progress and no finding awaits Fable, or
   the diff grows past its scope.
   The agent leaves the PR unmerged and asks you once: accept the scores,
   allow more rounds, or rescope.

Council's
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis rules. Full send's
[council gate](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-gate.md)
has the exact gate rules.

## What you get

On its own:

- A recommendation and why, including the arbiter's ruling when one ran.
- Each position, credited to the model that actually ran.
- The agreements, disagreements, and doubts that affect the decision.
- The next action, including any decision you must make.
- A per-round report of each member's position, top findings, and strongest
  objection, plus any arbiter ruling, in a temporary folder unless you give
  a path.

With full send or full stop:

- A pass or `FAIL: council <lowest>/<threshold> after <rounds> rounds`.
- Each member's score per round and any arbiter rulings, in a collapsed
  section at the end of the PR description.

Council advice does not authorize edits, publishing, or merging.
