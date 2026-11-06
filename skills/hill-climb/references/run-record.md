# Run record

Save one record for each climb, including a climb that stops before round 1.

## Location

`~/.hill-climb/runs/<id>/`, where `<id>` is `<YYYY-MM-DD>-<repository name>-<pr<N> or branch name>`. Add `-2`, `-3`, and so on when the directory already exists.

The directory holds:

- `run.json`: the record below.
- `ledger.md`: a copy of the private ledger.
- `report.md`: written by `scripts/build-runs.mjs`. Do not write it by hand.

## `run.json`

Use `schemaVersion: 1`. Every field is required unless marked optional. Write votes as `candidate`, `same`, or `incumbent`, already mapped back from each judge's A/B order.

```json
{
  "schemaVersion": 1,
  "id": "2026-11-04-filip-stack-pr90",
  "date": "2026-11-04",
  "title": "PR #90: standard service tier for Codex delegates",
  "kind": "code",
  "target": {
    "repo": "owner/name",
    "pr": 90,
    "prUrl": "https://github.com/owner/name/pull/90",
    "branch": "fix/example",
    "base": "4d1ce344",
    "head": "f79669f"
  },
  "goal": "One sentence from the climb card.",
  "criteria": [{ "id": "C1", "name": "Clarity", "description": "From the climb card." }],
  "lineup": [{ "member": "Astra", "model": "gpt-6-astra", "effort": "high", "provider": "OpenAI" }],
  "budget": { "rounds": 3, "sizeLimit": 20, "originalChangedLines": 8, "maxCalls": 20 },
  "decisionRule": "judges",
  "score": { "command": "pnpm a11y:count", "direction": "lower", "minGain": 1, "start": 7, "final": 2 },
  "mayChange": ["Focus order in the settings form"],
  "gates": ["pnpm check"],
  "notCovered": ["From the climb card."],
  "rounds": [
    {
      "n": 1,
      "summary": "A short phrase for what this round tried.",
      "proposals": [{ "member": "Opus 5.5", "text": "The proposal.", "status": "applied", "reason": "Optional; required for declined or exhausted." }],
      "applied": ["What the candidate changed, one item per change."],
      "climbChangedLines": 2,
      "gates": "pass",
      "score": 4,
      "votes": [
        {
          "member": "Astra",
          "overall": "candidate",
          "criteria": { "C1": "candidate" },
          "reason": "The judge's overall reason."
        }
      ],
      "decision": "accepted",
      "restore": "Optional: what the restore checked.",
      "next": [{ "member": "Astra", "text": "The judge's NEXT." }]
    }
  ],
  "stop": "The stop rule that ended the climb.",
  "baseline": {
    "summary": "Optional, guidance climbs only: the final version against no guidance.",
    "votes": [{ "member": "Astra", "overall": "final", "criteria": { "C1": "final" }, "reason": "The judge's overall reason." }],
    "score": 1.5
  },
  "final": {
    "votes": [{ "member": "Astra", "overall": "final", "criteria": { "C1": "final" }, "reason": "The judge's overall reason." }],
    "notes": ["Optional: how the start and final evidence were built."],
    "scorecard": [{ "item": "Settings, mobile dark", "start": 7.3, "final": 8.7, "issue": "The Save button sits below the first viewport." }]
  },
  "result": {
    "summary": "What the climb changed, in one or two sentences.",
    "climbChangedLines": 2,
    "committed": false,
    "diff": "The climb's diff against the starting incumbent."
  },
  "attention": ["Optional: what a reader must check, such as a fix made after the climb."],
  "followUps": ["Declined or unapplied suggestions, with the member that raised them."],
  "notes": ["Missing judges, same-provider members, retries, and operator errors."],
  "memberCalls": 13
}
```

Field notes:

- `kind`: `code`, `ui`, or `guidance`.
- `budget.maxCalls`: optional; the card's member-call limit.
- `decisionRule`: optional; `judges`, `score`, or `both`. Leave it out for `judges`.
- `score`: required for `score` and `both`, otherwise left out. `direction` is `higher` or `lower`; `minGain` is the smallest gain that counts; `start` and `final` are the starting and final incumbents' scores.
- `mayChange`: optional; the interactions the card's Behavior field lets the climb change. Leave it out when behavior stays the same, and list each test the climb changed for it under `attention`.
- `rounds[].score`: optional; the candidate's score, for `score` and `both`. Leave it out when a gate failed first.
- `target.pr` and `target.prUrl`: use `null` for a climb on uncommitted work.
- `proposals`: round 1 holds the propose results; later rounds use `[]`. Statuses are `none`, `applied`, `declined`, `exhausted`, or `applied in round <n>`.
- `gates`: `pass`, `fail`, or `blocked`.
- `decision`: `accepted`, `rejected`, or `void`. A round that fails a gate is `rejected` with `"votes": []`. Under `score`, every round has `"votes": []`.
- `result.summary`: the runs list shows it beside the PR title. Write it for someone who has not read the PR: what the climb changed, not how.
- `attention`: optional. Add an item when the result needs a second look, such as a change made after the climb or a fact the gates could not check. The builder adds an item when the final check does not favor the final version.
- `final`: the final check's judge votes. Votes are `final`, `same`, or `start`. When no round was accepted, or under `score`, where `score.final` against `score.start` is the final check, keep `final` with `"votes": []` for a UI or guidance climb's scorecard, and leave it out otherwise.
- `baseline`: required for a guidance climb, otherwise left out. Votes are `final`, `same`, or `baseline`; leave `votes` out under `score`. `score` is the baseline's score; leave it out under `judges`.
- `final.scorecard`: optional, for UI and guidance climbs. One entry per screen and state, or per task. `start` and `final` are the mean 0–10 scores across judges, and `issue` is the issue judges cite most for the final version. A scorecard-only pass leaves `final.votes` empty.
- `memberCalls`: every propose and judge call, including the final check and retries.

## Build the reports

```text
node <skill-directory>/scripts/build-runs.mjs
```

It writes each run's `report.md` and `~/.hill-climb/runs/index.json`.

## Runs page

`assets/runs-page.html` reads `runs/index.json` and `runs/<id>/run.json` from its own directory. When the host can publish a page, copy the page and data into a publish directory:

```text
node <skill-directory>/scripts/build-runs.mjs --page <publish-dir>
```

Publish `<publish-dir>/index.html` with `runs/index.json` and each `runs/<id>/run.json` as supporting files.

`~/.hill-climb/page-url` holds the runs page's URL. When it exists, update that page instead of creating a new one. After creating a page, write its URL to that file.
