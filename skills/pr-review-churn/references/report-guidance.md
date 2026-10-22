# PR Review Churn Report Guidance

## Confirmed Scope

- Use only the repositories and lookback confirmed in the current conversation. Ask for missing scope before collection.
- Describe the cohort precisely: the bundled collector selects PRs by creation date and retrieves their available review threads, not review activity confined to the lookback period.
- Data source: GitHub GraphQL `reviewThreads`

## Report Shape

Use this structure unless the user asks for another format:

1. **Coverage**
   - Author, repos, lookback, UTC cutoff date, PR creation-date cohort, generated timestamp.
   - PR and human-actionable thread counts by repo.
   - Failed, inaccessible, or partial repos.
2. **Top Review Churn Patterns**
   - Order by repeated impact, not raw count alone.
   - Include count, affected repos, representative PRs, and concise examples.
3. **Notable Changes**
   - Mention new or fading themes only when previous-run evidence is available.
   - If there is no baseline, say so directly.
4. **Proposed Workflow Updates**
   - Propose durable guidance only when repeated evidence supports it.
   - Keep wording generic and reusable; do not encode repo-specific examples.
5. **Recommended Next Actions**
   - Keep actions small, explicit, and tied to reducing repeated review churn.

## Objection Families

- **Shared-path duplication**: reviewers ask whether an existing shared path can handle the behavior instead of adding special-case branches.
- **Duplicate source of truth**: reviewers object to parallel helpers, mappings, config, derived state, or duplicated logic.
- **TypeScript ceremony**: reviewers push back on casts, predicates, aliases, or lint/type appeasement that does not clarify runtime behavior.
- **Contract or metadata completeness**: reviewers point out missing API fields, descriptions, examples, validation metadata, schema details, or public contract compatibility.
- **Regression coverage**: reviewers ask for tests proving the behavior, edge case, or prior bug does not regress.
- **Package or dependency boundary drift**: reviewers object to logic living in the wrong package, adding dependencies unnecessarily, or duplicating ownership across producer/consumer boundaries.
- **Async and failure guardrails**: reviewers point out loading, cancellation, fallback, empty-state, or error handling gaps.

## Evidence Rules

- Count only human-actionable review feedback by default.
- Count distinct actionable threads per family and show how many distinct PRs they span; replies within one thread are not independent repetitions. Explain any multi-family classification so totals are not mistaken for distinct-thread counts.
- Exclude bot-only feedback unless the user asks for automation noise analysis.
- Treat resolved and outdated threads as useful history when the reviewer feedback was actionable.
- Do not quote long review comments; paraphrase and link to PRs or comments.
- Record limitations plainly when a repo fails, a thread is inaccessible, or nested review-thread pagination may truncate data.
- Do not use flat issue comments as equivalent to review threads; they lose path anchors, resolved state, and outdated state.
