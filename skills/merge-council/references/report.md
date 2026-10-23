# Chair: verdict and report

Continue from [rounds](rounds.md).

## Verdict

1. Check the subject again. For an open PR, fetch the head and base refs and compare their tips with the final subject. For a merged PR, resolve the merge commit and its first parent again and compare those.
2. Apply the first rule that matches the final subject:
   1. **`NEEDS_HUMAN`** when any of these holds:
      - a member is missing, timed out, or abstained
      - a member did not meet required coverage
      - a blocking finding is contested
      - an agreed blocking finding needs the user's decision
      - the fixer failed, stopped, or could not push
      - the run reached its time limit
      - the head or base moved without a council push
      - the PR changes an instruction file
      - the review diff from merge base to head is empty
   2. **`CHANGES_REQUESTED`** when an agreed blocking finding is still open. In read-only mode agreed findings stay open, and in fix mode this covers the push limit.
   3. **`APPROVE`** when all three final votes are `APPROVE` and no blocking finding is open.
   4. **`NEEDS_HUMAN`** for every other combination, such as a `CHANGES_REQUESTED` vote that no blocking finding supports.

Non-blocking findings, agreed or contested, never prevent `APPROVE`; the report lists them under "Worth a look". `unanimous` is true only when all three members voted `APPROVE` on the final subject. CI is evidence for members, not a verdict rule; the agent that launched you checks CI before it acts.

## Finish

1. Build the JSON record and write it to `<run dir>/record.json`. If you stop before the run directory exists, create it first. Save each member's raw report in the run directory too.
2. Write the Markdown report from the record. Every statement in the report must trace to a field in the record.
3. Remove the review worktree with `git worktree remove --force <run dir>/review` and the run's refs with `git update-ref -d` for each ref under `refs/merge-council/<runId>/`. Leave the run directory.
4. End your reply with the Markdown report alone. The record stays in its file; the report's last line points to it.

## JSON record

```json
{
  "runId": "mc-182-1a2b3c4-20261023T1830Z",
  "status": "complete | incomplete",
  "verdict": "APPROVE | CHANGES_REQUESTED | NEEDS_HUMAN",
  "unanimous": false,
  "mode": "fix | read-only",
  "modeReason": "why read-only, if it is",
  "subject": {
    "repo": "owner/name",
    "pr": 182,
    "headRepo": "owner/name",
    "headRef": "branch",
    "headSha": "full SHA",
    "baseRef": "main",
    "baseSha": "full SHA",
    "mergeBaseSha": "full SHA"
  },
  "chair": { "model": "id", "effort": "high", "verified": false },
  "rounds": [
    {
      "subject": { "headSha": "full SHA", "baseSha": "full SHA" },
      "reconciled": true,
      "members": [
        {
          "lens": "risk",
          "settings": { "model": "id", "effort": "high", "verified": true },
          "attempts": 1,
          "firstVote": "CHANGES_REQUESTED",
          "finalVote": "APPROVE",
          "coverageMet": true,
          "residualLimitations": []
        }
      ]
    }
  ],
  "findings": [
    {
      "id": "R-1",
      "groupedIds": ["R-1", "C-2"],
      "round": 1,
      "status": "agreed | contested | rejected",
      "blocking": true,
      "eligibility": "eligible | excluded:<category> | uncertain",
      "claim": "",
      "evidence": "",
      "remedy": "",
      "resolution": "fixed:<sha> | open | needs-decision | closed",
      "remedyVote": {
        "candidates": { "A": "original remedy", "B": "revised remedy" },
        "ballots": { "risk": { "choice": "B", "blocking": false, "eligibility": "eligible" } },
        "chosen": "B | none"
      },
      "positions": {
        "risk": {
          "classification": "eligible",
          "claim": "agree",
          "remedy": "agree",
          "blocking": "agree",
          "eligibility": "agree",
          "reasons": ""
        }
      }
    }
  ],
  "fixCommits": [ { "sha": "full SHA", "findings": ["R-1"], "summary": "" } ],
  "changedInstructionFiles": [],
  "ci": { "state": "pass | fail | pending | none", "failing": [] },
  "limitations": [],
  "approvalSummary": "present only when verdict is APPROVE"
}
```

- `positions` has one entry per lens. `classification` is the member's own fix-eligibility class from its review; `claim`, `remedy`, `blocking`, and `eligibility` are its reconciliation answers. When a finding needed no reconciliation, every member raised it with the same remedy, blocking class, and eligibility, so record `agree` for all four.
- `remedyVote` is present only when a remedy vote ran; `chosen` is `none` unless all three chose the same candidate with the same blocking class. When a candidate is chosen, `remedy` holds it, and `blocking`, `eligibility`, and each lens's `positions.<lens>.classification` come from the ballots. `positions` otherwise keeps the reconciliation answers.
- `resolution` is `fixed:<sha>` for a pushed fix, `needs-decision` for an agreed finding that is not eligible, `closed` for a rejected finding, and `open` for everything else.
- `approvalSummary` is two to four sentences the launching agent can post as a PR comment: the subject and roster, what the council checked, the fixes it pushed, and any notes worth a reader's attention.

## Markdown report

The report answers one question in its first line: can this PR merge, and if not, what must the user look at? Write it for a reader who stops after that line. Everything else, including member positions, the roster, and limitations that do not change the verdict, stays in the record.

```md
**Merge council: <VERDICT>.** <one sentence: "Ready to merge." or the single main reason it is not>
<repo>#<pr> at `<short head>` · CI <state> · <n>/3 approve<" · fixes pushed: <short sha>, ..." when any><" · incomplete" when status is incomplete>

**Before merging**
- **<id>** <what is wrong, one line> (`<path:line>`). <the remedy, or the decision the user must make>

**Worth a look**
- **<id>** <non-blocking finding, one line> (`<path:line>`)

Record: `<run dir>/record.json`
```

- **Before merging** appears only when the verdict is not `APPROVE`. List every item that produced the verdict: open blocking findings, findings that need the user's decision, contested blocking findings, and the `NEEDS_HUMAN` condition that matched, such as unmet coverage or a changed instruction file.
- **Worth a look** holds at most three non-blocking findings, the ones most likely to matter. When there are more, end with "<n> more in the record". Omit it when there are none.
- One line per item. Name the finding, where it is, and what to do; leave the per-lens positions to the record.
