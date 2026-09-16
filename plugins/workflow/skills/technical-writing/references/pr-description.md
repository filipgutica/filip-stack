# Pull request description

Read the actual diff, commits, tests, and linked work item before drafting. Do not infer behavior from a branch name or commit title alone.

Use this compact shape unless the repository provides a required template:

```md
## Summary

Closes/Addresses: <ticket #> (if applicable)

<What changed and why.>

## Changes

- <What changed.>

## How to test/verify

<Steps to test, verify, or view the change, with expected results.>
<For backend changes, example requests and responses can help.>

## Risks or limits

- <Material risk, skipped check, rollout note, or `None`.>
```

Omit the ticket line when no work item applies. Choose `Closes` or `Addresses` to match the relationship.

Include `How to test/verify` only when the change scope warrants actionable instructions, especially for bug fixes and new features. Omit it when it adds no useful guidance. Describe how a reviewer can check the behavior; a list of completed checks is not required.

Add screenshots, rollout steps, or compatibility notes only when they apply. Preserve repository-required checklists and headings.

Do not claim a test, review, runtime check, or deployment ran unless evidence confirms it. Distinguish local verification from CI and production evidence.

Drafting does not authorize creating or updating the pull request.
