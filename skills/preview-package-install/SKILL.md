---
name: preview-package-install
description: Use when you need to install preview packages into the current repository from an explicit preview package list, then optionally prepare the result for commit and push. Ask for the preview package names/specifiers first, detect pnpm workspaces in the current repo, and if workspaces exist ask which workspace should receive the install.
---

# Preview Package Install

Install preview packages into the current repo with the smallest correct change.

## Workflow

1. If the user already provided preview package names/specifiers in the prompt, use them directly.
2. Otherwise ask for the preview package names/specifiers to install.
3. If the user gives package names without versions, ask for the exact preview specifiers needed for installation.
4. Inspect the current repo for pnpm workspace support:
   - `pnpm-workspace.yaml`
   - root `package.json` `workspaces`
5. If workspaces exist, ask which workspace should receive the preview packages.
6. If no workspace file exists, install at the repo root.
7. Install the preview packages using the repo's existing pnpm conventions and the target manifest location.
8. Keep the diff focused on the target package manifest and lockfile unless something else is required for the install to work.
9. After installation, summarize what changed and present the user with two choices:
   - commit + push the changes
   - provide feedback if something looks wrong

## Rules

- Do not proceed past discovery until you have either the source PR or the package list.
- Prefer existing repo conventions over inventing new package manager behavior.
- Do not install into an arbitrary workspace when multiple pnpm workspaces exist; ask first.
- Do not make unrelated refactors while touching package manifests.
- If installation fails, report the failure and what was attempted before taking any follow-up action.
