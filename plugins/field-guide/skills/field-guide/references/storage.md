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
├── annotations.json    # Optional user confirmations and event triggers
├── annotations-watermark.json  # Memory revision and fingerprints of the last annotation-aware write
├── init.md
├── memory.lock         # Present only while a write runs
├── memory.md           # Canonical readable and machine-recorded memory
├── memory.json         # Validated machine cache
├── operations.jsonl    # Local write-ahead journal of reversible operations
├── proposals.json      # Local proposals that wait for the user's approval
├── session-review/     # Local opt-in, cursors, and pending observations of the session review
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
causes archive. Only `undo-operation` moves an active record back to `candidate`,
when it reverses a promotion by the nightly session review; it refuses while a
plugin copy installed on the machine lacks `scripts/field-guide-review.mjs`.

### Memory versions

`memory.md` holds version 1 (`schemas/memory-v1.schema.json`) until the store
holds a consolidation link or a journaled transition. Then the utility writes
version 2 (`schemas/memory-v2.schema.json`), which adds `consolidates` on a
replacement and `operationId` on a transition. A plugin that reads only version
1 refuses a version 2 store and writes nothing to it, and its hook shows one
line that the store is newer. The commands that write version 2, `consolidate`,
`undo-operation`, and `field-guide-dream.mjs apply`, refuse to run while a
plugin copy installed on the machine lacks `schemas/memory-v2.schema.json`.
They check the Claude Code copy that `installed_plugins.json` names and every
Codex copy in its plugin cache. The shared export format does not change, so an
older plugin on another machine still imports a consolidation and its undo.

### Consolidation and undo

Use `consolidate --input <json-file>` to replace 2 to 8 active records of one
scope and subject with one new record. The input follows
`schemas/consolidation-v1.schema.json`. The default is a dry run; apply
requires its preview token. The replacement keeps the predecessors' evidence
links without adding evidence, takes their triggers, and lists them in
`consolidates`. Each predecessor is superseded, and a shared predecessor gets
its own retirement ID. A record that still replaces superseded records cannot be
consolidated.

When a predecessor is confirmed, `consolidate` changes nothing. It stores a
proposal and returns `confirm fg:proposal:<id>` for the user to send. After the
hook records that approval, `consolidate --approval proposal:<id>` recomputes the
proposal ID from the current records and the stored text, applies it, and
confirms the replacement in the same commit. A proposal expires after 14 days.

Use `undo-operation --id <operation-id>` to reverse a consolidation, an
automated archive, or a session review submit within 90 days. It withdraws the replacement the way a user's
undo does, restores each predecessor it still supersedes, and acknowledges only
the retirement IDs its operation created. A predecessor that something else
retired stays retired, and the result lists it. Restored predecessors start
unconfirmed, because a restore revokes confirmations; the user confirms them
again if needed. The undone set is recorded as
declined, so nightly maintenance does not propose it again. Repeating the undo
changes nothing. When a later change blocks a clean inverse, the command names
the conflict and changes nothing. `transition` refuses to withdraw or undo a
consolidated replacement and names `undo-operation`.

### Operation journal

`operations.jsonl` is a local write-ahead journal. No hook reads it, and it never
syncs. An operation appends a `pending` entry, then writes annotations and
memory, then appends a `commit` entry. Every transition the operation makes
carries its operation ID. Before the next journaled command, recovery commits
a pending operation whose ID reached memory and aborts the rest. An entry holds
IDs, fingerprints, revisions, retirement IDs, a sanitized reason, and the undo
command. It never holds guidance text, prompts, or paths. A nightly `run` entry
also records the subject and live-guidance digests it reviewed.

`proposals.json` is local and never syncs. Each proposal holds the target
fingerprints, the replacement text, the reason, its expiry, and the user's
approval once the hook records it. Read [nightly maintenance](dreaming.md) for
the nightly pass.

Use `delete --input <json-file>` for permanent deletion. The target must be
`withdrawn` or `archived`. The first call returns a preview token and the orphan
evidence IDs that would be removed. Apply requires the same token at the same
store revision. The utility rejects referenced targets and preserves evidence
that another record uses.

Writes to `memory.md` and `annotations.json` hold `memory.lock`, which records
the writer's PID, PID namespace, and start time. A writer waits up to 1.5
seconds for another writer. It removes a lock older than one minute, or one
whose owner process has exited in the same PID namespace. A lock from an older
plugin has no owner data and becomes stale only by age.

## Confirmations and event triggers

`annotations.json` follows `schemas/annotations-v1.schema.json`. It keys
records by guidance fingerprint and keeps two kinds of entries per record:

- A **confirmation** says the user confirmed this exact text. Only the
  `UserPromptSubmit` hook writes one, for a prompt that is exactly
  `confirm fg:<id>` in a main thread; see
  [hook lifecycle](lifecycle-hooks.md#confirmation-prompt). It stores a random
  entry ID, the time, the host (`claude` or `codex`), and `seen`: the
  record's revocation and retirement IDs known when the user confirmed. It stores no prompt
  text, hostname, user name, or path.
- A **trigger** tags a record for an event: `pr-merged`, `pr-created`, or
  `handoff`. An agent adds one with `annotate --id <id> --triggers <list>` and
  removes one with `annotate --id <id> --remove-trigger <trigger>`. Triggers
  choose when guidance is retrieved; they carry no authority.

`--id` takes a full guidance ID or an unambiguous hex prefix of at least eight
characters.

Removing a trigger adds its ID to the record's `acknowledged` set, as
retirement sets do. An entry counts while its ID is not acknowledged.

A revocation adds a random ID to the record's `revocations` set. A
confirmation counts only when its `seen` holds every revocation ID of its
record and every retirement ID that memory keeps for a shared record, even an
acknowledged one, so a retirement or undo by a plugin without annotations
also revokes. A revocation covers a confirmation that its machine has not
seen. Clocks never decide this. When a confirmation and a revocation happen
on different machines before they sync, the revocation wins; the user confirms
again. These actions add a revocation:

- `unconfirm --id <id>`. It needs no approval, because it only removes
  authority.
- A transition or archive, for every record whose status it changes. A
  restored record starts unconfirmed.
- `delete` of a shared record. Delete of a project record drops its
  annotations, which never sync.
- `submit`, when it creates a record, so recaptured text starts unconfirmed.
  An independent capture of the same text on another machine revokes too.

Import mints none. It unions entries, acknowledgments, and revocations, and
adds an ID derived from each exported retirement ID to its fingerprint's
revocations, even without a local record, so machines converge in any delivery
order.

A plugin that predates this rule can retire, restore, delete, or recapture
guidance without touching annotations. `annotations-watermark.json` stays
local and holds the memory revision and record fingerprints of the last
annotation-aware write; a crash between the memory and watermark writes leaves
a mismatch. While memory has another revision, no confirmation counts. The next
locked command of a current plugin, including export and a delete or archive
preview, first revokes every fingerprint in memory, annotations, or the
watermark, then records the revision. That covers confirmations in transit and
records an older plugin deleted, so a deleted record that a later import brings
back stays unconfirmed in any delivery order. The user confirms again, and that
confirmation survives later syncs. A store without the watermark, such as one
from the first annotation release, is treated the same way: confirmations do
not yet grant authority, so voiding them costs one confirm prompt each. Each
machine voids once when it upgrades, and its revocations reach the others when
they sync. A record that an older plugin both imports and deletes between two
current writes leaves no fingerprint, so a confirmation in transit for it can
still count.

No command adds a confirmation. `submit`, `transition`, `maintain`, and
`import` reject unknown fields such as `confirmed` on a record, and a
supersede's `confirmed: true` records a lifecycle decision, not a
confirmation.

A confirmation binds to the fingerprint, which hashes the scope, subject, and
normalized learning. Changed text is a new record and starts unconfirmed. A
record that is withdrawn, deleted, and captured again with the same text also
starts unconfirmed, because each of those steps adds a revocation.

`memory.md`, its cache, and the shared export keep their versions. A plugin
that predates annotations ignores `annotations.json`: it injects the same
guidance without markers, so it grants no authority.

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

`retrieve --event <trigger>` returns the applicable active records tagged with
that trigger: current-project records first, then shared records, newest
first, within the normal limits of five records and 6 KB.

Retrieved records never report confirmation; only hook-injected lines carry
`[confirmed]`. In a main thread, retrieved records carry `triggers` from
`annotations.json`. A command in a T3 Code delegate thread gets records
without them.

## Audit and maintenance

Use `audit` for a manual read-only inspection. It reports validation errors,
candidates that already meet evidence thresholds, unresolved refinements and
contradictions, broken local or commit pointers, orphan evidence, oversized
records, and `duplicateCandidates`: groups of live records in one subject whose
terms overlap, without groups the user declined by an undo. It does not fetch stored URLs. It does not use record age as an archive
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

Annotations travel in a second portable file with the `annotations.json`
format. `export --output <json-file> --annotations <json-file>` writes it: it
keeps every entry already in the file and adds the local entries for every
fingerprint that is not a local project record. `import --input <json-file>
--annotations <json-file>` validates both files before it changes anything,
then unions the entries, acknowledgments, and revocations into
`annotations.json`. Union makes revocations converge in any sync order: once any machine acknowledges an
entry, every machine does after it syncs.

No command creates a confirmation, but import copies confirmations from the
synced file, so their authority rests on that file. Confirmation guards
against agent error, such as an agent treating its own reading or a pasted
report as the user's approval. It does not guard against someone who can edit
the dotfile or the store. The hook cannot tell who sent a confirm prompt in a
main thread, so only guidance bars an agent from sending one through a host
tool.

filip-stack's `host-config` script runs import on apply and import followed by
export on `field-guide-sync`. It keeps the annotations file at
`field-guide-annotations.json` beside `field-guide.json`.

Known limits:

- A restore reaches every machine only after repeated syncs, not in one pass.
- Annotation entries and acknowledgments grow without bound, and every
  captured fingerprint keeps a record for its revocations.
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
- Any older plugin that writes memory, including the first annotation
  release, voids every confirmation in that store until the user confirms
  again. Other machines see the revocation only after a current plugin writes
  or exports that store and they sync.
- A retirement export that reaches a fresh store before the active record
  leaves the record active there, though unconfirmed, because retirement sets
  apply only to local records.
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
