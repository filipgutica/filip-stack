# Round 1 proposal: engineering guidance climb (Critic)

I read every guidance file, the error analysis, the measures, and all 36 climb patches. No file was edited.

## Objections to the error analysis (strongest first)

1. **The cost does not come from the review step. It comes from what triggers it.** All four climb tasks add a public API, so the current trigger "public-contract … risk" fires on 12 of 12 attempts. The error analysis says that keeping concurrency as a trigger (with one fresh-context review round) projects to about 1.38× when only happy-dom triggers it. The gate uses each task's median, so a review in 2 of 3 attempts on a single task is enough to fail gate 2. The trigger has to depend on what cannot be undone after merge. Changes that touch shared code or are hard to classify cannot be the test. I also traced two more passages that still lead to a reviewer: `test-audit/SKILL.md:81-83` (test-audit loads in 12 of 12 attempts) and `delegation-and-review.md:3`.
2. **`core.md:73` is not a factual error.** The sentence describes `delegate_task` targets. The pilot reviewers used the native-profile route, and the sentence says nothing about that route. The fresh-context rule belongs in `delegation-and-review.md`.
3. **The `cat ~/.agents/CODING_STANDARDS.md` cost in 12 of 12 attempts comes from the harness.** `harness/build-version.mjs` inlines that file into AGENTS.md. The real `~/.codex/AGENTS.md` only points to it. Cutting `core.md:93` would tune the guidance to the benchmark, so I did not take that cost item.
4. **I reject H5's cut of the task-boundary and recovery sections.** They load only when the agent delegates, which is exactly when they are needed. Once the trigger is narrowed, cutting them saves nothing on the climb.
5. **The source of the test-volume advantage is inferred, not proven.** The reviewer's findings were about preservation, lifecycle, and generality, not about redundant tests. So the smaller test volume most likely comes from the agent's own authoring guidance. That guidance is the test-audit gate's question 3, `SKILL.md:44`, and the Coverage clause in `core.md`. I counted added test cases: the incumbent adds 175 and vanilla adds 281. For example, true-myth vanilla r1 has 7 separate `retryN` tests, and incumbent r1 covers the same ground in 3.

## 1. Edits

**E1. `host-config/guidance/core.md:11-18`**
Current:
```
5. **Prove your change follows these principles.** Before final verification of a code change, draft a ledger that names concrete code:
   - **Simpler version:** the smaller alternative you considered and the requested outcome it fails to deliver. A suggested approach is an option to beat, not a requirement.
   - **Readability:** the part of the diff a reviewer is most likely to misread, and how names, structure, or a comment make it clear.
   - **Scope:** production versus test lines changed, and each change outside the request with its reason.
   - **Reuse:** for each new function, helper, or component, the existing code you checked and why it does not fit.
   - **Coverage:** for each added test, the regression it catches and the existing test that misses it; for each removed test, the remaining test that fails when that behavior breaks, or the change that made its contract obsolete.

   Resolve what the ledger exposes within scope and rerun affected checks, then include the ledger in your report. Challenge my proposed approach when evidence supports a simpler one.
```
Replacement:
```
5. **Report the tradeoffs in your final message.** Name the simpler version you considered and the requested outcome it fails to deliver; production versus test lines changed, with the reason for each change outside the request; and, for each added test, the regression it catches and the existing test that misses it, or, for each removed test, the remaining test that fails when that behavior breaks.
   Challenge my proposed approach when evidence supports a simpler one.
```
Evidence: error analysis §2 says the ledger was "written to `/tmp`, then rewritten 2–4 times: about 0.3M." The Readability bullet shows no visible effect: production comment density is the same in both arms (true-myth incumbent r1 has 40 comment lines out of 331 production lines; vanilla r1 has 42 out of 394). Reuse repeats principle 4 and `SKILL.md:26`. The Coverage clause stays, because it is the only text about pruning tests that is in context from the first call.

**E2. `engineering/SKILL.md:22`**
Current:
```
9. Inspect the final diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value. Simplify changed code if useful, preserving behavior; rerun affected checks after edits. Stop when the contract passes and required checks and review gates pass.
```
Replacement:
```
9. Inspect the final diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value. In this thread, confirm that each edited pre-existing test or fixture has evidence that its contract changed, types stay at least as strict, new failure paths use the error type and channel of their sibling checks, and output order follows the owning definition.
   For each resource or pending operation the change creates, trace what happens when its owner is cancelled, closed, or torn down mid-operation, and cover a credible failure with a test. Run every check the repository declares, such as lint, type, and import-cycle rules, after the last edit.
   Simplify changed code if useful, preserving behavior; rerun affected checks after edits. Stop when the contract passes and required checks and review gates pass.
```
Evidence: `adaptix/vanilla-no-guidance-r3-reward0.patch:416` raises `ValueError`, where incumbent r1 raises `CannotProvide`. That mismatch was vanilla's only failure. `adaptix/vanilla-no-guidance-r1` adds `aliases={}, alias_style=()` to `DEFAULT_NAME_MAPPING` (an existing fixture). In happy-dom incumbent r3, only the reviewer ran the import-cycle check.

**E3. `engineering/SKILL.md:21`**
Current:
```
8. Rerun the same test and only the affected existing checks. Repeat or broaden verification when the changed code, an observed failure, or an unresolved risk justifies it.
```
Replacement:
```
8. Rerun the same test and only the affected existing checks. Broaden verification when the changed code or an unresolved risk justifies it. When a check fails, classify the failure as in [testing and debugging](references/testing-and-debugging.md#root-cause-investigation) before you rerun it; for an unrelated or environmental failure, rerun only the failed files.
```
Evidence: in happy-dom incumbent r1, three full-suite reruns after unrelated timeouts cost 3.4M tokens.

**E4. `engineering/SKILL.md:54`**
Current: `Read [hygiene](references/commit-and-pr-hygiene.md) before subtasks, commits, PRs.`
Replacement: `When commits are authorized, commit one coherent outcome with its tests and documentation. Read [hygiene](references/commit-and-pr-hygiene.md) before splitting work into subtasks, opening a PR, or babysitting one.`
Evidence: the hygiene reference loaded in 12 of 12 attempts, and only one of its lines applied (error analysis §2).

**E5. `engineering/SKILL.md:58`**
Current:
```
Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and for consequential, hard-to-reverse, broad, ambiguous, security, public-contract, concurrency, or ownership risk. Follow its review requirements and any user or repository requirements. Routine bounded changes can use focused checks and final diff inspection.
```
Replacement:
```
Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and before a change that is hard to undo after merge: persisted data or formats, migrations, security or authentication, releases or external writes, or removing or renaming a published API. Follow its review requirements and any user or repository requirements. Additive APIs, bounded refactors, and concurrency or lifecycle fixes use the step 9 checks in this thread.
```
Evidence: 12 of 12 attempts spawned a reviewer "as the engineering skill requires for a public API change" (error analysis §2).

**E6. `engineering/SKILL.md:60`**
Current: `Do not use review as a substitute for a blocked or failed test.`
Replacement: delete.
Evidence: no pilot attempt shows an effect from this line. `SKILL.md:64` ("Do not report unavailable evidence as passed") and `core.md:84` already cover blocked evidence.

**E7. `delegation-and-review.md:3`, last sentence**
Current: `Continue independent work while agents run.`
Replacement: `Continue independent work while workers run. Give a reviewer a finished diff, and wait for its report without sending it messages.`
Evidence: the agent sent mid-review messages, and each one woke the child at more than 100k tokens of context. Waits and wake-ups cost 0.70M in total (error analysis §1).

**E8. `delegation-and-review.md:39-41`**
Current:
```
- Routine bounded changes can use focused checks and main-thread diff inspection.
- Consequential changes, such as data-integrity, migration, or hard-to-reverse behavior, use a separate review context when available.
- Broad, ambiguous, security-sensitive, public-contract, concurrency, or ownership risk warrants an adversarial reviewer.
```
Replacement:
```
- Changes that are hard to undo after merge, such as persisted data or formats, migrations, security or authentication, releases or external writes, or removing or renaming a published API, use a separate reviewer when available.
- Other changes, including additive APIs and concurrency or lifecycle fixes, use Engineering's step 9 checks and main-thread diff inspection.
```
Evidence: same as E5. The external high and medium findings show no Workflow advantage (9 against vanilla's 8).

**E9. `delegation-and-review.md`, a new line inserted before line 45 (`Give the reviewer:`)**
Replacement (inserted): `Run the final checks before you start the reviewer, and put their results in the brief. Start the reviewer without your conversation history, such as `fork_turns: "none"` for Codex `spawn_agent`, and make the brief self-contained.`
Evidence: all 12 children inherited 71k to 111k tokens of history, which also breaks the "own context" independence rule at line 56.

**E10. `delegation-and-review.md:58`, last sentence**
Current: `Reuse the same reviewer for correction verification unless a fresh judgment is necessary.`
Replacement: `Verify fixes with checks or regression tests. Ask the same reviewer for a second round only for a fix to a high-severity finding or a fix that changes a contract.`
Evidence: 11 of 12 attempts ran follow-up rounds costing 0.95M, and only 3 of 12 found new P2s.

**E11. `test-audit/SKILL.md:81-83`**
Current:
```
6. After final audit edits, follow the existing independent review requirements
   in [delegation and review](../engineering/references/delegation-and-review.md).
   Include the focused test audit in that review assignment.
```
Replacement:
```
6. When [delegation and review](../engineering/references/delegation-and-review.md)
   requires an independent review, include the focused test audit in its brief.
```
Evidence: test-audit loaded in 12 of 12 attempts, and the current wording assumes a review always happens.

## 2. Totals

- **Lines, counted as a diff:** 15 added, 21 removed, net −6. Every replacement line counts as added.
- **Words:** the edited passages go from 465 to 584 words (+119). That is +1.5% over the 7,787 words in the scoped files. Most of the growth is in step 9.

## 3. Predicted effect

**Tokens**, using the error analysis's components:
- No subagent review: 1.02×.
- Plus the in-thread self-check (E2): about +0.06×.
- Ledger once (E1): about −0.05× on top of H3.
- Hygiene inline (E4): about −0.02×. I took only part of H5.
- E3 changes no median, because happy-dom r1 is the outlier.
- **Result: about 1.01×, range 0.95× to 1.15×**, or 1.6M to 1.9M tokens.
- **Headroom: about 0.4M under the 2.17M target.** A review in 1 of 3 attempts on a task barely moves that task's median. Reviews in 2 of 3 attempts on one task push the result to about 1.38× and fail gate 2.

**Quality**, by criterion:
- **Test value and duplicated test lines:** should hold. The test-audit gate, `SKILL.md:44`, and the Coverage clause are all kept.
- **Coverage:** neutral to slightly better on lifecycle paths, because of the new trace-and-test line.
- **Ownership and leaky abstraction:** neutral. The preservation catches move into step 9.
- **Simplicity, over-abstraction, and cognitive ratio:** neutral to slightly better, since fewer review-driven guard branches get added.
- **Dead code:** unchanged. Step 9 and the Fallow line are untouched.
- **Correctness:** at least 11 of 12 expected. The sibling-error-type check targets vanilla's only failure.

## 4. Risks, ranked

1. **E5 and E8: lifecycle bugs ship without a reviewer.**
   - The value lost is the happy-dom r1 and r3 catch: a Node stream writing into a closed controller.
   - In real work, async resource races go unreviewed. The E2 trace is the only safeguard, and even with review, incumbent r2 missed this bug.
   - Without the "broad" and "ambiguous" triggers, large cross-module refactors also lose review unless a user or repository requires it.
2. **E5: an agent may still read a behavior fix as hard to undo.** For example, pending reads that used to hang now reject. That would trigger a review and push gate 2 toward 1.38×.
3. **E2: risk to gate 3 metrics.**
   - "Cover a credible failure with a test" can add test lines. The duplicated-test-lines gate (≤46) is fragile: one 34-line attempt can break it.
   - The lifecycle item can lead to defensive branches, which raise the cognitive ratio (now 0.58) and the hotspot count (now 10).
4. **E1:** fewer prompts to search for reuse before adding a helper.
5. **E4:** multi-step work loads the per-subtask commit rules less often, so commits may get larger.
6. **E9:** `fork_turns` comes from the traces. I have not checked it against Codex documentation.

**Drop first:** the `fork_turns` clause in E9. It is unverified and does not affect any gate once the trigger is narrowed. E3 is next, since it changes no climb median.

All edited files are under `/home/filip/code/pluginbench/runs/egc-20261106/round-1/bundle/guidance/`. The harness file behind objection 3 is `/home/filip/.t3/worktrees/filip-stack/t3-a50a29c8/docs/evidence/engineering-guidance-climb/harness/build-version.mjs`.