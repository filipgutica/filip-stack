---
related: [review]
---

## What it does

Filip's command-line tools, such as `annoterm`, `wtree`, and `devps`, are
separate repositories that install with `brew install filipgutica/tap/<tool>`.
This skill holds the checklist that keeps them consistent: the same release
process, repository files and settings, docs site, and Homebrew formula. The
language, CI steps, and README body can differ by tool.

The checklist names Filip's own repositories and paths, so for another
owner it is an example to adapt.

## When to use it

- Create a new personal CLI tool.
- Add a tool to the Homebrew tap, `filipgutica/homebrew-tap`, the repository
  that holds the install formulas.
- Bring an existing tool's repository, CI, release setup, or formula in line.

Install it with the command above, then ask in plain words. An illustrative
request:

> Create a new CLI tool called `portwatch` from the CLI tool template.

## How it works

Each tool picks its language by what it needs, and copies from a live tool in
that language:

| Language | Pick it for | Copy from |
| --- | --- | --- |
| Rust | An interactive terminal UI, speed, or a native macOS bundle | `annoterm` |
| TypeScript on Node | Git, GitHub, process, or JSON-heavy logic | `wtree`, `devps` |

Releases use release-please: merged PRs collect in a release PR, and merging
that release PR tags and publishes the version. PR titles follow Conventional
Commits, and the squashed PR title and body decide the version bump: `fix:`
bumps the patch, `feat:` the minor version, and `!` in the title or a
`BREAKING CHANGE:` footer in the body a major version.

Every tool answers `--version` and `--help`, and its CI checks that
`--version` matches the version in the release manifest. Each tool also gets a
GitHub Pages site built from a sibling tool's site, with Astro, Vue, and
Filip's UI library `@filipgutica/ui`, and Playwright tests at phone and
desktop widths.

A new release reaches Homebrew users through a tap workflow that runs every 6
hours, or by hand, and opens a formula PR. Tap changes always go through a PR.

## What you get

- A new tool, or an existing tool aligned item by item. Each item matches the
  checklist or is recorded as an intended difference for that language.
- One PR per repository for the gaps.
- A tool that is done when `brew audit --strict` is clean and
  `brew install --build-from-source` and `brew test` pass, locally and in the
  tap's CI.
