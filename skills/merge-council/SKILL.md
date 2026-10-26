---
name: merge-council
description: Run a merge council on a pull request only when the user, a task, or repository guidance explicitly asks for a merge council or council review. An independent chair agent runs three reviewers and returns a merge verdict bound to the reviewed commits; on the user's own open PRs, agreed findings are fixed and pushed. Also `merge-council setup`.
---

# Merge Council

Run only on an explicit request for a merge council. A general request to review a PR belongs to other review skills.

The council is independent of you. You launch one **chair** agent, and the chair runs the whole council: it freezes the subject, briefs three members, reconciles their findings, hands agreed fixes to a fixer, and applies the verdict rules. You take no part in the review. Your job is to start the council and then act on its record.

## 1. Launch

1. If the argument is `setup`, follow [setup](references/setup.md) and stop.
2. Load `~/.config/merge-council/roster.json`. Select the host key: `t3` when the T3 orchestration tools are present, otherwise the current host (`claude`, `codex`, or another host name). If the roster has no chair and three members for that key, run [setup](references/setup.md) first. Validate the chair target against what the host offers now, as [setup](references/setup.md) describes; on a mismatch, stop and suggest `merge-council setup`.
3. Resolve the PR URL: the argument, or `gh pr view --json url` for the current branch. If there is no PR, stop and say so.
4. Find a repository checkout whose remotes include the PR's base repository, in this order:
   - a checkout the user named
   - the current checkout, when one of its remotes matches
   - a clone of the base repository at `${TMPDIR:-/tmp}/merge-council/clones/<owner>-<repo>`, created with `gh repo clone` when missing and reused across runs
5. Find the prior run: a record path the user names, otherwise the newest `${TMPDIR:-/tmp}/merge-council/*/record.json` whose `subject.repo` and `subject.pr` match this PR and whose verdict is not `APPROVE`. A follow-up run continues that council through its record. It does not resume the old agents: every round is a fresh task that carries the earlier findings. If the user has answered findings from that run, pass their words unchanged, with the finding IDs. If no prior run exists, say so and run fresh.
6. Fill the chair brief below and launch the chair as a fresh agent with the roster's `chair` target, asynchronously where the host supports it. The chair sees only its brief, so launch it without this conversation's context.
7. Wait for the chair to finish. Its run limit is 120 minutes; if it has not finished after 150 minutes, cancel it and confirm that it stopped.

### Chair brief

```md
You are the chair of a merge council. Read <skill dir>/references/chair.md and follow it exactly; it names the next file to read at each stage.

- PR: <PR URL>
- Repository checkout: <absolute path of the checkout from step 4>
- Skill directory: <skill dir>
- Host key: <host key>
- Roster: <the chair and three member targets for this host key, as JSON>
- User-level instruction files: <absolute paths of the user-level instruction files you loaded, and the files they reference for delegation roles and PR descriptions>
- Prior run: <absolute path of the prior record.json, or "none">
- User decisions: <one line per finding, "<finding id>: <the user's words>", or "none">
- Started: <UTC timestamp>

This brief authorizes you to delegate to the three members and one fixer named by the procedure, and, in fix mode, to push the fixer's commits as the procedure allows.
```

## 2. Act on the record

The chair replies with a short report whose last line names its JSON record, `record.json` in the run directory. The record is for you; the report is for the user.

1. If the chair failed or was cancelled, if its record file is missing or malformed, or if the host reports that it ran with a different model or effort than its roster target, the run is incomplete and the verdict is `NEEDS_HUMAN`:
   - When `record.json` exists, keep the chair's verdict in a new `chairVerdict` field, then set `status` to `incomplete`, `verdict` to `NEEDS_HUMAN`, `unanimous` to false, and `launcherFailure` to what failed. Remove `approvalSummary`.
   - When it does not exist and the run directory is known, write `record.json` there with `status`, `verdict`, `unanimous`, the PR URL, and `launcherFailure`.
   - Tell the user in one line what failed, and show any chair output separately.

   A record with `status: incomplete` always means `NEEDS_HUMAN`.
2. Give the user the chair's report unchanged. Keep the verdict and findings as the council wrote them, and leave the review to the council. Show the record only when the user asks for it.
3. Before you act on `APPROVE`, confirm that the PR's head SHA and base SHA still match `subject` in the record and that CI passes.
4. Act under the repository's guidance and the user's instructions:
   - **`APPROVE`:** where guidance allows merging on council approval, merge with `gh pr merge <PR URL> --match-head-commit <headSha>` and post `approvalSummary` with `gh pr comment <PR URL>`. Otherwise report that the PR is ready.
   - **`CHANGES_REQUESTED`** or **`NEEDS_HUMAN`:** the report's "Before merging" items are the hand-off. Offer to dig into any of them, using the record for detail. After the user addresses them, the next council run on this PR continues from this record.
