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
4. Fill the chair brief below and launch the chair as a fresh agent with the roster's `chair` target, asynchronously where the host supports it. The chair sees only its brief, so launch it without this conversation's context.
5. Wait for the chair to finish. Its run limit is 120 minutes; if it has not finished after 150 minutes, cancel it and confirm that it stopped.

### Chair brief

```md
You are the chair of a merge council. Read <skill dir>/references/chair.md and follow it exactly; it names the next file to read at each stage.

- PR: <PR URL>
- Repository checkout: <absolute path of the current checkout>
- Skill directory: <skill dir>
- Host key: <host key>
- Roster: <the chair and three member targets for this host key, as JSON>
- User-level instruction files: <absolute paths of the user-level instruction files you loaded, and the files they reference for delegation roles>
- Started: <UTC timestamp>

This brief authorizes you to delegate to the three members and one fixer named by the procedure, and, in fix mode, to push the fixer's commits as the procedure allows.
```

## 2. Act on the record

The chair returns a Markdown report followed by a fenced JSON record.

1. If the chair failed, was cancelled, or returned no well-formed record, or if the host reports that it ran with a different model or effort than its roster target, write a failure record yourself and give it to the user with any chair output shown separately:

   ```json
   { "status": "incomplete", "verdict": "NEEDS_HUMAN", "unanimous": false, "pr": "<PR URL>", "chair": { "model": "<id>", "effort": "<effort>" }, "reason": "<what failed>" }
   ```

   A record with `status: incomplete` also means `NEEDS_HUMAN`.
2. Give the user the chair's report unchanged. Keep the verdict and findings as the council wrote them, and leave the review to the council.
3. Before you act on `APPROVE`, confirm that the PR's head SHA and base SHA still match `subject` in the record and that CI passes.
4. Act under the repository's guidance and the user's instructions:
   - **`APPROVE`:** where guidance allows merging on council approval, merge with `gh pr merge --match-head-commit <headSha>` and post `approvalSummary` as the PR comment. Otherwise report that the PR is ready.
   - **`CHANGES_REQUESTED`:** report the open blocking findings.
   - **`NEEDS_HUMAN`:** hand the "needs your decision", contested, and limitation items to the user.
