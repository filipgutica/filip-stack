---
name: hill-climb
description: Improve a finished change, or climb toward an open-ended goal such as better UX across named paths, in a few bounded rounds. A blind council proposes and judges; a candidate wins by judge majority, a deterministic score, or both, and only while every gate passes. Needs council. Manual only, so invoke it with `/hill-climb` or `$hill-climb`.
disable-model-invocation: true
---

# Hill Climb

Polish the thread's change after it already works, or climb toward a goal
the user names, such as better UX across a set of paths. Each round makes one
candidate, gates it, and compares it with the incumbent. Keep the candidate
only when it wins under the card's decision rule and every gate passes.
The user may add a focus, such as "tighter spacing" or "simpler code".

Requires the `council` skill. If it is missing, stop and say so.

## Terms

- **Incumbent:** the version the climb keeps. At the start, it is the
  thread's change as it stands.
- **Candidate:** the incumbent plus one round's changes.
- **Gate:** a pass/fail check, such as tests, lint, type checks, or
  screenshot capture.
- **Criteria:** three to five named qualities the judges compare.
- **Score:** one number that a frozen command prints for a version, such as
  an accessibility violation count.
- **Fresh start:** the starting incumbent has no changed lines against the
  base, as in an open-ended climb.
- **Queue:** the ranked proposals, each marked open, applied, declined, or
  exhausted.

## Authority

- Only this thread edits files. Council members propose and judge read-only.
- Invoking the skill authorizes the card's round budget and member calls, so
  `council`'s one-round default does not apply.
- Commit only when the thread already authorized commits. Push or merge only
  when the thread authorized that.
- Change the working tree only, inside the scope. Undo a candidate with the
  Restore steps only, never with the Git stash stack, `git clean`, or a broad
  checkout.
- Keep public interfaces and features as they are. Keep behavior as it is,
  except the interactions the card's Behavior field names. A broken change or
  a new feature is outside the climb.

## 1. Climb card

Find the base after `git fetch origin`:

- PR: `git merge-base HEAD origin/<baseRefName>`, with `baseRefName` from
  `gh pr view --json baseRefName`.
- Local: `git merge-base HEAD origin/<default-branch>`.
- No remote: a base the user names, or `HEAD` for uncommitted changes only.
- Open-ended goal, with no change to polish: `HEAD`. The scope is the files
  under the paths the user names, listed when the card freezes.

The change is base to working tree, with untracked files. Its paths are the
scope, unless the user names the paths. Changed lines are added plus deleted
text lines from `git diff --numstat <base> -- <scope>`, counting each
untracked file's lines as added.

Build the card and freeze it before round 1:

- **Goal:** one sentence, from the thread's original request or the user's
  goal.
- **Criteria:** three to five, from the request, the focus, and the guidance
  that owns the work. For UI: the repository's design system, else
  `~/design-language/DESIGN.md` when it exists. For code: repository
  conventions and `~/.agents/CODING_STANDARDS.md` when it exists.
- **Scope:** the change's paths.
- **Gates:** exact commands, run on the runtime versions CI uses, such as its
  Node version, not whatever the shell resolves. For UI, also the exact
  routes, states, widths, and themes to capture, and the repository's
  accessibility checker command if it has one. Record whether screenshots
  come from the repository's tools or the host's browser tools.
- **Evidence:** for code, each version's diff from the base. For UI,
  screenshots of each route and state, plus each version's diff. For
  reader-facing text, each version's text in reading order, with its code
  blocks and captions, plus each version's diff. Take every
  screenshot from a fresh page load: going to a URL that differs only in its
  hash does not reload the page. For guidance, such as a skill or an
  instruction file, the evidence is agents' work under each version, as
  [references/guidance.md](references/guidance.md) describes.
- **Not covered:** what the gates and evidence do not prove. For example,
  screenshots do not prove keyboard behavior.
- **Decision rule:** how a candidate wins: `judges` (the default), `score`,
  or `both`. See Decide.
- **Score:** for `score` and `both`, the exact command, which prints the
  number as its last line of output; whether higher or lower is better; and
  the smallest gain that counts, a positive number. The command and its
  scripts and fixtures sit outside the scope. A guidance climb uses the
  answer-key tally from `references/guidance.md` in place of a command.
- **Behavior:** `keep` (the default), or the interactions the climb may
  change, such as "focus order in the settings form". Put the tests that
  assert those interactions in the scope.
- **Budget:** 3 rounds by default, 10 at most. Member calls: a limit only
  when the user sets one.
- **Size limit:** the most lines the whole climb may change, measured
  against the starting incumbent. By default, the larger of 30% of the
  original change's changed lines and 20 lines. Use another limit when the
  user or the invoking thread sets one, or when the request needs more room,
  such as a rewrite or a fresh start. Record the reason on the card.

When the request gives no change to polish, or leaves the scope, the
criteria, the decision rule, or the budget unclear, ask the questions in
[references/intake.md](references/intake.md) and wait for the answers.
Otherwise derive the card from the thread. Show the card and continue
without waiting.

## 2. Baseline

Stop before round 1 and report the item that blocks when:

- A scoped path has staged changes: `git diff --cached --name-only -- <scope>`.
- A required gate or evidence item cannot run, such as a missing tool, route,
  or fixture. A block never counts as a pass.
- A gate fails on the incumbent. For reader-facing text, this includes a
  false claim, checked against its source as Gate describes.
- For `score` and `both`: the score command fails, prints no number, or
  gives two different numbers in two runs on the incumbent. Record the
  incumbent's score.
- Fewer than two council members can run. Follow `council` and ask before
  you launch with fewer members than its lineup.

Finish the baseline before you send any propose brief, so a blocked climb
spends no member calls.

Make a work directory outside the repository, `$TMPDIR/hill-climb/<random>/`.
Keep its path in this thread only: other climbs may share `$TMPDIR`, so never
write the path to a fixed-name file. Judges never see the directory:

- `start/`: a frozen copy of the scoped files, for the size limit.
- `now/`: the current scoped files, recreated empty before each measurement.
- `snapshot/`: the incumbent. Copy each scoped path with `cp -p`, and write
  `manifest.tsv` with path, exists (`yes` or `no`), mode (the first field of
  `ls -l`), and SHA-256 hash.
- `ledger.md`: the private ledger, with every brief sent, each judge's A/B
  mapping, and each round's created files and outcome (accepted, rejected,
  or void).

Refresh `snapshot/` and the manifest each time a candidate is accepted.
Files the candidate created join the scope and the manifest. Files it deleted
stay in the manifest as `no`.

### Check

Before each round and after each restore, compare the scope with the
manifest: exists, mode, and hash. Before you restore or accept a candidate,
compare the scope with `candidate.tsv`, which Apply writes in the same
format. On any difference, something outside the climb changed the files.
Stop, report the paths, and change nothing further. Do not restore: a
restore would overwrite those changes.

### Restore

1. Copy each manifest path marked `yes` back from `snapshot/` with `cp -p`.
   This also re-creates a file the candidate deleted.
2. Remove each manifest path marked `no` that now exists, and each file
   `ledger.md` lists as created in this round. Remove nothing else.
3. Run the check.

If the climb fails or is cancelled during a round, restore before you report,
unless the check found outside changes.

## 3. Rounds

Convene members by `council`'s Convene section: lineup, model availability,
separate contexts, read-only members, and completion. Each propose and judge
call gets a fresh context. A judge never reuses a proposing context. The
report states when two members come from the same provider. Before you retry
a member that reported an error, check whether it ran: a late reply still
counts, and a retry is a new call.

Run each round in order:

1. **Check.** Run the check.
2. **Propose.** Round 1 only. Send each member the propose brief. Add their
   proposals to the queue with member and rank. Later rounds use the queue.
   In a UI climb, a member that lists unread screenshots does not judge. If
   fewer than two members remain, stop: UI climbs are unavailable.
3. **Select.** Take the highest-ranked open proposals that most members
   raised, or that the evidence clearly supports. Confirm each one still
   applies to the incumbent; otherwise mark it exhausted. Break ties by the
   best rank any member gave, then by the smaller change. Decline proposals
   outside the scope, and proposals that reverse a decision the user already
   made; list those as follow-ups. If nothing can be selected, stop as for an
   empty queue.
4. **Save evidence.** Save the incumbent's evidence before you edit.
5. **Apply.** Make the smallest change that does the selected proposals.
   Record each new file's path in `ledger.md`, then write `candidate.tsv`
   for the scope and those new files. Recreate `now/` empty, copy the scoped
   files and new files to it, and measure the climb with
   `git diff --no-index --numstat start now`. If it exceeds the size limit,
   restore, mark those proposals declined for size, list them as follow-ups,
   and select again without them. A test the round adds must fail on the
   incumbent and pass on the candidate; check both before you judge. A test
   changes only when it asserts an interaction the card's Behavior field
   names; record each such test in `ledger.md` for the report.
6. **Gate.** Run every gate on the candidate. Judges see only the bundle, so
   they cannot tell a true claim from a false one: when the candidate changes
   reader-facing text, check each changed claim against the code or source it
   describes, and treat a false claim as a failed gate. When only that
   claim check fails, repair once: correct each false claim from its source,
   or undo only the edit that made it and mark that proposal declined. Record
   the repair in `ledger.md`, rewrite `candidate.tsv`, measure and handle the
   size limit as in Apply, and run every gate again.
   On any other failure, or a second failure, restore, record the round as
   rejected, and mark its proposals declined. End the round there: skip
   Judge and Decide, and apply the stop rules.
   For `score` and `both`, run the score command on the candidate once the
   gates pass. A command that fails or prints no number fails the gate.
7. **Judge.** For `judges` and `both`, build one bundle per judge and send
   each the judge brief.
8. **Decide.** Apply the decision rules.

### Bundle

Put each bundle in its own directory, `$TMPDIR/<random>/`, away from the work
directory. Give the judge its absolute path. No path or file name may show
the round, the order of versions, or which version is new.
Choose the A/B order at random for each judge and record it only in
`ledger.md`.

- `criteria.md`: the card's criteria.
- Code: `A.diff` and `B.diff`, each version's diff from the base:
  `git diff <base> -- <scope>`, plus `git diff --no-index /dev/null <file>`
  for each untracked file. Never the diff between the two versions.
- UI: `A/` and `B/` with the same screenshot names for each route, state,
  width, and theme, holding only the screenshots that differ, plus `A.diff`
  and `B.diff` as for code. Tell the judge when no screenshot differs.
- Reader-facing text: `A.txt` and `B.txt`, each version's full text in
  reading order, plus `A.diff` and `B.diff` as for code.
- Fresh start: in place of `A.diff` and `B.diff`, `A-files/` and `B-files/`
  hold each version's copy of the scoped files that differ between the two,
  under the same relative paths. An empty diff would show which version is
  the incumbent.
- Guidance: each version's attempt outputs, as `references/guidance.md`
  describes.

### Decide

- A judge completes when it replies in the format and lists no unread files.
  A judge that fails, times out, or could not read the bundle is missing.
- For `judges` and `both`, with fewer than two completed judges, the round
  is void. Restore.
- The candidate wins under the card's decision rule:
  - `judges`: a strict majority of completed judges prefers it overall.
  - `score`: its score beats the incumbent's by at least the smallest gain
    that counts. A tie loses.
  - `both`: both of the above.
- A winning candidate becomes the incumbent: refresh the snapshot, record
  its score as the incumbent's, and mark its proposals applied. Once the
  remaining votes cannot change the outcome, you may decide; record each
  late vote when it arrives. When the majority rests on two members from the
  same provider, say so in the report.
- Otherwise, restore, record the round as rejected, and mark the round's
  proposals declined.
- Add a judge's `NEXT` to the queue only when it applies to the incumbent
  after the decision.
- In the ledger, map each judge's answers back to incumbent and candidate,
  with the model that ran, each reason, and any strong dissent.

### Propose brief

```
Review only. Do not edit, commit, push, or start subagents.
Repo: <abs path> Base: <sha> Scope: <paths>
See: git diff <base> -- <scope>; read the untracked scoped files: <list>.
<UI: screenshots of each route and state: <dir>>
Goal: <goal>
Criteria: <criteria>
<Score: <command>; <higher|lower> is better; the incumbent scores <n>.>
Keep public interfaces and features as they are. Stay in scope.
<Behavior keep: Keep behavior as it is.>
<Behavior names interactions: Only these interactions may change: <list>.>
Return up to three improvements against the criteria, best first.
If nothing would clearly improve the change, reply NONE.
<UI: if you could not open a screenshot, list it under UNREAD.>
Reply:
P1 <criterion> <file>:<line> <change>
<UI: UNREAD: <files, or none>>
```

### Judge brief

```
Judge only. Do not edit files or start subagents.
Use only the files in <bundle path>. Do not read the working tree or the repository.
A and B are two versions of the same change.
<Code: A.diff and B.diff are each version's diff from the same base.>
<UI: A/ and B/ hold the screenshots that differ, with matching names; A.diff and B.diff are each version's diff from the same base.>
<Text: A.txt and B.txt are each version's full text in reading order; A.diff and B.diff are each version's diff from the same base.>
<Fresh start: A-files/ and B-files/ hold each version's copy of the files that differ, in place of A.diff and B.diff.>
Compare them against each criterion in criteria.md, then overall.
Answer A, B, or SAME (no meaningful difference), with one reason each.
Then name one improvement you would make next to the version you prefer.
If you could not open a bundle file, list it under UNREAD.
Reply:
C1 <criterion>: A|B|SAME - <reason>
OVERALL: A|B|SAME - <reason>
NEXT: <one improvement>
UNREAD: <files, or none>
```

## 4. Stop

Stop at the first of these:

- The queue has no open proposals.
- Two rejected or void rounds in a row.
- For `judges` and `both`: a strict majority of completed judges answers
  `SAME` overall.
- The round budget is spent.
- The member-call limit could not cover the next round and the final check.
  Under `judges` and `both`, a round costs one call per judge, round 1 adds
  one per proposer, and the final check costs one call per judge. Under
  `score`, only round 1's proposers cost calls. A guidance climb adds its
  attempts. Before each launch in a
  round, including a retry, check that the calls left cover it and still
  leave the final check; otherwise stop. During the final check, the calls
  left need to cover only that check.
- The incumbent's changed lines against `start/` reach the size limit.
  After a restore, measure the incumbent as in Apply.

Leave the final incumbent in the working tree. When other branches are
stacked on the change, rebase them onto the climbed result once it is
committed, and run their gates.

### Final check

Each round compares a candidate only with the version before it, so the
rounds do not show whether the whole climb helped. When at least one round
was accepted under `judges` or `both`, run one more judge pass: the starting
incumbent against the final incumbent. Build the bundles and send the judge
brief as in a round, with `start/` as one version, and map each vote back to
`final`, `same`, or `start`. Change no files. When a strict majority prefers the start, say so
first in the report and recommend dropping the climb.

For `score` and `both`, also compare the start's score with the final
score; under `score`, this comparison is the whole final check. When the
final score does not beat the start's by the smallest gain that counts, say
so first in the report.

## 5. Report

The final reply contains:

- The climb card, including what it does not cover.
- The round ledger: proposals, what changed, gate results, each score, each
  judge's preference attributed to the model that ran, and the decision.
- Tests the climb changed because the Behavior field let an interaction
  change, listed for the user to check.
- The final check's votes, attributed to the model that ran.
- Before and after evidence. For UI, paired screenshots.
- The climb's diff stat against the starting incumbent.
- Follow-ups declined for size or scope.
- Reusable lessons that the original work missed, as plain text.
- Missing judges, and any two members that came from the same provider.
- Where the run record is saved.

### Save the run

Save the run record before the final reply, as
[references/run-record.md](references/run-record.md) describes: `run.json`
and a copy of `ledger.md` in `~/.hill-climb/runs/<id>/`. Then run
`node <skill-directory>/scripts/build-runs.mjs` to write `report.md` and the
index. When the host can publish pages and the user keeps a runs page, offer
to republish it from the records.
