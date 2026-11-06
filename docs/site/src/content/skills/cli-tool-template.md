---
related: [review]
---

## What it does

The checklist covers repository files and settings, a docs site, release
configuration, and the Homebrew formula. Its reference tools are `annoterm`,
`wtree`, and `devps`; language, CI steps, and README content can vary by tool.

It names Filip's repositories and paths. For another owner, treat those as
examples to adapt.

## When to use it

Install the skill with the command above, then ask for a new tool, tap entry,
or alignment of an existing tool. The agent selects it when your request
matches. For example:

> Create a new CLI tool called `portwatch` from the CLI tool template.

Use it when the tool will install through `filipgutica/homebrew-tap`, or when
an existing repository's CI, release process, or formula needs to follow the
shared conventions. The user-facing install command is
`brew install filipgutica/tap/<tool>`.

## How it works

The implementation follows a live reference in the chosen language:

| Language | Choose it for | Reference |
| --- | --- | --- |
| Rust | Interactive terminal UI, speed, or a native macOS bundle | `annoterm` |
| TypeScript on Node | Git, GitHub, process, or JSON-heavy logic | `wtree`, `devps` |

Merged work collects in a release-please release PR. Merging that PR tags and
publishes the version. The squashed PR title and body determine the bump:
`fix:` for patch, `feat:` for minor, and `!` or a `BREAKING CHANGE:` footer
for major.

Each tool supports `--help` and `--version`; CI checks the version against the
release manifest. The GitHub Pages site starts from a sibling tool's Astro
and Vue site, uses `@filipgutica/ui`, and has phone and desktop Playwright checks.

After release, the tap workflow runs every 6 hours or by hand and opens a
formula PR. Tap changes always go through a PR.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/cli-tool-template/SKILL.md)
has the complete repository, site, and tap checklist.

## What you get

- A new or aligned tool, with each checklist item met or recorded as an
  intentional difference for its language.
- One PR per repository for the gaps.
- Verification through clean `brew audit --strict`, `brew install --build-from-source`,
  and `brew test` results, locally and in tap CI.
