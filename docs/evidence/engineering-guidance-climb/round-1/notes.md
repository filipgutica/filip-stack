# Round 1 notes

Date: 2026-11-07.

## Inputs

- [Error analysis](error-analysis-pilot.md) of the 36 pilot attempts on the climb tasks.
- The [proposer brief](brief.md). Each proposer read the error analysis, the climb measures, every climb patch, and the scoped guidance.
- Three read-only proposals: [Astra](proposals/astra.md), [Sol 6.1](proposals/sol.md), and [Opus 5.5](proposals/opus.md).

## Candidate

[candidate.diff](candidate.diff) against `main`: 16 lines added and 26 removed. The scoped files go from 7,787 to 7,783 words, so the Prune rule applies.

What all three proposals agreed on, and the candidate takes:

- A subagent review starts only for a change that is hard to undo after merge: security or authentication, migrations, persisted data or formats, or removing or renaming a published API. Other changes, including additive APIs and concurrency fixes, use step 9 in the agent's own thread.
- Step 9 adds a concrete check in the agent's own thread: precise types, new failures raised the way sibling checks raise them, and cancellation, teardown, and late events for lifecycle changes.
- Step 5 covers fixtures as well as tests.
- Step 8 reruns repository-required checks, and after an unrelated failure only the failed files.
- The principle-5 ledger becomes one report in the final message. It keeps the simpler alternative, the scope, and the test-value record, and drops the readability and reuse items.
- The commit rule from the hygiene reference is inline; the reference loads only to split work or prepare a PR.
- A reviewer starts after the final checks, without the parent's conversation history where the host allows it. Fixes are re-reviewed only for high-severity findings or contract changes.
- Test-audit step 6 includes its audit in a review only when a review is required.

Choices that no proposal made, or that override one:

- **Word budget.** `tests/workflow/validate-contracts.mjs` limits the Workflow skill bodies other than Simplify to 3,500 words. The merged edits came to 3,587. To fit, the candidate:
  - shortens the step 8, step 9, hygiene, and review-pointer wording;
  - cuts "Record the reviewed change range and any version, seed, or environment detail needed to reproduce a result" from Finish;
  - cuts "Another test layer can protect a distinct risk";
  - drops "when commits are authorized" from the inline commit rule, because Finish keeps "Do not commit, push, publish, deploy, or modify external work without user authority".
- **Kept against Sol 6.1:** "Advice and planning do not replace required review". The contract validator requires it.
- **Kept against Astra and Sol 6.1:** the `core.md` line about what a delegated child receives. Opus showed that it describes `delegate_task` targets, not native subagents; the fresh-context rule goes in `delegation-and-review.md` instead.
- **Not taken:** the `fork_turns` parameter name, which no proposer checked against Codex documentation. The candidate says "without your conversation history when the host allows it".

## Incidents

- The error-analysis agent printed one dateutil measure and one holdout review-finding header while it probed `results.json`. It used neither and opened no holdout trace or attempt. Proposers saw no holdout data.
- The first round-1 launch stopped before any coding call: PluginBench rejects a baseline cache reached through a symlink. The failed launch is archived as `round-1-failed-1`.
  - Its no-coverage evaluation kept running after the coverage evaluation failed, because the command that stopped it matched its own shell. It was stopped together with the second launch.
- The second launch used a copied cache under `results/round-1/`, and every vanilla key missed.
  - PluginBench keys the vanilla cache on the prepared task image IDs. A new output parent prepares the images again under new IDs.
  - It was stopped after about 4 attempts had started, and is archived as `round-1-failed-2`. None of its attempts count.
- Round 1 now runs under `results/pilot/` with [harness/run-round.sh](../harness/run-round.sh), so it reuses the pilot's prepared images. All 9 vanilla entries hit the cache.

## Gate baselines

Gate 3 compares the candidate with the incumbent's figures on the four climb tasks only, not the six-task pilot totals.
