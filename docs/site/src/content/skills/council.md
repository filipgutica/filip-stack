---
related: [full-send, full-stop, hill-climb]
---

## What it does

Give a council a question, a plan, or a request for a proposal. Several
different AI models each answer it separately. Your agent checks their
important claims, compares their reasoning, and gives you one recommendation
that shows where the models disagree. With [full-send](../full-send/) or
[full-stop](../full-stop/), the council scores a PR instead and returns a pass
or fail verdict. Other skills, such as [hill-climb](../hill-climb/), can also
call a council and decide the outcome themselves. Every run saves a report of
each model's view.

## When to use it

Use a council for a hard-to-reverse choice, a plan to test before coding, or a
PR to gate before merge. It needs at least two available models.

**Ask a question.** Start with "Council":

> Council: should we cache these API responses in Redis or in the browser?

**Review a plan.** Paste or link a plan, or ask for thoughts so your agent or
a planner drafts one first. Members list issues (**findings**) ranked by
severity with fixes, without scores.

> Council: review this plan for moving sessions to Redis. (Paste the plan or
> link it.)

> Council thoughts: how should we add rate limiting to the public API?

**Gate a PR.** Add a score **threshold** (0 to 10) to
[full-send](../full-send/) or [full-stop](../full-stop/) to run a merge
**gate**. Full send merges only on a pass. Full stop leaves the merge to you.

> /full-stop fix the flaky login test council 9.5

In Claude, a skill command works only at the start of a message, so write
`council 9.5` as plain text. In Codex, you can write
`$full-stop fix the flaky login test $council 9.5`. A bare `council` defaults
to 9.5.

## How it works

**Who takes part.** Each AI model on the panel is a **member**. The default
lineup runs three models at high effort:

| Member | Model | Provider (T3 Code) |
| --- | --- | --- |
| Sol 6.2 | `gpt-6.2-sol` | Codex |
| Opus 5.5 | `claude-opus-5-5` | Claude |
| Gemini 4 Neon | `gemini-4-neon` | Antigravity |

On other hosts, subagent tools must reach the models and effort for the chosen
lineup. A standalone council can drop an unavailable default member if at
least two remain. Fable 5.2 (`claude-fable-5-2`, high effort) is the
**arbiter**, a tie-breaking model that rules when members disagree. It is not
a default member.

When you name no members, a read-only **designer** agent (Opus 5.5 at high
effort, or Sol 6.2) frames the council so your agent cannot slant its
question. If neither can run, your agent frames it from your request and says
so. The designer sets the goal, criteria, optional **lenses** (focus areas
such as security), and **rounds** (passes, at most three when designer-set).
To set any yourself, name them:

> Council of Sol and Opus: should we split the billing service now or after
> the migration?

**On its own:**

1. **Frame and confirm.** The designer frames criteria and rounds if you named
   no members, asking when intent is unclear. Your agent omits its own answer
   on open questions and states the lineup. It asks if a named member is
   unavailable, or drops an unavailable default member and says so.
2. **Collect independent answers.** Members run in parallel in separate
   read-only contexts. Each returns a recommendation, evidence, its strongest
   objection, and doubts, plus ranked findings for a plan.
3. **Revise across rounds.** A council runs one round by default. With
   multiple rounds on your agent's draft, your agent revises between rounds
   and sends earlier findings marked fixed, declined, or open.
4. **Arbitrate and synthesize.** On conflicting recommendations, Fable 5.2
   rules from positions and evidence. Your agent checks key claims and
   summarizes with dissent visible. If Fable 5.2 cannot run or sits on the
   panel, you decide.

If a member fails after launch, your agent keeps completed answers and marks
the council incomplete.

**With full-send or full-stop:**

1. **Score the PR.** In fix mode, scoring starts once proof covers the diff,
   the branch is up to date, required checks pass, and review bots finish on
   that head. In review-only mode, the panel scores the current head once,
   even if behind, and reports findings without pushing or editing the PR
   description. Members score 0 to 10 without seeing the threshold or past
   scores. No designer runs, and your agent asks before dropping an
   unavailable member.
2. **Apply caps and fix findings.** A blocker caps a score at 6, and a
   should-fix finding caps it at 8.9. Thresholds at or below 9.5 run as 9.5,
   and thresholds above 9.5 also require fixing in-scope nits. In fix mode,
   your agent fixes agreed findings, pushes, and starts a new round, voiding
   earlier scores.
3. **Arbitrate disputes.** Fable 5.2 rules on
   [eligible disputes](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-arbiter.md)
   from the evidence alone when at least one member meets the threshold on the
   current head. It cannot arbitrate if it sits on the panel.
4. **Pass or fail.** The gate passes when every member meets the threshold or
   is cleared by Fable 5.2, with no open blocker, should-fix finding, or
   undecided instruction-file change. A below-threshold member is cleared only
   if it reported at least one finding and Fable 5.2 overruled all of them (a
   nit or unruled finding still counts). The gate fails after three scored
   rounds without a pass, or earlier if progress stalls or fixes exceed the
   diff limit. On failure, your agent leaves the PR unmerged and asks once to
   accept the scores, allow more rounds, or rescope.

Council's
[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/council/SKILL.md)
has the exact model-selection and synthesis rules. Full send's
[council gate](https://github.com/filipgutica/filip-stack/blob/main/skills/full-send/references/council-gate.md)
has the exact scoring and stop rules.

## What you get

**On its own:**

- A recommendation and rationale, including Fable 5.2's ruling if it ran.
- Each member's position, credited to the model that actually ran.
- Agreements, disagreements, and doubts that affect the decision.
- The next action, including any decision you must make.
- A linked report of each round's positions, findings, objections, and arbiter
  rulings, in a temporary folder unless you give a path.

**With full-send or full-stop:**

- A pass or `FAIL: council <lowest>/<threshold> after <rounds> rounds`.
- Each member's score per round and any arbiter rulings in the council report,
  plus a collapsed section at the end of the PR description in fix mode.

Council advice does not authorize edits, publishing, or merging.
