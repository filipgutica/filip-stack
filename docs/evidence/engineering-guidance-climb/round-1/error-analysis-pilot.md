# Pilot error analysis: Workflow cost on the climb tasks

Scope: the 36 climb attempts; no holdout trace was opened. Lines cite `host-config/guidance/core.md` and the delivered skills, which match `plugins/workflow/skills/`.

## Headline

- The review loop is the main cost, not the root's own work.
  - Up to the call that spawns the reviewer, the Workflow root uses 1.22M tokens, which is 0.73× vanilla's whole run in the gate metric.
  - The reviewer child (1.45M) plus the root's review-induced work after the spawn (1.79M) is 65% of Workflow's 4.98M mean. The brief's 31% counts only the child.
- Duplicated test lines and review findings show no reliable Workflow advantage (§3); test volume does.
- In projection, only dropping the default subagent review gets under 1.3×. A fresh-context, one-round review reaches about 1.7×.

## Method

- Each `token_usage_record` in a `host-trace` is one model call. Its `total_tokens`, cached input included, goes to the action that the call emitted. The boundary is the call that emits `spawn_agent`.
- **Floor** means post-spawn work that vanilla also does: checks before the first post-review fix, the commit, and the final message. **Review-induced** means messages, follow-ups, waits, message-only wake-ups, ledger file writes, fixes, and the checks after them.
- Projections swap measured components and use the gate metric (vanilla 1.67M); the pipeline reproduces 2.75×.
- Review briefs are encrypted; their content is inferred from replies and narration.

## 1. Where the tokens go

| Arm | Root calls | Commands | Root tokens | Child tokens | Seconds |
| --- | --- | --- | --- | --- | --- |
| vanilla | 25.9 | 33.5 | 1.72M | none | 558 |
| superpowers | 39.9 | 48.4 | 3.35M | 0.74M | 669 |
| workflow-main | 41.2 | 47.2 | 3.53M | 1.45M (13.4 calls) | 750 |

| Workflow component, mean per attempt | Tokens | Share |
| --- | --- | --- |
| Root before spawn: explore, guidance, edit, test | 1.22M | 24% |
| Root after spawn, floor: checks 0.18, commit 0.17, final message 0.11, diff 0.05 | 0.51M | 10% |
| Root after spawn, review-induced: checks after fixes 0.45, coordination and waits 0.37, wake-ups 0.33, fixes 0.25, ledger file 0.22, other 0.17 | 1.79M | 36% |
| Child, first review round | 0.50M | 10% |
| Child, follow-up rounds | 0.95M | 19% |

- **Late calls are expensive:** about 107k input tokens each after the spawn.
- **Every child inherits the parent's history.** `spawn_agent` `fork_turns` defaults to `all`, so all 12 children started with 71k–111k tokens of history (mean 89k), including the 8 that omitted the argument.
- **Guidance carry costs about 0.45M (9%).**
  - In-scope reads total 21 KB, about 5k tokens: the engineering `SKILL.md`, two references, the test-audit `SKILL.md`, and `value-criteria.md`.
  - AGENTS.md adds 4.3k tokens to every base prompt.
  - Both ride about 54 calls (estimate: bytes ÷ 4.2, since batched `exec` calls mix reads).
- **Tests.** The Workflow root makes 16.6 test-runner invocations per attempt; vanilla makes 12.8.
  - Repeated full suites matter only in happy-dom r1.
  - There, three full reruns after unrelated timeouts cost 3.4M tokens after the review had passed.

## 2. Passages that drive the cost

| Passage | What it caused | Verdict |
| --- | --- | --- |
| engineering `SKILL.md:58` "…broad, ambiguous, security, public-contract, concurrency, or ownership risk"; `delegation-and-review.md:41` "Broad, … public-contract … warrants an adversarial reviewer" | Every feature adds public API, so 12/12 loaded the reference at call 1–2 and spawned a reviewer "as the engineering skill requires for a public API change". | Trigger too broad; drives about 65% |
| `delegation-and-review.md:3` "Continue independent work while agents run" | The root ran checks during review and sent the results by `send_message`; each message woke the child at more than 100k context. | Ceremony at this cost |
| `delegation-and-review.md:58` "Reuse the same reviewer for correction verification" | 11/12 ran follow-up rounds, costing 0.95M. Only 3/12 found new P2s. | High cost, marginal |
| `core.md:73` "the child receives only the brief" | False here: children inherit the history. That also undercuts the "in its own context" independence rule in `delegation-and-review.md:56`. | Factual error |
| `core.md:11-18` ledger | Written to `/tmp`, then rewritten 2–4 times: about 0.3M | Ceremony in this form |
| engineering `SKILL.md:54` "Read hygiene before … commits" | Loaded in 12/12; one line applies | Inline it |
| `core.md:89`; engineering `SKILL.md:56` (test-audit triggers) | `value-criteria.md` loaded in 12/12 | Earns its cost (§3) |

Out of scope, noted only:
- technical-writing was read in 11/12 attempts (its description is frozen);
- `cat ~/.agents/CODING_STANDARDS.md` ran in 12/12 attempts, though AGENTS.md already carries that file (the error was checked in one trace);
- `request_user_input_async` ran in 2/3 csstree attempts (`core.md:29`, "ask") in a non-interactive run.

## 3. What earns its cost

Premise corrections:
- **Duplicated test lines.** 252 of vanilla's 288 come from happy-dom r3. Without that attempt, vanilla has 36 and Workflow 46. One 34-line attempt can fail the incumbent's ≤46 gate, so the gate is fragile.
- **High and medium external findings.** Workflow has 9 and vanilla 8. Workflow is better only, possibly, on happy-dom (1 against 3).

Signals that hold:
- Workflow adds 31% fewer test lines, and fewer on every task:

  | Task | Workflow | Vanilla |
  | --- | --- | --- |
  | true-myth | 338 | 497 |
  | csstree | 274 | 328 |
  | adaptix | 227 | 368 |
  | happy-dom | 232 | 371 |

- Redundant added tests on adaptix: a mean of 11 against 19.
- The test-audit authoring gate (`test-audit/SKILL.md:23-49`) loaded before any test was written in true-myth r1 and csstree r3, and after the first test in adaptix r3. Keep it.

The reviewer made 27 first-round findings, in 10/12 attempts:
- **Preservation regressions.**
  - An existing fixture was edited so that complete `chain=None` configurations needed the new options. All 3 Workflow adaptix attempts did this, then reverted it after review. Two of three vanilla attempts shipped the same edit, and nothing flagged it.
  - Empty bodies rejected after shutdown (happy-dom r2, r3).
  - An accidental change from `Buffer[]` to `any[]`.
  - A circular import that the repository's own check catches (P1).
- **Lifecycle races.** A Node stream wrote into a closed controller (happy-dom r1, r3). In r2 this went uncaught, and the external reviewer flagged it as P1.
- **Generality beyond the prompt.** Forked grammars in csstree, which the external reviewer still flags afterward.

Most preservation catches enforce skipped steps: `SKILL.md:18` and `SKILL.md:22`.

## 4. Failures and near-misses

| Attempt | What happened | Preventing behavior |
| --- | --- | --- |
| vanilla adaptix r3 (fail, 43/44) | The new check raises `ValueError`. Every sibling check in that function raises `CannotProvide`, and the hidden test expects the provider error. | New failure paths reuse the error type and channel of their sibling checks. |
| superpowers csstree r3 (fail) | Emitted components in iteration order, not canonical order | Take output order from the owning definition. |
| vanilla adaptix r1, r2; Workflow before review | Edited an existing fixture to fit new mandatory options | Treat an edit to a pre-existing test or fixture as a contract change that needs evidence. |
| Workflow happy-dom r3 | Only the reviewer ran the circular-dependency check. | Run the repository's declared checks before finishing. |
| Workflow happy-dom r1 | Three full-suite reruns after unrelated timeouts | Classify the failure first (`testing-and-debugging.md:34-40`, loaded in only 4/12 attempts) and rerun only the failed files. |

## 5. Hypotheses

| # | Edit | Evidence | Gate ratio | Quality risk |
| --- | --- | --- | --- | --- |
| H1 One review round | Exempt reviews from `delegation-and-review.md:3`. Replace `:58`'s reuse sentence: run final checks before spawning and put the results in the brief; send no mid-review messages; verify fixes with regression tests; re-review only P0/P1 fixes or contract changes. | Follow-ups cost 0.95M in the child, plus 0.70M of root waits and wake-ups. | 1.86× | Loses 4 late P2s in 3/12 |
| H2 Fresh-context reviewer, with H1 | Correct `core.md:73`: a forked child inherits your history. Start reviewers without it (`fork_turns: "none"`), using a self-contained brief. Drop the child's re-reads of guidance the brief already states. | 89k tokens inherited; a fresh first round estimated at 0.18M against 0.50M | 1.73×; 1.50× if fix work halves | The reviewer lacks the author's intent. |
| H3 Narrow trigger | In `SKILL.md:58` and `delegation-and-review.md:41`, keep only data integrity, migration, security, and hard-to-reverse changes as subagent triggers. Make step 9 (`SKILL.md:22`) a concrete in-thread self-check: edited pre-existing tests or fixtures, loosened types, error types that differ from sibling checks, cancellation, teardown, and ordering paths, and declared repository checks not yet run (+2 lines). | Review ran in 12/12, external findings are no better, and most catches are preservation checks. | 1.02× with no review; about 1.08× with the self-check. If concurrency still triggers a review under H1 and H2: 1.38× on happy-dom alone, 1.42× with true-myth too, which also cites concurrency. | Highest: this gives up the happy-dom-style lifecycle P1s. |
| H4 Ledger once | Condense `core.md:11-18` to three lines: report the simpler alternative, the scope, and each added test's purpose in the final message, with no file and no rewrites. | About 0.3M and 2.7 calls; written after the tests | −0.1× to −0.2× alone; about −0.05× on top of H3 | Unverified whether the ledger prunes tests |
| H5 Prune carry | Inline the commit line from the hygiene reference at `SKILL.md:54`, and drop that load. Cut the task-boundary and recovery parts of `delegation-and-review.md`, which single-thread work never uses. | Loaded in 12/12; about 1.5k tokens over about 54 calls | About −0.05× | Low; a Prune-rule win |

The ratios do not add up: H1–H3 already drop the post-spawn ledger writes.

Recommended candidate: H3, H4, and H5, with H1 and H2 for the remaining triggers (about 6 added lines). This is the only projection under 1.3×, and it needs no subagent review on any of these four tasks. Keeping concurrency as a trigger projects to about 1.4×, which fails gate 2.

Projections assume unchanged pre-spawn behavior. The internal review's benefit shows in neither correctness nor external findings, so H3's risk falls mainly on lifecycle and concurrency tasks.
