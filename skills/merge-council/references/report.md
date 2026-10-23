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

Non-blocking findings, agreed or contested, never prevent `APPROVE`; they appear as notes. `unanimous` is true only when all three members voted `APPROVE` on the final subject. CI is evidence for members, not a verdict rule; the agent that launched you checks CI before it acts.

## Finish

1. Build the JSON record, then write the Markdown report from it. Every statement in the report must trace to a field in the record.
2. Remove the review worktree with `git worktree remove --force <run dir>/review` and the run's refs with `git update-ref -d` for each ref under `refs/merge-council/<runId>/`. Leave the run directory, which holds the member reports.
3. End your reply with the Markdown report followed by the fenced JSON record. The report carries findings with evidence, not member transcripts.

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
- `resolution` is `fixed:<sha>` for a pushed fix, `needs-decision` for an agreed finding that is not eligible, `closed` for a rejected finding, and `open` for everything else.
- `approvalSummary` is two to four sentences the launching agent can post as a PR comment: the subject and roster, what the council checked, the fixes it pushed, and any notes worth a reader's attention.

## Markdown report

Keep the report to one screen when the PR is clean. Omit a section that would be empty, except Verdict, Subject, Mode, Roster, and Limitations.

```md
## Merge council: <VERDICT>

**Subject:** <repo>#<pr> · head `<short head>` (<head ref>) · base `<short base>` (<base ref>) · run `<runId>`
**Mode:** <fix | read-only (<reason>)> · **Status:** <complete | incomplete> · **Unanimous:** <yes | no>
**Roster:** chair: <model> <effort> · <lens>: <model> <effort> · <lens>: <model> <effort> · <lens>: <model> <effort><" (unverified)" when applicable>

### Lenses
- **Contract and guidance:** <final vote>. <one line>
- **Risk:** <final vote>. <one line>
- **Simplicity and evidence:** <final vote>. <one line>

### Fixes pushed
- `<short sha>` <summary> (<finding ids>)

### Needs your decision
- **<id>** <claim>. Evidence: <evidence>. Proposed: <remedy>. Excluded because: <category or uncertain>.

### Contested
- **<id>** <claim>. Evidence: <evidence>. Contract and guidance: <position>. Risk: <position>. Simplicity and evidence: <position>.

### Open blocking findings
- **<id>** <claim>. Evidence: <evidence>. Remedy: <remedy>.

### Notes
- <non-blocking finding, one line each>

### CI
<state, and failing checks by name>

### Limitations
- <changed instruction files, sampled areas, unverified settings, retries, missing history, or "none">
```

After the Markdown report, include the JSON record in one fenced `json` block.
