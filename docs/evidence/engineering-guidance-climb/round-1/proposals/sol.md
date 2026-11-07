# Round 1 proposal (Sol 6.1)

## 1. Edits

Paths below are relative to `guidance/`. Evidence references `error-analysis-pilot.md` as **EA**. No files were changed.

### `host-config/guidance/core.md`

**1. Replace the written ledger with one final report.**

Current:

```markdown
5. **Prove your change follows these principles.** Before final verification of a code change, draft a ledger that names concrete code:
   - **Simpler version:** the smaller alternative you considered and the requested outcome it fails to deliver. A suggested approach is an option to beat, not a requirement.
   - **Readability:** the part of the diff a reviewer is most likely to misread, and how names, structure, or a comment make it clear.
   - **Scope:** production versus test lines changed, and each change outside the request with its reason.
   - **Reuse:** for each new function, helper, or component, the existing code you checked and why it does not fit.
   - **Coverage:** for each added test, the regression it catches and the existing test that misses it; for each removed test, the remaining test that fails when that behavior breaks, or the change that made its contract obsolete.

   Resolve what the ledger exposes within scope and rerun affected checks, then include the ledger in your report. Challenge my proposed approach when evidence supports a simpler one.
```

Replacement:

```markdown
5. **Prove your change follows these principles.** Check the final diff for simplicity, readability, scope, reuse, and test value; resolve issues and rerun affected checks.
   Report once in the final response: the smaller alternative and why it fails the contract, production versus test lines changed, each added test's regression and gap in existing coverage, and each removed test's remaining proof or obsolete contract. Keep this reasoning in-thread.
```

Evidence: EA §2 reports ledger files rewritten two to four times across incumbent attempts, costing approximately 0.3M tokens without established quality benefit.

**2. Correct the context-inheritance assumption.**

Current:

```text
the child receives only the brief, so state any read-only limit in it.
```

Replacement:

```text
hosts may also pass conversation history, so give each child a self-contained brief with explicit read-only limits.
```

Evidence: EA §1: all 12 incumbent reviewers inherited 71k–111k tokens of history.

### `plugins/workflow/skills/engineering/SKILL.md`

**3. Make required checks and failure classification explicit.**

Current:

```text
8. Rerun the same test and only the affected existing checks. Repeat or broaden verification when the changed code, an observed failure, or an unresolved risk justifies it.
```

Replacement:

```text
8. Rerun the same test and affected existing checks, including repository-required checks. Classify failures before editing or repeating checks; scope reruns to affected failures unless changed code or evidence warrants a broader run.
```

Evidence: EA §4: happy-dom incumbent r1 repeated full suites three times after unrelated timeouts; r3 left the circular-dependency check to its reviewer.

**4. Bring preservation and lifecycle inspection into the author’s thread.**

Current span within step 9:

```text
and test value. Simplify changed code if useful, preserving behavior;
```

Replacement:

```text
and test value. Verify evidence for changed pre-existing tests or fixtures, preserve type precision, and match new failure paths to sibling error types and channels. For changed lifecycle paths, trace cancellation, teardown, completion, and callback ordering, including empty or already-completed work and late events after disposal. Simplify changed code if useful, preserving behavior;
```

Evidence: `diffs/adaptix-name-mapping-aliases/vanilla-no-guidance-r3-reward0.patch:416` introduces `ValueError`; incumbent r1 uses `CannotProvide` for the corresponding failure.

**5. Inline ordinary commit guidance; load hygiene for PR work.**

Current:

```markdown
Read [hygiene](references/commit-and-pr-hygiene.md) before subtasks, commits, PRs.
```

Replacement:

```markdown
When commits are authorized, finish and verify each independently verifiable subtask, then commit its implementation, tests, and necessary documentation together. Read [hygiene](references/commit-and-pr-hygiene.md) before splitting or preparing PRs.
```

Evidence: EA §2: hygiene loaded in all 12 incumbent attempts, although only its commit instruction applied.

**6. Narrow the review pointer.**

Current:

```markdown
Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and for consequential, hard-to-reverse, broad, ambiguous, security, public-contract, concurrency, or ownership risk. Follow its review requirements and any user or repository requirements. Routine bounded changes can use focused checks and final diff inspection.
```

Replacement:

```markdown
Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, or for security-sensitive changes, data migrations, or risks of persistent data loss, corruption, or other hard-to-reverse effects. Honor user and repository review requirements; use focused checks and main-thread diff inspection for other changes.
```

Evidence: EA §2: the public-contract trigger caused separate review in all 12 incumbent attempts.

### `plugins/workflow/skills/engineering/references/delegation-and-review.md`

**7. Supply verification evidence before review starts.**

Current:

```text
Continue independent work while agents run.
```

Replacement:

```text
Continue independent work during delegated implementation. Start reviews after available checks finish; supply the results in the brief and wait for findings.
```

Evidence: EA §2: incumbent authors’ mid-review check messages woke reviewers with contexts exceeding 100k tokens.

**8. Align the actual review requirement with edit 6.**

Current:

```markdown
Scale independent review to risk and honor user or repository requirements:

- Routine bounded changes can use focused checks and main-thread diff inspection.
- Consequential changes, such as data-integrity, migration, or hard-to-reverse behavior, use a separate review context when available.
- Broad, ambiguous, security-sensitive, public-contract, concurrency, or ownership risk warrants an adversarial reviewer.
```

Replacement:

```text
Use a separate reviewer for security-sensitive changes, data migrations, or risks of persistent data loss, corruption, or other hard-to-reverse effects, and whenever the user or repository requires one. Use focused checks and main-thread diff inspection for other changes.
```

Evidence: EA §5 H3 projects approximately 1.08× with concrete self-checks; retaining concurrency-triggered review projects at least 1.38×.

**9. Request a fresh reviewer context.**

Current:

```text
Review is independent only when a reviewer that did not author the change inspected the actual change in its own context. Self-review, an unscoped approval, or a claim without an artifact does not qualify.
```

Replacement:

```text
Start independent reviewers with a self-contained brief and no inherited conversation history when the host supports it. Independence requires a reviewer that did not author the change to inspect the actual diff and contract; report the artifact and findings.
```

Evidence: EA §1: all 12 incumbent reviewers inherited the author’s history, averaging 89k tokens.

**10. Verify ordinary corrections locally.**

Current:

```text
Reuse the same reviewer for correction verification unless a fresh judgment is necessary.
```

Replacement:

```text
Verify corrections with focused regression checks; request another review only when a correction addresses a critical or high-severity issue or changes the reviewed contract.
```

Evidence: EA §§2–3: 11/12 incumbent attempts incurred follow-ups; only three attempts produced new P2 findings.

**11. Delete the redundant review reminder and its following blank line.**

Current:

```text
Advice and planning do not replace required review.
```

Replacement: **delete**.

Evidence: EA §2 records review in all 12 incumbent attempts; edit 8 already preserves explicitly required review.

## 2. Totals

Counts calculated through in-memory replacements against the supplied files.

| File | Added lines | Removed lines | Word change |
| --- | ---: | ---: | ---: |
| `core.md` | 3 | 9 | −103 |
| Engineering `SKILL.md` | 4 | 4 | +69 |
| `delegation-and-review.md` | 4 | 10 | +9 |
| **Total** | **11** | **23** | **−25** |

Removed lines include two blank lines. Word counts use whitespace-separated tokens. Unchanged scoped files contribute zero change. **29 added lines remain available for later rounds.**

## 3. Predicted effect

**Approximately 1.10× vanilla**, consistent with EA’s gate-adjusted H3 projection of 1.08×.

Component arithmetic, in millions:

- Remove reviewer `0.50 + 0.95` and review-induced author work `1.79`: **3.24M**.
- Retain author work `1.22 + 0.51`: **1.73M**.
- Allow `1.67 × (1.08 − 1.02) = 0.1002M` for self-checks.
- `(1.73 + 0.1002) / 1.67 = 1.096×`.

Component means differ from the gate’s aggregation; this is a projection. Ledger and reference savings are not subtracted again.

Keep test-audit unchanged. [Adaptix incumbent r1](/home/filip/code/pluginbench/runs/egc-20261106/round-1/bundle/diffs/adaptix-name-mapping-aliases/incumbent-workflow-main-r1-reward1.patch) adds 228 test lines versus [vanilla’s 370](/home/filip/code/pluginbench/runs/egc-20261106/round-1/bundle/diffs/adaptix-name-mapping-aliases/vanilla-no-guidance-r1-reward1.patch), while preserving the existing default fixture. True-myth incumbent r1 also reuses `traverse` for `sequence` and `filterMap` for `compact`, using discriminated argument tuples where vanilla uses casts. Preserve that design and typing guidance.

| Quality criterion | Expected effect |
| --- | --- |
| Ownership | Preserve owner-first repairs. |
| Leaky abstraction | Preserve boundary checks and type precision. |
| Over-abstraction | Preserve current-need requirement. |
| Simplicity | Preserve final simplification; strengthen lifecycle inspection. |
| Reuse | Preserve local reuse and sibling error conventions. |
| Extensibility | Preserve existing seams. |
| Overlap | Preserve production and test duplication checks. |
| Dead code | Preserve final inspection and configured analysis. |
| Test value | Preserve authoring gate and distinct-risk requirement. |
| Coverage | Preserve regression proof; strengthen lifecycle edge checks. |

Expect 11–12 correctness passes, but this is unmeasured. Mechanical targets remain ≤0.58 cognitive ratio, ≤10 hotspots, ≤4 dead-code findings, ≤46 duplicated test lines, and ≥99.6% coverage. Neither those gates nor eight blind-judge wins are established by this analysis.

## 4. Risks

- **1:** Shorter reporting may weaken concrete readability and reuse scrutiny.
- **2, 9:** A fresh reviewer loses author intent omitted from the brief.
- **3:** Incorrect failure classification could narrow verification prematurely.
- **4, 6, 8:** Self-inspection can miss lifecycle races. Lost independent value includes happy-dom’s closed-controller writes and empty-body preservation catches.
- **5:** Later hygiene loading may delay recognition of useful subtask boundaries.
- **7:** Waiting for review sacrifices some parallel progress.
- **10:** Local verification may miss late findings: EA reports four late P2s across three attempts.
- **11:** Removing repetition marginally reduces emphasis on mandatory review.

**Drop edit 5 first:** its savings are modest and it changes when delivery guidance is consulted. Retain the test-value gate. The review-trigger change carries the greatest correctness risk, but retaining ordinary concurrency review exceeds the projected token limit.