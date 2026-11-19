# Nightly maintenance

Nightly maintenance ("dreaming") keeps the store small and current. A script
plans: it prints what a reviewer model needs to find
overlaps, duplicates of live guidance, and contradictions. The script can also
apply the reviewer's merges, archives, and flags within the lifecycle rules.
Each merge and archive it applies is journaled and reversible for 90 days; a
flag changes nothing to undo. Act on any other finding
with `consolidate`, `transition`, or `maintain`, as for any other change. Read [storage](storage.md#consolidation-and-undo) for
`consolidate`, `undo-operation`, the journal, and proposals.

Run the script with the same Node that runs the utility:

```text
node <field-guide-skill-directory>/scripts/field-guide-dream.mjs plan --repo-root <git-root>
node <field-guide-skill-directory>/scripts/field-guide-dream.mjs apply --repo-root <git-root> --input <actions.json> [--preview-token <token>]
```

## Plan

`plan` prints one bounded JSON packet on stdout. It calls no model and writes
nothing, not even journal recovery; a run that a crash left without its `run`
entry counts as recorded. The packet holds:

- The audit: validation errors, stale candidates, unresolved relationships,
  broken pointers, orphan evidence, and oversized records, within 32 KiB
  together, with one validation error per line. A text item longer than 1 KiB
  is cut and ends with `…`. `stateErrors` lists what the plan itself could not
  read, such as an `operations.jsonl` line that is not JSON, an entry whose
  type, operation ID, scope, or fingerprints are missing or malformed, or a
  `run` or `run-intent` entry with any field or value that `apply` does not
  write.
- `live`: a digest of each live guidance source, `claude-md`, `agents-md`,
  `roles`, `coding-standards`, `skills` (one `name: description` line per
  skill in `~/.agents/skills`), and `plugin-skills` (one
  `<plugin>:<name>: description` line per skill of each plugin copy that Claude
  Code or Codex loads, the copies the writer gate checks). Text is included
  only when there is a subject to review, up to 32 KiB per source and within
  the room the subjects leave; a source cut short has `truncated: true`.
- `subjects`: each subject that no review saw in its current state against the
  current live guidance, including a source that was added or removed. Live
  guidance that is edited and then restored returns a subject to a state that
  a review saw, so it is not due again. A subject counts as reviewed only
  against the live guidance of the run that reviewed it, so a subject that a
  run's input left out, or that a plan omitted for its budget, stays due. A
  subject whose last review stored a proposal is skipped while the proposal
  waits for the user. Once it expires unapplied, or when it is missing from
  `proposals.json` because the run stopped before it stored it, the subject is
  reviewed again with a new `digest` that names the lapse, so that review is a
  new run; a plan made before the expiry is stale after it. When
  `proposals.json` cannot be read, `stateErrors` names the error and every
  stored proposal counts as lapsed.
  A subject stays due while a contradiction waits for the user, and lists it in
  `queuedContradictions`: one that a run queued, or one that memory records,
  a live record whose relationship `contradicts` another live record of its
  subject, while either of the two is confirmed. A subject lists its live
  records with their confirmation, triggers, and linked subjects, its
  `digest`, which covers every record field the packet shows and which records
  count as confirmed now, so a reconfirmation makes the subject due again, and its
  `overlapGroups` without groups the user declined. With each due subject come
  the subjects that apply with it: the same subject key in the other scope,
  when one of the two is shared. One that is not due itself has
  `context: true`, so a contradiction can name its records with its digest.
  List every subject the packet gives in the input: a due subject counts as
  reviewed only when the input also lists each subject that applies with it,
  so one whose counterpart the packet budget left out stays due and takes no
  archive or merge.
  A record's `confirmed` is true when the user ever confirmed it: any
  confirmation in `annotations.json` of its text, or of a record it
  consolidates, counts, whatever revoked it later, including an `unconfirm`, a
  reconcile, or a crashed operation. It shows only while the hook's watermark
  matches memory. When `annotations.json` cannot be read, records show no
  confirmation or triggers, and the audit reports the error. When it is
  missing while memory holds guidance, or has no entry for a record that
  memory holds and a shared import did not create, `stateErrors` says so. It
  also names a file that lost part of the store's history, which `apply`
  refuses (step 1 under [Apply](#apply)).
- `pendingOperations`, within 8 KiB. The packet leaves it out when
  `operations.jsonl` cannot be read; `stateErrors` names the error,
  `overlapGroups` may then list a declined group, every subject is due, and
  `queuedContradictions` lists only the contradictions that memory records;
  those that only a run queued are unknown.
- `skippedSubjects`: how many subjects the packet leaves out because they are
  not due and do not apply with a due subject.
- `omittedItems`: for each audit list and `pendingOperations` that lost items to
  its limit, how many it lost.
- `omittedSubjects`: the subjects that the 192 KiB limit on the printed packet
  left out. Subjects come first within that limit after the audit and pending
  operations, and live text fills what they leave.

The packet holds no evidence, prompts, or transcripts. Every home directory,
with or without a separator after it, and the guide root are replaced with `~`
and `<guide-root>` before any text is measured or cut. Live text, record text,
subject keys, linked subjects, and each audit item on its own are redacted
before they are measured or cut;
each validation error is redacted on its own and whole before it is split into
lines, so a block left open in one error cannot hide the next:

- A `<user>`, `<assistant>`, or `<system>` block runs to its closing tag, such
  as `</user>`. A `BEGIN PROMPT` or `BEGIN RAW PROMPT` block runs to a line
  that holds only `END`, `END PROMPT`, or `END RAW PROMPT` in capitals; an `END`
  inside other text does not close it. The markers are read in order, across lines and several on
  one line, and a closing marker counts only for the innermost open block. The
  lines from one where a block opens through one where no block is left open
  become one redaction line.
- A private key becomes `[redacted private key]`, from its `-----BEGIN` marker
  through its `-----END` marker.
- A block that never closes is redacted to the end of the text. The tag and
  `BEGIN PROMPT` markers match in any case.
- Each other line is replaced whole when it holds user information in a URL of
  any scheme, a query string after a scheme and a colon, with or without `//`
  (as in `mailto:<address>?subject=<text>`), percent-encoded text, a credential token or assignment, a
  private key marker, or a line-start `user:`, `assistant:`, or `system:`
  marker.

## Actions

The reviewer returns input that follows `schemas/dream-apply-v1.schema.json`:
the `live` digests and, for each reviewed subject, its `subjectId`, `digest`,
and actions. Nightly maintenance never archives or merges a record that the
user ever confirmed, even after an `unconfirm` or a reconcile, as long as its
confirmation history is intact; it only flags or proposes it. It also only
flags an archive or merge of an unconfirmed record whose subject, or the
subject that applies with it, holds a live record the user ever confirmed. In
the table, a confirmed record is one the user ever confirmed, as in the plan.
The script decides each action by these rules:

| Action | Unconfirmed project records | Confirmed records | Shared records |
| --- | --- | --- | --- |
| `consolidate` of overlapping records | Applied and journaled; `confirmed-overlap` flag beside confirmed guidance | Stored proposal | `shared-overlap` flag |
| `archive` of a duplicate of live guidance or of another record | Applied and journaled; `confirmed-subject` flag beside confirmed guidance | `confirmed-duplicate` flag | `shared-proposal` flag |
| `contradiction` between two records | `conflict` flag | Queued for the user | Queued when either is confirmed |
| `flag` (`conflict`, `unused`, `live-edit`) | Flag | Flag | Flag |

Shared records are flagged, not consolidated or archived, until a later release
adds shared consolidation. A contradiction may pair a project record with a
shared record of the same subject key; the input then lists both subjects with
their digests. Nothing changes either record, and both subjects are reviewed
again. A proposal always holds a record that is confirmed now, so its
replacement carries `[confirmed]` after the user's approval. A merge becomes a
`confirmed-overlap` flag instead when its replacement repeats the text of a
confirmed live shared record, which retrieval would then leave out, or when the
user once confirmed a target that is not confirmed now. It becomes an
`unsafe-overlap` flag when the replacement would copy a subject key or linked
subject that the new-text guard refuses. `apply` works out under the memory lock
which subjects are due, as the plan does. A subject that is not due, such as
one marked `context`, takes only a contradiction that names a record of a due
subject that applies with it; any other action there stops the run. A subject
listed without a subject that applies with it takes no archive or merge; one
there stops the run. An `unused` flag
needs local analytics. A
`live-edit` flag, and an archive of a duplicate of live guidance, name a live
source that is present on this machine. The script never edits
`CLAUDE.md`, `AGENTS.md`, roles, coding standards, or skills.

An archive names an active record, or a present live source as
`live:<source>`, as its duplicate. A run keeps each record that an archive
names as its duplicate, and both records of each contradiction it queues for
the user. Later runs keep both records of a queued contradiction while both are
live and either is confirmed. Only `operations.jsonl` records a queued
contradiction, but each one names a confirmed record of the subject or of the
subject that applies with it, so after that file is lost a run still archives
or merges neither record. They keep both records of a contradiction that
memory records the same way, and the first run that lists its subject queues
it. No action in the run may
archive or consolidate a kept record, even as a flag or a proposal, whatever
the order of actions. So two records cannot be archived as duplicates of each
other, and no run settles a contradiction that waits for the user. A record that still
replaces superseded guidance is never archived or consolidated.

## Apply

`apply` checks, in this order, and stops at the first failure:

1. Refuses, before it writes anything, when `operations.jsonl`,
   `annotations.json`, or `proposals.json` cannot be read or the annotation
   watermark does not match memory. The plan shows no confirmation then, so a
   run could otherwise change guidance the user confirmed. An older plugin or
   an interrupted write can leave the watermark behind; the next Field Guide
   write that takes the memory lock reconciles it and voids confirmations, and
   then you plan again. `apply` also refuses when `annotations.json` cannot
   show which records the user ever confirmed: it is missing while memory holds
   guidance, or has no entry for a record that memory holds and a shared import
   did not create. Restore the file if it was moved or replaced; a store that
   never had one gets it with its next capture or confirmation. The lock's
   reconcile never creates an entry for a record that the watermark lists, so
   a lagging watermark does not hide a lost file. An older plugin copy, 6.10.1
   through 6.17.0, that reconciles after the loss writes entries for every
   record and leaves no trace, so `apply` cannot protect a record whose only
   confirmation the lost file held; the planned single-document store removes
   this case. `apply` also
   refuses when a file lost part of the store's history: the watermark does not
   list exactly the records memory holds; `annotations.json` shows no
   confirmation of any record in a group that a finished run recorded as
   confirmed (a `confirmed-duplicate` target, a queued contradiction, or a
   proposal's targets), as after an older copy rebuilt it; or
   `operations.jsonl` lacks an operation that memory records, or the undo that
   a restore names. Restore the file that lost it. Otherwise `apply` reads
   confirmations as the plan does, counting every record the user ever
   confirmed.
2. Returns `already-applied` with the stored report for a finished run and
   writes nothing, not even journal recovery. A run is finished when it has a
   `run` entry, or an intent whose operations reached memory. The same input
   with its keys in another order is the same run. The report offers only the
   proposals still in `proposals.json`. A run stays final even after a proposal
   it stored expired; a review after that comes from a new plan, so it is a new
   run. A run that changed no record leaves no trace but its journal entries,
   so after they are lost its replay is a new run. Otherwise `apply` decides
   against the journal and annotations as recovery would leave them, including
   a run that a crash left without its `run` entry, and writes that recovery
   only with the run, once every check passed. A preview or a refused run
   writes nothing.
3. Rejects any confirmation field (`confirmed`, `confirmation`, `confirmations`,
   `approval`, `approved`, `explicitPreference`) anywhere in the input.
4. Validates the schema, the privacy guard on every text, and the allowed
   actions. Every action name, flag kind, ID, and live source must be a string,
   and each live digest a `sha256:` digest; a source that is absent is left
   out, not `null`.
   Every string in an action, including a replacement example's
   language and code, also passes the new-text guard in
   [storage](storage.md#consolidation-and-undo): no user information or query
   string in a URL of any scheme, and no home directory without a trailing
   separator; stored records may still hold these. An
   example's language must be a name such as `sh`. A run reviews at most 50 actions and applies at most 10 changes.
   A consolidation must target 2 to 8 records, must not be longer than they
   are, and must not repeat a declined set. Each consolidation and archive must
   leave a store that the store write accepts, and each proposal and journal
   entry it would store, including the subject key an archive copies from
   memory, must pass its reader's checks and the new-text guard.
5. Compares the live digests and each subject's digest with the current state.
   Any change since the plan, including a new confirmation, stops the run. The
   live guidance is read while the run holds the memory lock, so an edit made
   while the run waited for the lock also stops it.
6. Without `--preview-token`, returns a preview and its token. A preview names
   each proposal by its ID and prints no confirm prompt, because nothing is
   stored yet. With a token, requires the token of the current state.

A run applies all of its actions or none. When one action is invalid or breaks
a rule, the error names it as `subjects[<i>].actions[<j>] (<action>)` and says
the run applied nothing; fix or drop that action and apply again.

An applied run writes every change in one memory write and records a `run`
entry, and only then stores its proposals, so no proposal of a run that failed
can be approved. A crash after the run becomes recoverable and before its
proposals are stored loses them: for a run that changes no record, that is any
point after its `run-intent` entry; otherwise, any point after its memory
write. A lost proposal counts as lapsed, so the next plan reviews its subject
again, and a replay does not offer its prompt. Its report lists each change with its undo command,
each proposal with the `confirm fg:proposal:<id>` prompt to offer, the queued
decisions, and the flags.

## Undo and approval

To reverse an applied change, run `undo-operation --id <operation-id>` on the
machine that applied it; the journal stays local. An undone consolidation is
declined and is not proposed again. Offer a proposal's prompt to the user; never send it. After the
user sends it, run `consolidate --approval proposal:<id>`.
