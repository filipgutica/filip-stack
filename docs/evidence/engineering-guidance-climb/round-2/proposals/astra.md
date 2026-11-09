# Round 2 proposal: Astra (gpt-6-astra, high)

Verbatim final message, 2026-11-07.

## 1. Edits

Propose the following candidate against `main`. Retain round 1's narrower review trigger and preservation checks; revise its verification, test-value, and reporting changes. Drop its other edits.

Paths below are relative to `guidance/` in the bundle. Trace citations identify the attempt and `stdout.jsonl` item; model-call counts come from `host-trace-0.jsonl`.

**1. `plugins/workflow/skills/engineering/SKILL.md` — replace the work sequence. R1 partially retained and revised.**

Current: steps 1–9 of "Work the change".

Replacement:

```markdown
1. Inspect Git state, the requested contract, its production owner, direct callers, and nearest tests. Batch independent reads, print relevant sections, and reuse unchanged evidence; expand inspection for a concrete unresolved question.
2. Define behavior to preserve and the simplest solution. For a bug, demonstrate the failure with a focused regression before fixing it; for a behavior-preserving refactor, establish passing owner-boundary coverage. For new behavior, add only coverage existing tests miss.
3. Make the smallest causal change at the owner. Preserve correct existing tests and fixtures unless repository evidence establishes a contract change. Keep types precise and match sibling error channels; reuse existing code before adding helpers.
4. Run affected checks and repository-required gates after editing. Reuse results whose inputs are unchanged. Classify failures before editing; investigate a suspected unrelated failure with a focused baseline comparison, then report unresolved evidence. Repeat or broaden checks only for changed inputs, a relevant failure, or a named unresolved risk; retain passing results from unaffected checks.
5. Inspect the final diff and affected callers for duplication, dead code, redundant state, needless indirection, and test value. For lifecycle changes, trace cancellation, teardown, and late events. Resolve concrete defects and rerun affected checks; finish when the contract and required gates pass, reporting blocked checks as incomplete.
```

Evidence: happy R1 `be910dc1ae678a16` rereads unchanged files in items 14–18 after 8–11; `7664ae7ccd0f8d7d` runs ten baseline retries in item 71. Vanilla adaptix r3's patch raises `ValueError` where main/r1 use `CannotProvide`.

**2. Same file — prune duplicated design guidance. New.** Delete the two paragraphs of "Keep the design small" that begin "Prefer existing local code" and "Keep one clear owner per responsibility".

Evidence: `diffs/adaptix-name-mapping-aliases/vanilla-no-guidance-r3-reward0.patch` already extends the existing structure-maker and loader owners; core principles 2 and 4 retain these requirements.

**3. Same file — strengthen test selection. R1 revised.**

Current: "Prefer extending existing cases over duplicating proof. Another test layer can protect a distinct risk. Dependency injection for clocks, network, or storage can support deterministic tests at real boundaries."

Replacement: "Extend existing cases and share setup at the owning boundary. Each additional case or parameter combination must catch a distinct credible regression; cover interactions when the behavior depends on them. Use dependency injection at real boundaries for deterministic tests."

Evidence: happy r1-candidate r2 uses 159 added test lines versus vanilla r3's 556; both patches still multiply shutdowns, owners, and methods.

**4. Same file — narrow the hygiene read. R1 revised.**

Current: "Read [hygiene](references/commit-and-pr-hygiene.md) before subtasks, commits, PRs."

Replacement: "For an authorized commit, stage only the verified outcome with its tests and documentation. Read [hygiene](references/commit-and-pr-hygiene.md) only when splitting work or preparing a PR."

Evidence: true R1 `5fd9bcae35a2e6fa`, model call 2, still reads hygiene despite round 1's attempted narrowing.

**5. Same file — narrow review activation. R1 retained, with step renumbered.**

Replacement: "Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and before a change that is hard to undo after merge: security or authentication, migrations, persisted data or formats, or removing or renaming a published API. Follow it and any user or repository review requirements. Other changes use step 5 checks."

Evidence: `activation-round-1.txt` records zero children in all 12 R1 attempts; `error-analysis-pilot.md` attributes 65% of main's mean cost to review and resulting work.

**6. `plugins/workflow/skills/engineering/references/delegation-and-review.md` — align review requirements. R1 revised.**

Replace the three "Routine bounded / Consequential / Broad" bullets with: "A change that is hard to undo after merge, such as security or authentication, migrations, persisted data or formats, or removing or renaming a published API, uses a separate adversarial reviewer when available. Other changes use Engineering's final diff inspection and focused checks."

Evidence: pilot happy r2 still shipped a lifecycle finding despite separate review (`error-analysis-pilot.md`, §3).

**7. `host-config/guidance/core.md` — replace principle 5. R1 revised.**

Replacement: "5. **Prove your change follows these principles.** During final diff inspection, resolve departures from principles 1–4 within scope. Report consequential tradeoffs, verification evidence, and remaining limits once in the final response."

Evidence: happy R1 `7664ae7ccd0f8d7d`, items 75–80, collects statistics and test names for its final coverage table.

**8. `plugins/workflow/skills/test-audit/SKILL.md` — bound pre-fix proof. New.**

Replacement for the "Bug regression tests must fail on the pre-fix code…" paragraph: "For each distinct bug, confirm one owner-boundary regression fails on the pre-fix code for the intended reason and passes after repair. Additional cases need a distinct risk; repeat pre-fix verification when a case targets a different failure or its causal assertion changes."

Evidence: happy R1 `be910dc1ae678a16`, items 59, 75 and 77, performs repeated baseline verification culminating in 117 failing cases.

**9. Same file — bound audit reading. New.**

Replacement for the "Before judging a candidate, read the complete test…" paragraph: "Read root and scoped `AGENTS.md` files, the complete candidate test, and the relevant production owner; reuse evidence already inspected. Follow callers, dependencies, overlapping tests, CI routing, or history to resolve a specific uncertainty about behavior or preservation."

Evidence: happy R1 `be910dc1ae678a16` loads test-audit in items 42–43, then rereads the production diff and test surface in items 49 and 52.

## 2. Totals

| File | Added lines | Removed lines | Word change |
| --- | ---: | ---: | ---: |
| Engineering skill | 8 | 16 | −54 |
| Delegation reference | 1 | 3 | +1 |
| Core principles | 1 | 8 | −143 |
| Test-audit skill | 2 | 8 | −5 |
| **Total** | **12** | **35** | **−201** |

## 3. Predicted effect

Conditional forecast: approximately 1.28× vanilla; low confidence. R1 median attempts (adaptix, csstree, happy, true): 2.680, 1.711, 5.745, 1.518M; observed calls 33, 26, 51, 22; projected 29, 21, 36, 20; context factors .97, .93, .90, .97 → 2.14M, 1.28×. Two additional happy calls would push it above 1.3×.

Fallback correction: every attempt executes one missing `~/.agents/CODING_STANDARDS.md` read; "two" counts `item.started` and `item.completed`. The cause is core's frozen coding-standards rule.

The comparison contradicts the brief's mechanical-pass claim: R1 has 106 versus 46 duplicated lines and 10 versus 9 findings. Redundant-test evidence favors R1, 9 versus 11, but covers only adaptix.

## 4. Risks

Reused evidence could miss changed dependencies; pruned design guidance could weaken ownership discipline; aggressive case selection could miss interactions; inline commit guidance could omit hygiene details; self-inspection could miss concurrency defects; removing the ledger reduces accountability; representative red proof could leave ineffective tests unnoticed; bounded reading could miss distant callers. Drop edit 8 first.
