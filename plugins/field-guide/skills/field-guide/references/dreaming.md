# Nightly maintenance

Nightly maintenance ("dreaming") keeps the store small and current. A script
plans, a reviewer model proposes actions, and the script applies only what the
lifecycle rules allow. Every applied change is journaled and reversible for 90
days. Read [storage](storage.md#consolidation-and-undo) for `consolidate`,
`undo-operation`, the journal, and proposals.

Run the script with the same Node that runs the utility:

```text
node <field-guide-skill-directory>/scripts/field-guide-dream.mjs plan --repo-root <git-root>
node <field-guide-skill-directory>/scripts/field-guide-dream.mjs apply --repo-root <git-root> --input <actions.json> [--preview-token <token>]
```

## Plan

`plan` prints one bounded JSON packet on stdout. It calls no model and writes
nothing, not even journal recovery. The packet holds:

- The audit: validation errors, stale candidates, unresolved relationships,
  broken pointers, orphan evidence, and oversized records.
- `live`: a digest of each live guidance source, `claude-md`, `agents-md`,
  `roles`, `coding-standards`, and `skills` (one `name: description` line per
  skill). Text is included, up to 32 KiB per source, only when there is a
  subject to review.
- `subjects`: each subject that changed since the last applied run, or every
  subject when live guidance changed. A subject lists its live records with
  their confirmation and triggers, its `digest`, and its `overlapGroups`
  without groups the user declined.
- `pendingOperations`, `skippedSubjects`, and `omittedSubjects`, which the
  192 KiB packet limit left out.

The packet holds no evidence, prompts, or transcripts. Every home directory and
the guide root are replaced with `~` and `<guide-root>`.

## Actions

The reviewer returns input that follows `schemas/dream-apply-v1.schema.json`:
the `live` digests and, for each reviewed subject, its `subjectId`, `digest`,
and actions. The script decides each action by these rules:

| Action | Unconfirmed project records | Confirmed records | Shared records |
| --- | --- | --- | --- |
| `consolidate` of overlapping records | Applied and journaled | Stored proposal | Stored proposal |
| `archive` of a duplicate of live guidance or of another record | Applied and journaled | `confirmed-duplicate` flag | `shared-proposal` flag |
| `contradiction` between two records | `conflict` flag | Queued for the user | Queued when either is confirmed |
| `flag` (`conflict`, `unused`, `live-edit`) | Flag | Flag | Flag |

Shared changes are proposals only during the first measured week, while
provenance from earlier imports is unknown. An `unused` flag needs local
analytics. A `live-edit` flag names a live source; the script never edits
`CLAUDE.md`, `AGENTS.md`, roles, coding standards, or skills.

## Apply

`apply` checks, in this order, and stops at the first failure:

1. Recovers the journal. A run already applied returns `already-applied` and changes nothing.
2. Rejects any confirmation field (`confirmed`, `confirmation`, `confirmations`,
   `approval`, `approved`, `explicitPreference`) anywhere in the input.
3. Validates the schema, the privacy guard on every text, and the allowed
   actions. A run reviews at most 50 actions and applies at most 10 changes.
   A consolidation must target 2 to 8 records, must not be longer than they
   are, and must not repeat a declined set.
4. Compares the live digests and each subject's digest with the current state.
   Any change since the plan, including a new confirmation, stops the run.
5. Without `--preview-token`, returns a preview and its token. With a token,
   requires the token of the current state.

An applied run writes every change in one memory write, stores its proposals,
and records a `run` entry. Its report lists each change with its undo command,
each proposal with the `confirm fg:proposal:<id>` prompt to offer, the queued
decisions, and the flags.

## Undo and approval

To reverse an applied change, run `undo-operation --id <operation-id>`. Offer a
proposal's prompt to the user; never send it. After the user sends it, run
`consolidate --approval proposal:<id>`.

## Session review

The session review finds guidance in the user's own words from the day's
sessions. It is off until the user enables it on a machine; never enable it on
your own. A disabled machine reports `not-enabled`.

```text
node <field-guide-skill-directory>/scripts/field-guide-review.mjs <enable|disable> [--guide-root <path>]
node <field-guide-skill-directory>/scripts/field-guide-review.mjs run [--dry-run] [--guide-root <path>]
```

`run` reads transcripts in place since each session's cursor, or from the last
seven days for a session it has not seen. It reviews only root interactive
sessions: Claude Code from the terminal or T3 Code, and Codex from the terminal
or an editor. It skips subagent transcripts, sidechains, headless runs, Codex
subagents, T3 Code threads that an agent or a schedule created, and any T3 Code
session it cannot match to a thread in T3 Code's state. A T3 Code thread counts
once, whichever providers ran it.

From each session it keeps only typed user turns, each with the end of the
assistant message before it as context. It drops tool output, injected and
compaction text, notifications, quoted and pasted text, and code blocks, and it
redacts home paths, URL queries, and credential-like strings. It sends that
packet on stdin to a headless classifier from the same provider, run from an
empty directory with hooks off: Claude Haiku 5.5 through `claude -p`, or Luna
through `codex exec --ephemeral`. Nothing writes the packet to disk.

The classifier returns paraphrases that cite one user turn; a citation of a
context turn is rejected. The script submits each one with a conversation
pointer to the thread and the message, as one journaled operation that
`undo-operation` reverses. Current thresholds decide promotion, with these
limits:

- A thread counts once. Nothing is added to a record that already holds
  evidence from the same thread, from an earlier night or a live capture.
- A turn without a message ID adds evidence that never counts.
- A shared record that would be promoted stays a candidate, and the report
  proposes the promotion. Show it to the user; when the user agrees, submit
  that guidance as an explicit preference.
- A correction of a stored record is a `contradicts` candidate. The report
  queues it for the user when the record is confirmed.
- A session whose repository is gone or has no hosted remote is skipped,
  because its identity would be a local path.

Caps bound each night: 16 KiB of turns per session, 256 KiB per night, 2 USD
of Claude budget, and 200k input tokens. A session over its cap is reviewed in
parts. What a cap stops is reported as backlog and reviewed next night.
`--dry-run` classifies and reports what it would submit, but changes nothing.

The report lists threads reviewed per client, exclusions, backlog, each
classifier call with its measured tokens, cost, and runtime, each change with
its undo command, proposals, queued contradictions, and rejected observations.
To reverse one change, run `undo-operation --id <operation-id>`.
