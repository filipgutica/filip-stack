# Report

Build the JSON record first, then write the Markdown report from it. Every statement in the report must trace to a field in the record.

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
- `approvalSummary` is two to four sentences the invoking agent can post as a PR comment: the subject and roster, what the council checked, the fixes it pushed, and any notes worth a reader's attention.

## Markdown report

Keep the report to one screen when the PR is clean. Omit a section that would be empty, except Verdict, Subject, Mode, Roster, and Limitations.

```md
## Merge council: <VERDICT>

**Subject:** <repo>#<pr> · head `<short head>` (<head ref>) · base `<short base>` (<base ref>) · run `<runId>`
**Mode:** <fix | read-only (<reason>)> · **Status:** <complete | incomplete> · **Unanimous:** <yes | no>
**Roster:** <lens>: <model> <effort> · <lens>: <model> <effort> · <lens>: <model> <effort><" (unverified)" when applicable>

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
