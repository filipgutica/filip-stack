---
related: [review]
---

## What it does

A checklist covers the repository's files and settings, a docs site, release
setup, and the Homebrew formula. The reference tools are `annoterm`, `wtree`,
and `devps`. Language, CI steps, and README content can differ by tool.

The checklist names Filip's repositories and paths. For another owner, treat
them as examples to adapt.

## When to use it

Install the skill, then ask for a new tool, a tap entry, or alignment of an
existing tool. For example:

> Create a new CLI tool called `portwatch` from the CLI tool template.

Use it for a tool that installs through `filipgutica/homebrew-tap`, or when an
existing tool's CI, release process, or formula needs to match the shared
conventions. Users install a tool with `brew install filipgutica/tap/<tool>`.

## How it works

The agent follows a live reference tool in the chosen language:

| Language | Choose it for | Reference |
| --- | --- | --- |
| Rust | Interactive terminal UI, speed, or a native macOS bundle | `annoterm` |
| TypeScript on Node | Git, GitHub, process, or JSON-heavy logic | `wtree`, `devps` |

Releases use release-please. Merged work collects in a release PR, and
merging that PR tags and publishes the version. The squashed PR title sets the
bump: `fix:` for a patch, `feat:` for a minor, and `!` or a `BREAKING CHANGE:`
footer for a major.

Each tool supports `--help` and `--version`, and CI checks the version against
the release manifest. The GitHub Pages site starts from a sibling tool's Astro
and Vue site, uses `@filipgutica/ui` for its controls, and has phone and
desktop Playwright checks.

After a release, the tap workflow runs every 6 hours, or by hand, and opens a
formula PR. Tap changes always go through a PR.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/cli-tool-template/SKILL.md)
has the complete checklist.

## What you get

- A new or aligned tool, with each checklist item met or recorded as an
  intended difference for its language.
- One PR per repository for the gaps.
- Clean `brew audit --strict`, `brew install --build-from-source`, and
  `brew test` results, locally and in tap CI.
