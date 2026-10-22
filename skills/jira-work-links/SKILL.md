---
name: jira-work-links
description: >-
  Use when creating, correcting, or reviewing Jira links, blockers, dependency
  order, parent or Epic relationships, or Development references. Use also when
  finding pull requests or commits for a Jira issue. Do not use for a simple Jira
  summary that does not need relationship or development evidence.
---

# Jira work links

Use evidence from Jira and the source repository to build the smallest accurate
work graph. Treat hierarchy, context, implementation, validation, and release as
different relationships.

## Workflow

1. Read every named issue. Record its type, status, parent, description, links,
   and Development section before you make a change.
2. Inspect the Development section first. Record each linked repository, pull
   request state, merge commit, commit, and build that affects the requested work.
3. If the code reference is absent, search the source host for the exact Jira key.
   Search pull request titles, bodies, branch names, and commits. Then search by
   the product term, source term, and semantic equivalents.
4. Trace the artifact that each issue produces or consumes. Draw the intended
   relationship graph before creating or removing links.
5. Apply only changes the user authorized. Reading Jira and source evidence does
   not grant permission to edit issues, transition status, or publish links.
6. Refetch every affected issue after a write. Verify the rendered relationship
   on both sides and report the final graph in plain language.

## Relationship rules

- Use **blocks** only when issue A has an unfinished artifact that issue B needs.
  State the artifact explicitly.
- Use **relates to** for owning Epics, specifications, context, parallel work, and
  already-merged implementation that does not prevent the target from starting.
- Use parent and child relationships for scope hierarchy. Do not treat hierarchy
  as a dependency.
- Use duplicate only when both issues track the same required outcome.
- Do not infer dependency from issue numbers, creation order, status, ownership,
  or the order in which tickets were presented.
- A merged pull request proves that implementation exists. It does not prove that
  validation, release, or every acceptance criterion is complete.

For the Atlassian `Blocks` link type, issue A blocks issue B when A is the blocker
and B is the blocked issue. With `createIssueLink`, pass A as `inwardIssue` and B
as `outwardIssue`. After creation, Jira must render:

- On A: **blocks B**.
- On B: **is blocked by A**.

If either side renders differently, remove the incorrect link and recreate it.

## Development evidence

- Prefer Jira's Development section and the authenticated source host over text
  pasted into a description.
- Confirm that a referenced pull request affects the ticket contract or acceptance
  criteria. A matching key alone is not enough.
- Record the repository, pull request URL, state, merge commit when present, and
  remaining validation or release work.
- If the pull request is merged but the issue remains in Verify, identify the
  missing validation. Do not treat the issue as Done or as a blocker yet.
- If the Development section misses a known pull request, use the repository
  integration's key-based association. Add a generic web link only when the
  integration cannot show the reference and the user requests it.

## Final check

Before finishing, confirm:

- Every blocker has a named unfinished artifact.
- Owning Epics and context use `relates to` unless they truly produce that artifact.
- Parallel tickets do not block each other.
- Each pull request reference has a verified repository and state.
- Both sides of every dependency render in the intended direction.
