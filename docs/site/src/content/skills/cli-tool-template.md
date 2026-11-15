---
related: [review]
---

## What it does

A checklist covers the repository's files and settings, a docs site, release
setup, and the Homebrew formula. The reference tools are `annoterm`, `wtree`,
and `devps`. The
checklist names Filip's repositories and paths, which another owner should
adapt.

## When to use it

Install the skill, then ask for a new tool, a tap entry, or alignment of an
existing tool:

> Create a new CLI tool called `portwatch` from the CLI tool template.

Use it for a tool that installs through `filipgutica/homebrew-tap` with
`brew install filipgutica/tap/<tool>`, or when a tool's CI, release, or
formula needs to match the shared conventions.

## How it works

The agent follows a live reference tool in the chosen language:

| Language | Choose it for | Reference |
| --- | --- | --- |
| Rust | Interactive terminal UI, speed, or a native macOS bundle | `annoterm` |
| TypeScript on Node | Git, GitHub, process, or JSON-heavy logic | `wtree`, `devps` |

Releases use release-please: merging the release PR tags and publishes the
version. The squashed PR title and body set the bump: `fix:` for a patch,
`feat:` for a minor, and `!` in the title or a `BREAKING CHANGE:` footer in
the body for a major.

Each tool supports `--help` and `--version`, and CI checks the version against
the release manifest. The GitHub Pages site starts from a sibling tool's Astro
and Vue site, uses `@filipgutica/ui`, and has phone and desktop Playwright
checks. After a release, the tap workflow, which runs every 6 hours or by
hand, opens a formula PR.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/cli-tool-template/SKILL.md)
has the complete checklist.

## What you get

- A new or aligned tool, with each checklist item met or recorded as an
  intended difference for its language.
- One PR per repository for the gaps.
- Clean `brew audit --strict`, `brew install --build-from-source`, and
  `brew test` results, locally and in tap CI.
