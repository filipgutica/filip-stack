---
related: [review]
---

## What it does

CLI tool template creates or aligns Filip's personal command-line tools with
a shared repository, release, and Homebrew setup. It keeps the conventions
consistent while allowing language-specific builds, tests, and documentation.

## When to use it

- Create a personal CLI tool.
- Add a tool to `filipgutica/homebrew-tap`.
- Align an existing tool's repository, CI, release configuration, or formula.

The language follows the tool's needs. The source examples are `annoterm`
for Rust, `wtree` for TypeScript on Node, and `devps` for a single Python script.

## How it works

The skill provides a checklist for the tool repository and its Homebrew tap,
the repository that holds installation formulas.

- Uses release-please. Merged changes accumulate in a release PR; merging
  that PR tags and publishes the version.
- Checks required files, CI workflows, release configuration, repository settings,
  and the `--version` and `--help` interface.
- Copies the shared release and PR-title workflows exactly. CI follows the
  language and checks that `--version` matches the manifest.
- Uses Conventional PR titles for versioning. The squash commit's title and
  body carry the release information.
- Adds a formula, archive hash, update-workflow entry, and tap tests for a
  new tool. Tap changes go through a PR.
- Verifies installation and a real command with Homebrew checks.

For an existing tool, every checklist item must match or have a recorded,
intended language-specific difference. Gaps become one PR per repository,
which can receive a separate [review](../review/).

## What you get

- A tool setup or alignment measured against the shared checklist.
- Language-specific build and CI requirements, plus release and formula guidance.
- Completion criteria that include `brew audit --strict`, installation from
  source, and `brew test` locally and in tap CI.
