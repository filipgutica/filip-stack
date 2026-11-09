# Round 1 proposal (Astra)

## 1. Edits

Propose narrower review triggers, concrete in-thread preservation checks, and less review coordination. Preserve the test-audit authoring gate unchanged.

Paths below are relative to `bundle/guidance/`; evidence paths are relative to `bundle/`.

### A. `host-config/guidance/core.md`

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
5. **Prove your change follows these principles.** Resolve concrete departures from principles 1–4 during final diff inspection and rerun affected checks. Record the simpler alternative, production versus test scope, and each added or removed test's coverage justification once in the final report; reuse any required coverage record.
```

Evidence: `error-analysis-pilot.md`, §2 and H4, incumbent attempts: ledger files underwent 2–4 rewrites; estimated cost approximately 0.3M tokens, with unverified pruning benefit.

### B. `host-config/guidance/core.md`

Replace this exact fragment:

```text
the child receives only the brief, so state any read-only limit in it.
```

With:

```text
context inheritance depends on the host, so state any read-only limit in the brief.
```

Evidence: `error-analysis-pilot.md` §1: all 12 incumbent reviewer children inherited history, averaging 89k tokens.

### C. `plugins/workflow/skills/engineering/SKILL.md`

Current:

```markdown
8. Rerun the same test and only the affected existing checks. Repeat or broaden verification when the changed code, an observed failure, or an unresolved risk justifies it.
```

Replacement:

```markdown
8. Rerun the same test, affected checks, and repository-required checks. Classify any failure before choosing the next check; repeat or broaden verification only when changed code, a diagnosed failure, or an unresolved contract risk justifies it.
```

Evidence: `error-analysis-pilot.md` §4: happy-dom incumbent r1 repeatedly reran suites after unrelated timeouts; in r3 only the reviewer ran the circular-dependency check.

### D. `plugins/workflow/skills/engineering/SKILL.md`

Current:

```markdown
9. Inspect the final diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value. Simplify changed code if useful, preserving behavior; rerun affected checks after edits. Stop when the contract passes and required checks and review gates pass.
```

Replacement:

```markdown
9. Inspect the final diff and affected callers for accidental changes, duplication, dead code, redundant state or branches, needless indirection, and test value.
   Check edits to pre-existing tests or fixtures against the preserved contract, retain precise types, and match new failure paths to sibling error types and channels. Trace empty-input, cancellation, teardown, late-callback, and output-order paths at their owners; resolve uncovered risks with focused checks. Simplify changed code if useful, preserving behavior; rerun affected checks after edits. Stop when the contract passes and required checks and review gates pass.
```

Evidence: `diffs/adaptix-name-mapping-aliases/vanilla-no-guidance-r3-reward0.patch` raises `ValueError` for primary-key collisions; matched incumbent r3 uses `CannotProvide`.

### E. `plugins/workflow/skills/engineering/SKILL.md`

Current:

```markdown
Read [hygiene](references/commit-and-pr-hygiene.md) before subtasks, commits, PRs.
```

Replacement:

```markdown
When commits are authorized, finish, verify, and complete required review for each coherent subtask before committing it and starting dependent work. Read [hygiene](references/commit-and-pr-hygiene.md) when splitting work into multiple commits or PRs, or preparing or babysitting a PR.
```

Evidence: `error-analysis-pilot.md` §2: all 12 incumbent attempts loaded hygiene; only its commit instruction applied.

### F. `plugins/workflow/skills/engineering/SKILL.md`

Current:

```markdown
Read [delegation and review](references/delegation-and-review.md) before delegating, when checking review feedback, and for consequential, hard-to-reverse, broad, ambiguous, security, public-contract, concurrency, or ownership risk. Follow its review requirements and any user or repository requirements. Routine bounded changes can use focused checks and final diff inspection.
```

Replacement:

```markdown
Read [delegation and review](references/delegation-and-review.md) before delegating or checking review feedback, and when a change risks security compromise, persistent data loss or corruption, incompatible data migration, or other hard-to-reverse harm. Follow its review requirements and explicit user or repository gates; use main-thread checks for other changes.
```

Evidence: `error-analysis-pilot.md` §2: public-contract wording triggered reference loading and reviewer spawning in all 12 incumbent attempts.

### G. `plugins/workflow/skills/engineering/references/delegation-and-review.md`

Current:

```markdown
Keep focused or tightly coupled work in the main thread. Delegate substantial independent implementation, discovery, or verification when parallel work, context isolation, or independent judgment justifies the full coordination cost; a cheaper model alone is not a reason to delegate. Continue independent work while agents run.

Before starting a new agent, check whether an existing agent fits the role and responsibility. Reuse it for related follow-up work, corrections, and verification. Start a new agent when the role changes, parallel work requires another agent, independent judgment is needed, or the existing context is unsuitable. Do not use an implementation agent to independently review its own changes.
```

Replacement:

```markdown
Keep focused or tightly coupled work in the main thread. Delegate substantial independent work only when parallel work, context isolation, or independent judgment earns its coordination cost. Reuse suitable agents for implementation follow-ups and continue independent work while implementers run.
```

Evidence: `error-analysis-pilot.md` §2 and H1: incumbent review coordination generated expensive wake-ups; 11/12 attempts ran follow-up reviews.

### H. `plugins/workflow/skills/engineering/references/delegation-and-review.md`

Current:

```markdown
- Routine bounded changes can use focused checks and main-thread diff inspection.
- Consequential changes, such as data-integrity, migration, or hard-to-reverse behavior, use a separate review context when available.
- Broad, ambiguous, security-sensitive, public-contract, concurrency, or ownership risk warrants an adversarial reviewer.
```

Replacement:

```markdown
- Use a separate adversarial review for a concrete risk of security compromise, persistent data loss or corruption, incompatible data migration, or other hard-to-reverse harm.
- For other changes, including public API or concurrency work, use focused checks and Engineering's final diff inspection.
```

Evidence: `error-analysis-pilot.md` §3: happy-dom incumbent r1/r3 reviews caught late writes into closed controllers, but r2 still missed that lifecycle defect.

### I. `plugins/workflow/skills/engineering/references/delegation-and-review.md`

Current:

```markdown
Review is independent only when a reviewer that did not author the change inspected the actual change in its own context. Self-review, an unscoped approval, or a claim without an artifact does not qualify.
```

Replacement:

```markdown
Complete final checks before requesting review and include their results in a self-contained brief. Start a reviewer who did not author the change in fresh context; for Codex `spawn_agent`, set `fork_turns: "none"`. It must inspect the actual diff and contract. Batch routine updates into the brief; send further input only to correct scope or material evidence.
```

Evidence: `error-analysis-pilot.md` §1–2: all 12 incumbent reviewers inherited 71k–111k tokens; check-result messages caused additional wake-ups.

### J. `plugins/workflow/skills/engineering/references/delegation-and-review.md`

Current:

```markdown
Verify reviewer findings against live code and the task contract. Reject style preferences, stale assumptions, and scope expansion. Apply valid findings only with implementation authority, then rerun affected checks. Reuse the same reviewer for correction verification unless a fresh judgment is necessary.
```

Replacement:

```markdown
Verify reviewer findings against live code and the task contract. Apply supported, in-scope corrections with implementation authority, then rerun affected checks. Request another independent review only when a fix addresses a P0/P1 finding or changes the agreed contract, or an explicit user or repository gate requires it; otherwise verify the correction in the main thread.
```

Evidence: `error-analysis-pilot.md` H1: follow-ups cost 0.95M child tokens plus approximately 0.70M root coordination tokens, finding four late P2s across three attempts.

## 2. Totals

**12 added lines, 21 removed lines; −72 whitespace-delimited words.** Counts use line-diff semantics, including the unchanged portion of edit D. Three files change; descriptions and frozen sections remain untouched. No files were modified.

## 3. Predicted effect

**Approximately 1.10× vanilla**, assuming ordinary feature work no longer triggers review:

- Root before review: 1.22M.
- Necessary completion work: 0.51M.
- Self-check allowance: `(1.08 − 1.02) × 1.67M ≈ 0.10M`, derived from H3.
- Conservative projection: `(1.22 + 0.51 + 0.10) / 1.67 ≈ 1.10`.

This uses rounded component means, not a reconstructed per-task median. I take no additional credit for ledger or reference savings, avoiding double-counting. Retained high-risk reviews cost extra.

The clearest quality benefit stays intact. In happy-dom r3, incumbent adds a 229-line disposal suite; vanilla adds 556 test lines across three files, including repeated waiting-test setup. Incumbent also explicitly tests empty bodies after disposal and late producer events. In true-myth r1, incumbent consolidates retry-success cases while vanilla separates them. These support retaining the authoring gate, not indiscriminate test reduction.

| Criterion | Expected effect |
| --- | --- |
| Ownership | Preserve; inspect failure and lifecycle behavior at its owner. |
| Leaky abstraction | Preserve existing boundary guidance. |
| Over-abstraction | Preserve existing restrictions. |
| Simplicity | Neutral to better through less review-driven scope expansion. |
| Reuse | Preserve existing local-code preference. |
| Extensibility | Preserve existing-seam guidance. |
| Overlap | Preserve test consolidation and duplication checks. |
| Dead code | Preserve final inspection and required analysis. |
| Test value | Preserve the incumbent’s strongest observed benefit. |
| Coverage | Preserve targeted proof; lifecycle coverage remains the largest risk. |

Mechanical targets remain cognitive ratio ≤0.58, hotspots ≤10, dead code ≤4, duplicated test lines ≤46, and changed-line coverage ≥99.6%. These are acceptance targets, not demonstrated results.

Aim for 12/12 correctness; the stated gate permits 10/12 against vanilla’s 11/12. Eight blind-judge wins are unproven: process savings may produce ties rather than better code.

## 4. Risks

| Edits | Real-work failure risk |
| --- | --- |
| A | Removing the detailed ledger could weaken deliberate readability or reuse scrutiny. |
| B | Host-dependent inheritance still requires correct configuration; I supplies the concrete reviewer setting. |
| C | Required checks may be expensive; failure classification must not become grounds for skipping them. |
| D | An author can repeat their original misunderstanding during self-inspection. |
| E | A single commit could omit useful packaging guidance formerly loaded automatically. |
| F, H | Lose independent lifecycle, compatibility, and grammar-generalization catches on ordinary work. The happy-dom catches are real value, not ceremony. |
| G | Less explicit agent-reuse guidance could encourage unsuitable context reuse. |
| I | Fresh reviewers lose author context; incomplete briefs can omit consequential constraints. |
| J | Small fixes can introduce defects; the four late P2 findings demonstrate the lost protection. |

**Drop A first** if quality worsens: its benefit beyond removing default review is uncertain. Keep D and the test-audit gate. If lifecycle regressions rise, revise F/H; the pilot predicts restoring broad concurrency review would exceed the token gate.