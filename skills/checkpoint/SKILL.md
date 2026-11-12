---
name: checkpoint
description: Produce a concise, evidence-backed checkpoint for pausing or handing off work.
disable-model-invocation: true
---

# Checkpoint

Use only when explicitly invoked. Capture the requested scope in conversation unless the user requests a saved file.

## Establish the current state

Identify the outcome and sources. Inspect each repository's identity, branch, HEAD, dirty state, and relevant files. For other work, identify the authoritative document or tracker and observed state.

Reconcile conversation claims with current evidence. Distinguish intended, attempted, implemented, and verified outcomes. Plans and agent claims do not prove completion.

Include only material decisions, completed outcomes, outstanding work, blockers, verification, and the next action. Preserve unrelated dirty changes.

## Verification evidence

Identify each check's command, result, and covered revision or working-tree state. Use available results or saved evidence; do not rerun expensive checks solely for a checkpoint.

Flag results invalidated by later relevant changes. When the tested state is unknown, label results historical and current verification unknown. List unconfirmed or unrun required checks; never report unavailable evidence as passed.

## Output

Use this shape, omitting empty optional sections:

```md
# Checkpoint: <subject>

Date: <timestamp with timezone>

## Source
<Work item or document; repository, branch, revision, and relevant dirty state>

## Completed
<Confirmed outcomes with bounded evidence; distinguish implemented from verified>

## Remaining
<Outstanding work>

## Blockers and decisions
<Material blockers, unresolved decisions, and settled decisions needed to resume>

## Verification
<Checks, results, covered state, and what remains unverified>

## Next action
<Concrete starting point for continuation>
```

## Save only when requested

Honor a supplied destination. Otherwise save a new snapshot at:

```text
~/.engineering-workflow/<project-or-subject>/checkpoints/YYYY-MM-DD-HHMM-<subject>.md
```

Use descriptive names. Preserve earlier snapshots; add a suffix on filename collision. Create only the checkpoint and parent directory, with no registry, task ledger, companion artifact, or automatic updates.

Check that every completion and verification claim has evidence or an explicit uncertainty label. Return the saved path when applicable.

On resume, treat the checkpoint as historical: recheck current sources and repository state before acting. This skill is read-only except for an explicitly requested checkpoint file. It does not authorize code changes, tracker updates, commits, or publication.
