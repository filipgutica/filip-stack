# Nightly maintenance

Nightly maintenance ("dreaming") keeps the store small and current. In this
release, a script plans: it prints what a reviewer model needs to find
overlaps, duplicates of live guidance, and contradictions. A later release adds
`apply`, which applies the reviewer's actions by the lifecycle rules. Until
then, act on a finding with `consolidate`, `transition`, or `maintain`, as for
any other change. Read [storage](storage.md#consolidation-and-undo) for
`consolidate`, `undo-operation`, the journal, and proposals.

Run the script with the same Node that runs the utility:

```text
node <field-guide-skill-directory>/scripts/field-guide-dream.mjs plan --repo-root <git-root>
```

## Plan

`plan` prints one bounded JSON packet on stdout. It calls no model and writes
nothing, not even journal recovery. The script never edits
`CLAUDE.md`, `AGENTS.md`, roles, coding standards, or skills. The packet holds:

- The audit: validation errors, stale candidates, unresolved relationships,
  broken pointers, orphan evidence, and oversized records, within 32 KiB
  together, with one validation error per line. A text item longer than 1 KiB
  is cut and ends with `…`.
- `live`: a digest of each live guidance source, `claude-md`, `agents-md`,
  `roles`, `coding-standards`, `skills` (one `name: description` line per
  skill in `~/.agents/skills`), and `plugin-skills` (one
  `<plugin>:<name>: description` line per skill of each plugin copy that Claude
  Code or Codex loads, the copies the writer gate checks). Text is included
  only when there is a subject to review, up to 32 KiB per source and within
  the room the subjects leave; a source cut short has `truncated: true`.
- `subjects`: every subject with live records. A subject lists its live
  records with their confirmation, triggers, and linked subjects, its
  `digest`, which covers every record field the packet shows, and its
  `overlapGroups` without groups the user declined.
- `pendingOperations`, within 8 KiB.
- `omittedItems`: for each audit list and `pendingOperations` that lost items to
  its limit, how many it lost.
- `omittedSubjects`: the subjects that the 192 KiB limit on the printed packet
  left out. Subjects come first within that limit after the audit and pending
  operations, and live text fills what they leave.

The packet holds no evidence, prompts, or transcripts. Every home directory,
with or without a separator after it, and the guide root are replaced with `~`
and `<guide-root>` before any text is measured or cut. Live text, record text,
and each audit item on its own are redacted before they are measured or cut:

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
- Each other line is replaced whole when it holds an `http` or `https` URL
  query string, percent-encoded text, a credential token or assignment, a
  private key marker, or a line-start `user:`, `assistant:`, or `system:`
  marker.

## Undo and approval

To reverse a consolidation, run `undo-operation --id <operation-id>` on the
machine that applied it; the journal stays local. An undone consolidation is
declined and is not proposed again. When `consolidate` returns
`approval-required`, it has stored a proposal. Offer a
proposal's prompt to the user; never send it. After the
user sends it, run `consolidate --approval proposal:<id>`.
