---
name: full-send
description: Take a change or pull request to a merged PR, or to a pass or fail verdict for human review, while the user is not watching. Reviews the code and the PR description with sol-loop, babysits CI and review bots with babysit-pr, fixes routine findings, and finishes the open items of an earlier merge council. Manual only, so invoke it with `/full-send` or `$full-send`.
disable-model-invocation: true
---

# Full Send

The user is not watching this thread. Your updates and your final message go
unread until long after you stop. You own the work from its current state to a
merged PR, or to a verdict that tells the user whether the PR is ready for
human review.

This is the light review path: one Sol reviewer, routine fixes in the loop,
and the user only for what needs them. Use merge council for a full
three-model review.

Requires the `sol-loop` and `babysit-pr` skills. If either is missing, stop
and say so.

## Grant

Invoking full send grants permission to:

- Commit and push fixes to the PR's own branch, in fix mode.
- Force-push the PR's own branch with `--force-with-lease` after a rebase.
- Merge the PR when the merge gate passes, in merge mode.
- Use the test methods that Proof needs, without asking first.

### Testing permission

If a project file or other instruction says to ask before a test method, or to
leave testing to the user, this request replaces that rule for this task. That
includes computer use, browser automation, simulators and devices, running the
app or a dev server, screenshots, and visual checks. Use the method that gives
direct proof and list it in the report.

Rules about how to test still apply: follow rules that name the correct
command, fixture, or check. The permission covers only the tests this task
needs. It does not cover the steps under "Asking the user", and it does not
bypass a harness or system approval prompt.

## Modes

Decide both at the start and check them again before you finish.

- **Fix mode** applies when you authored the PR, or it does not exist yet, and
  you can push to its head repository. Otherwise review only: report findings
  and do not push.
- **Merge mode** applies in fix mode when
  `gh api repos/<owner>/<repo> --jq .permissions.push` is true for the base
  repository and `gh pr view <url> --json reviewDecision`
  is not `REVIEW_REQUIRED` or `CHANGES_REQUESTED`. Otherwise use **verdict
  mode**: finish with PASS or FAIL and do not merge or request reviewers.

## Starting point

- **Local change:** complete the goal from the user's request with the
  smallest change that works. If you are on the default branch, create a
  branch first.
- **Existing PR:** start from its head.
- **After a merge council:** find the newest
  `${TMPDIR:-/tmp}/merge-council/*/record.json` whose `subject.repo` and
  `subject.pr` match the PR and whose verdict is not `APPROVE`, or a record
  path the user names. Its open items are the work list: findings whose
  `resolution` is `open` or `needs-decision`, contested blocking findings,
  changed instruction files, and unmet coverage. Each item needs a fix that
  Sol accepts, or the user's decision in their own words. Invoking full send
  is not a decision. When the record is `complete`, every member met coverage,
  and the PR head descends from its `subject.headSha`, use that SHA as the
  `sol-loop` base and add the open items to its brief. Otherwise review the
  whole PR.

## Steps

1. **Prove it.** Get proof for every change you make. See "Proof".
2. **Write the description.** For a new PR, draft the title and description
   to a file in `$TMPDIR`, outside the repository. For an existing PR, read
   them. Follow the user's PR-description guidance, then the repository's:
   `AGENTS.md`, `CONTRIBUTING`, `.github/pull_request_template.md`, and
   recently merged PRs. When user-level instructions point to a skill or
   reference for PR descriptions, resolve it to the file that holds the format.
   Add verification only for proof CI does not report, such as a
   reproduction, a request with its expected result, or a screenshot. Never
   list checks CI already reports, such as tests, lint, type checks, or the
   build. Add no AI attribution or model footer.
3. **Review with `sol-loop`.** Add the description section below to its round 1
   brief, so Sol reviews the title and description with the code.
4. **File the PR** if none exists. Rebase onto the latest default branch
   first. Open a real PR, not a draft, so review bots run. For an existing PR
   in fix mode, apply the reviewed title and description with `gh pr edit`.
   In review-only mode, list the corrections in the report instead.
5. **Babysit the PR** with `babysit-pr`. In fix mode, fix real findings and CI
   failures, and get proof for each fix before you push it. In review-only
   mode, report them instead. A fix that changes behavior
   gets a `sol-loop` follow-up round while its budget lasts.
6. **Finish.** In merge mode, merge when the merge gate passes. In verdict
   mode, finish when the merge gate passes except for human approval.
7. **Report.** See "Report".

Stay active from step 1 to step 7. If you end your turn while checks or bots
are pending, the work stops. Wait with the watcher from `babysit-pr`. Before
you stop without a merge, call `unwatch_pull_request` in T3 Code.

### Description review

Add this to the `sol-loop` round 1 brief. Sol has no history, so give paths
and text, not references to this conversation.

```
Also review the PR title and description: <draft file path, or the PR URL to read with gh pr view>.
Guidance: <absolute paths of the files that hold the PR-description format>.
Check that every claim matches the diff and the checks, that the description
states the problem before the solution, follows the guidance, and holds only
what a reviewer needs.
blocker = a claim the diff or checks do not support. should = breaks the
guidance, buries the problem, lists implementation details instead of
explaining the change, adds text a reviewer does not need, or has a
verification section or line that restates checks CI already reports, such
as tests, lint, type checks, or the build. nit = wording.
```

## Routine fixes and the user's decisions

Fix in the loop any agreed finding whose smallest fix does not:

- change a public contract
- change a migration or data
- touch security: authentication, authorization, secrets, input validation, or
  access control
- change a dependency
- remove a test without evidence that a named remaining test catches the same
  regression

Those go to the user. Keep the PR at the size the user's goal needs, and
decline scope growth with a written reason as `sol-loop` and `babysit-pr`
describe.

## Proof

Proof is evidence you observed yourself in this session: command output, a
reproduction, a screenshot. Use the most direct proof the change allows:

- Reproduce the original failure, apply the fix, then watch the same
  reproduction pass.
- Run the checks that the repository's CI runs.
- Add one focused test that fails without the fix, when the behavior has none
  and the repository has a test setup.
- For UI and runtime behavior, run the app and look at the change. Green
  mocked tests do not prove that the user experience works.

When you cannot prove a change, you do not have full confidence. Ask the user.

## Merge gate

All of these must be true on the latest commit:

- Your proof covers every change in the diff.
- Sol approved the current behavior diff, and no blocker or should is open
  for the code or the description. A fix to a description blocker gets one
  more Sol round; other description fixes need none.
- Every merge council item from the starting point is fixed or decided.
- Required checks are green.
- Review bots have finished, and each finding is fixed or dismissed with a
  written reason.
- No human review still requests changes.
- The branch is up to date with the default branch, and GitHub reports it as
  mergeable.

Right before a merge, fetch and check the PR and the merge mode again. Merge
with the method the repository uses; check its allowed methods and recent
merged PRs. If it uses a merge queue or auto-merge, stay until GitHub reports
the PR as merged. Never use `--admin` or another bypass.

## Asking the user

A question in a normal message goes unseen, and the thread looks done. Use the
harness's question tool: `AskUserQuestion` in Claude Code,
`request_user_input` in Codex. Put all the context in the question: the PR
link, what blocks you, and the options with your recommendation first.

Ask only when you cannot continue alone:

- You cannot prove the change.
- A finding or merge council item needs the user's decision.
- The merge gate cannot pass, and you cannot fix that yourself.
- The next step is outside the grant: deleting data, touching production,
  changing things outside the repository, closing a PR, or force-pushing any
  other branch.
- The goal is ambiguous in a way that changes the result.
- Another PR makes this one obsolete.

Decide everything else with sensible defaults and list those decisions in the
report. If no question tool is available, or it returns no answer, leave the
PR open and unmerged, and start your final message with the question.

## Report

Lead with one line: `Merged: <merge commit>`, `PASS: ready for human review`,
or `FAIL: <the single main reason>`. Then give the PR link, your proof, the Sol
rounds and what they changed, findings fixed and declined with reasons, merge
council items and how each closed, the decisions you made for the user, and
what the user must do next, if anything.
