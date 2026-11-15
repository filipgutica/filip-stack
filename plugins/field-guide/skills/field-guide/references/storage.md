# Field guide storage

Use `~/.field-guide` unless the utility receives an explicit `--guide-root`.

Use these terms:

- A **review record** stores evidence for one correction commit.
- A **project pattern** stores durable project guidance.
- **Shared guidance** stores a promoted cross-project preference.

```text
~/.field-guide/
├── analytics/          # Optional local event log and opt-in setting
│   ├── config.json
│   └── events.jsonl
├── .obsidian/          # Optional client-owned vault settings
├── init.md
├── memory.md           # Canonical readable and machine-recorded memory
├── memory.json         # Validated machine cache
├── sessions/           # Hook session state; pruned after seven days
├── shared/
└── projects/
    └── <repo-key>/
        ├── init.md
        ├── patterns.md
        └── reviews/
```

See [hook lifecycle](lifecycle-hooks.md#privacy-boundary) for session state details.

## Indexes

Every Markdown file below the guide root must be reachable from the nearest index:

- Root `init.md` links each shared topic and project `init.md`, with a one-line description.
- Project `init.md` links `patterns.md` and every review record, with a one-line description.
- Keep indexes concise. Do not copy the linked file contents into the index.

`init` creates an empty canonical `memory.md`, links it from the root index, and
creates `memory.json` as its validated machine cache. Both views follow
`schemas/memory-v1.schema.json`. Submit observations only after initialization.

`memory.md` includes readable guidance and one complete JSON block with
evidence, pointers, source keys, transitions, and timestamps. The utility writes
canonical Markdown before it replaces the cache. A cache write failure cannot
remove the new canonical record. Validation reports a missing, stale, or changed
view and never replaces malformed state.

## Observation submissions

Use `submit --input <json-file>` after initialization. The input must follow
`schemas/submission-v1.schema.json`. The agent decides whether an observation is
clear enough to submit. The utility owns all behavior after submission.

Run `candidates --subject <subject-key> --scope <project|shared>` before
submission. It returns at most ten active or candidate records from the same
scope and subject, with a 6 KB limit and no evidence. Use this bounded set for
semantic duplicate and relationship decisions.

The utility normalizes Unicode, case, whitespace, and terminal punctuation for
exact fingerprints. It never creates two records with the same scope, subject,
and normalized learning. A repeated source returns `duplicate-evidence`. A new
independent source reinforces the existing record.

An explicit user preference becomes active immediately. An inferred project
record becomes active after two independent evidence events. An inferred shared
record also needs evidence from two repository identities and `generic: true`.
Confidence is audit metadata. It does not count as evidence.

An explicit confirmed correction can supersede active guidance through
`transition`. The replacement must link to the target with `refines` or
`contradicts`. An inferred contradiction remains a linked candidate until the
user confirms how to resolve it.

Evidence pointers use a closed allowlist:

- `conversation`: client, thread ID, one optional message or turn ID, and one optional safe URL.
- `review`: provider, repository identity, pull-request number, comment ID, and one optional safe URL.
- `commit`: repository identity and one full lowercase commit hash.
- `local-artifact`: repository identity, repository-relative path, optional heading, and SHA-256 content digest.
- `manual`: one short source label.

The utility derives source keys. Inputs cannot set evidence IDs or source keys.
Manual evidence and conversation evidence without an occurrence ID do not count
for promotion. URLs must use HTTPS. They cannot contain user information,
queries, local hosts, or IP hosts. Only review URLs can contain fragments.

Guidance can include one sanitized pattern and one sanitized antipattern. Each
example must identify its language and contain at most 40 lines. Both examples
can contain at most 6 KB of UTF-8 text.

Submissions fail closed on high-signal secrets and unsafe source content. The
guard rejects credential assignments, common token formats, private-key
markers, transcript or prompt markers, URL query strings, and absolute home
paths. This structural guard does not replace the agent's semantic redaction.

## Lifecycle

Guidance uses `candidate`, `active`, `superseded`, `withdrawn`, and `archived`.
Each change appends an immutable transition. Normal guidance retrieval can use
only `active` records.

Use `transition --input <json-file>` for an explicit lifecycle decision. The
input follows `schemas/lifecycle-v1.schema.json`. A confirmed correction can
supersede one active record with a same-scope, same-subject
replacement. The command activates a candidate replacement and stores its ID on
the superseded transition. `undo` and `withdraw` preserve evidence and move the
target to `withdrawn`. When the target is the replacement of a superseded
record, they also move that record back to `active`. Archive uses the maintenance dry-run path. Age never
causes archive.

Use `delete --input <json-file>` for permanent deletion. The target must be
`withdrawn` or `archived`. The first call returns a preview token and the orphan
evidence IDs that would be removed. Apply requires the same token at the same
store revision. The utility rejects referenced targets and preserves evidence
that another record uses.

## Bounded retrieval

Use `retrieve --query <concrete-task-context>` after the repository and task are
known. Add `--subject <subject-key>` only as a known ranking hint. An exact
subject can be retrieved without a query. Retrieval returns only active guidance
and ranks it in this order:

1. Current-project guidance for the subject hint, when provided.
2. Shared guidance for the subject hint, when provided.
3. Current-project or shared guidance from linked subjects.
4. Other active guidance by meaningful complete-term overlap with the query.

Query matching ignores common language and Field Guide boilerplate. A query with
two or more meaningful terms requires at least two complete-term matches. A
single meaningful term requires one complete-term match. Applicability results
with more matching terms rank first. Do not use generic wording or broaden a
query to force a result.

A current-project record suppresses an identical shared statement. Candidates
and records for other repositories are excluded. Confidence and evidence count
do not affect rank. Updated time breaks ties after scope and subject rank.

Routing output is at most 2 KB and reports a null subject when no hint was used.
Normal output contains at most five whole
guidance records and 6 KB. It contains no evidence records or transition
history. The utility never truncates a record. It reports the number omitted.
The nullable subject extends the version 1 result only for the new query-only
mode. Existing subject-based calls continue to return the requested subject
string.

Use `retrieve --evidence-for <guidance-id>` only for an explicit provenance or
conflict check. Evidence expansion returns at most two whole records and 6 KB.
The result follows `schemas/retrieval-v1.schema.json`.

## Audit and maintenance

Use `audit` for a manual read-only inspection. It reports validation errors,
candidates that already meet evidence thresholds, unresolved refinements and
contradictions, broken local or commit pointers, orphan evidence, and oversized
records. It does not fetch stored URLs. It does not use record age as an archive
signal, and it does not change files.

Use `maintain --input <json-file>` for explicit archive or cache-repair
maintenance. The input follows `schemas/maintenance-v1.schema.json`. Archive
accepts candidate, active, superseded, or withdrawn target IDs. `repair-cache`
rebuilds only `memory.json` from a valid canonical `memory.md`; it never changes
malformed canonical data. The default is a dry run. Apply requires the preview
token from the same canonical store and cache state.

## Shared guidance sync

`export --output <json-file>` writes shared guidance in a portable form, version
2. Active records keep their subject, linked subjects, learning, confidence,
`generic`, and examples. The export omits evidence, repository identities,
relationships, and candidates. Retired shared records appear only as a
fingerprint with two sets of retirement IDs: `retirements` and `acknowledged`.
The IDs are random and carry no machine identity or time. When the output file
already exists, export keeps the union of its sets and the local sets for each
fingerprint.

A fingerprint is retired while any of its retirement IDs is not acknowledged.
These rules order retirements and restores across machines:

- A user retirement of shared guidance adds a new ID: `withdraw`, `undo`, the
  target of `supersede`, and archive. The `superseded` transition stores its
  ID as `retirementId`.
- A user `withdraw` or `undo` of a replacement acknowledges only the ID of the
  supersession it created. A superseded transition with no `retirementId`
  predates the sets and uses the fingerprint's baseline ID.
- Import only copies IDs. It never adds an ID or an acknowledgment.

Withdrawing a replacement, by the user or by import, moves the record it
superseded back to `active` only when none of that record's IDs is
outstanding. Otherwise the record moves to `withdrawn` through
`superseded->withdrawn`. `validate` allows that edge only when the replacement
named on the superseded transition has been withdrawn, and, while it is the
latest transition, only when the record has an outstanding ID.

So an undo reverses only its own supersession. It never reverses a withdrawal,
an archive, or another machine's supersession of the same record, even one it
has seen.

`import --input <json-file>` merges an export by fingerprint, into shared-scope
records only. It accepts version 1 and version 2. Each version 1 retired
fingerprint becomes one baseline retirement ID for that fingerprint. A local
shared record retired before the sets existed counts as the same baseline ID.
Import does these steps:

1. It copies both sets onto the matching shared record.
2. It adds a missing active record as active, with source `shared-sync` and no
   evidence, and promotes a matching local candidate.
3. It withdraws a candidate or active record that the sets retire. When that
   record is the active replacement of superseded guidance, the superseded
   record moves by the rule above. Import acknowledges nothing, so it returns
   to `active` only if a user undo on another machine acknowledged its
   supersession and nothing else retires it.
4. It restores a withdrawn record that the sets no longer retire, through
   `withdrawn->active` with source `shared-sync`. Only shared sync uses that
   transition.

Export merges the output file's sets with the local sets first. It then leaves
out of `active` any record whose fingerprint has an outstanding ID, so a
machine that has not yet imported a retirement does not publish the retired
text.

Local records store the sets as optional `retirements` and `acknowledged`
arrays. They are written only when a retirement, a restore, or an import
changes them. `validate` rejects an active shared record with an unacknowledged
retirement.

filip-stack's `host-config` script runs import on apply and import followed by
export on `field-guide-sync`.

Known limits:

- A restore reaches every machine only after repeated syncs, not in one pass.
- A retirement or restore whose every copy a dotfile manager overwrote cannot
  be recovered.
- The sets grow without bound.
- Withdrawal and archive IDs are never acknowledged, so they are final across
  every machine. Only a supersession can be reversed, and only by undoing its
  replacement on a machine that holds the supersede relationship. Export does
  not carry relationships, so a machine that imported the replacement cannot.
- Every retirement made before the sets existed shares one baseline ID per
  fingerprint. Undoing a supersession made before the sets existed
  acknowledges that ID, which also stands for any withdrawal of the same
  fingerprint from that time.
- A checkout that predates version 2 refuses a version 2 dotfile. An older
  plugin cannot read a store that has the new fields and silently stops
  injecting guidance. A retirement made on an older machine can lose to a
  restore made in the same window.
- Update each machine in this order: refresh the Field Guide plugin, restart
  the host, then run `filip-stack update` (`host-config update`).

The optional `.obsidian/` directory is not part of the index contract. Field-guide
commands ignore all files below it.

## Local analytics

Analytics is disabled by default. `analytics-enable` requires an initialized
guide and writes `analytics/config.json`. `analytics-disable` stops new events
without deleting past events. Analytics files are separate from canonical
`memory.md`, its cache, and indexed review evidence. The event log is local,
append-only JSONL. Its records contain timestamps, event IDs, host or project
keys, guidance IDs, and categorical outcomes. It does not store prompts,
retrieval queries, guidance text, transcripts, or source content.

When enabled, normal guidance retrieval appends an event and may return an
`analyticsEventId`. Logging failures do not block retrieval, submission, or the
hook. A report reads the available events and states missing or insufficient
reviewed data explicitly. Hook events count invocations only. Agent-reported
impact and independent review are separate events; neither changes guidance
status or evidence thresholds. No historical events are synthesized when
analytics is first enabled. The reviewed capture rate depends on which cases
are sampled; use a stable random UUID per case and include eligible misses in
the sample. The report does not infer corrections outside that sample.

An impact input has `schemaVersion: 1`, the retrieval's `analyticsEventId` as
`retrievalEventId`, a returned `guidanceId`, and `effect: applied` or
`decision_changed`. A separate reviewer can confirm or reject a claimed
decision change. A reviewer can also label sampled corrections as
`eligible_captured`, `eligible_missed`, or `not_eligible`. Do not review your
own claimed impact. The report separates activity, agent reports, and reviewed
outcomes. `reviewConfirmationRate` is the fraction of reviewed decision-change
claims confirmed; `captureRate` is the fraction of eligible cases captured in
the reviewed sample. Neither estimates an overall prevention rate. An
invocation event proves the hook ran, not that guidance helped.

## Obsidian compatibility

You can open `~/.field-guide` as an Obsidian vault for read-only inspection and
manual audits. Obsidian stores vault settings under `.obsidian/`.

Treat `.obsidian/` as disposable client state. Do not store guidance, evidence,
schemas, or agent instructions there. Field-guide commands must work without
Obsidian and must not read `.obsidian/` during guidance retrieval.

Obsidian links, plugins, properties, and views are optional. They must not define
field-guide identity, lifecycle, validation, or retrieval behavior.

## Review record

Use one record per correction commit. A record may contain multiple review rounds that led to that commit.

```md
# <concise learning title>

- Date: `YYYY-MM-DD`
- Repository: `<repository name>`
- Branch: `<branch>`
- Commit: `<full 40-character hash>`
- Commit link: <URL or `not available`>
- Review source: <pull-request URL, comment URL, user review, or other concise source>
- Outcome: `accepted` or `modified`

## Review rounds

### Round 1

- Feedback: <what was challenged>
- Evaluation: <why it was valid and how it applied here>
- Change: <what changed>
- Verification: <focused evidence>

## Durable learning

- Lesson: <generalized preference or anti-pattern>
- Scope: `project` or `shared`
- Guidance file: <relative link to patterns.md or shared topic>
```

Replace every placeholder before saving the record.

Use `accepted` when the change applies the feedback as given. Use `modified` when the implementation adapts it.

Omit later review rounds when there was only one.

## Project patterns

Keep `patterns.md` organized by stable topic. Each project pattern states:

- the preferred pattern or anti-pattern
- when it applies
- a link to at least one supporting review record.

When later evidence changes a pattern, update the guidance and retain the historical review records.

## Shared promotion

This section applies to indexed shared Markdown files that use project review records. It does not define scope or activation for machine-recorded guidance in `memory.md`.

For machine-recorded guidance, use the capture policy. An explicit portable user preference becomes active shared guidance immediately. An inferred shared learning requires independent evidence from two repository identities and `generic: true`.

Create a focused file under `shared/` only for cross-project guidance.

Promote an explicit user preference immediately when its semantic applicability is shared. Otherwise, require committed evidence from two project guides.

Record one of these evidence shapes near the top of the shared file:

```md
- Promotion: `explicit-general-preference`
- Preference source: <where the user stated the general preference>
```

```md
- Promotion: `multi-project-evidence`

## Evidence

- [<first project review>](../projects/<repo-key>/reviews/<record>.md)
- [<second project review>](../projects/<repo-key>/reviews/<record>.md)
```

The `explicit-general-preference` label includes an explicit preference whose meaning is portable without a repository-specific contract. The user does not need to state the word "general."

Multi-project evidence must link indexed review records from two project guides. Keep both repositories available during validation.

The utility verifies commits, promotion data, evidence links, and related local Markdown links.

Project-specific contracts and conventions stay in that project's `patterns.md`, even when they recur within one repository.
