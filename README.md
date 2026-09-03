# Filip Stack

Filip Stack is a personal plugin marketplace for Claude and Codex. It distributes
the `workflow` plugin and the optional `field-guide` plugin directly from this
repository.

## Workflow v2

Workflow v2 is intentionally small. Five skills cover the normal engineering
loop without chaining a large collection of procedures together.

| Skill | Use |
| --- | --- |
| `engineering` | Implement, debug, refactor, respond to review feedback, and verify authorized code changes. |
| `planning` | Explore a problem or produce one specification, plan, task set, or ticket set. |
| `technical-writing` | Write or revise finished technical prose, including PR descriptions. |
| `grill-me` | Explicitly stress-test an idea, design, or plan through a focused interview. |
| `walkthrough` | Explicitly inspect and explain a change one verifiable slice at a time. |

`engineering`, `planning`, and `technical-writing` may be selected from a
matching request. `grill-me` and `walkthrough` are manual-only.

### How it stays small

The plugin uses three levels of progressive disclosure:

1. The host sees only each skill's name and description while choosing a route.
2. The selected `SKILL.md` supplies the operating contract.
3. A short reference file is opened only when the selected mode needs it.

Skills do not invoke other public Workflow skills. The two broad routes select
an internal mode instead:

- `engineering` selects implementation, debugging, refactoring, review
  correction, or final verification guidance.
- `planning` selects exploration, specification, plan, tasks, or tickets.

The engineering loop is evidence-driven: define the boundary, establish a test
or reproduction, make the smallest correct change, run focused checks, inspect
the complete diff, and review consequential decisions. Repository tools such as
tests, types, linters, ESLint, and Fallow supply deterministic evidence where
available.

This keeps the useful part of loop engineering: failed evidence returns only to
the affected step, and explicit stop conditions prevent unbounded retries. It is
not a scheduler or unattended loop runner. Complex work can form a small task
graph through dependencies and independent owners, but Workflow does not add a
graph schema, state engine, or orchestration runtime for linear work.

### Artifacts and migration

Most planning and writing stays in the conversation. Persist an artifact only
when the user asks for one. New local artifacts use a flat work-item layout:

```text
~/.engineering-workflow/<work-item>/
├── SPEC.md
├── PLAN.md
├── TASKS.md
├── grills/
└── walkthroughs/
```

Workflow v2 does not install hooks, maintain a topic registry, or mutate local
workflow state automatically. Existing `~/.engineering-workflow` data is left
untouched. After the v2 release is verified, handle migration as a separate,
small task: copy useful artifacts into the simplified layout, verify the copy,
and remove old data only with explicit user approval.

This is a breaking redesign. Removed v1 skills and hooks have no compatibility
aliases.

## Field Guide

Field Guide is a separate, optional plugin. It keeps durable preferences,
corrections, and recurring lessons under `~/.field-guide` and retrieves only a
bounded relevant set. Installing it opts into its `UserPromptSubmit` lifecycle
guidance; leaving it uninstalled keeps that context out of normal Workflow use.

Workflow does not invoke or depend on Field Guide. Current instructions, live
code, and repository contracts continue to outrank stored guidance.

## Repository layout

```text
plugins/workflow/          Runtime plugin shared by Claude and Codex
  .claude-plugin/          Claude manifest
  .codex-plugin/           Codex manifest
  skills/                  The five Workflow skills and conditional references
  THIRD_PARTY_NOTICES.md   Notices for adapted upstream guidance
plugins/field-guide/       Optional local-learning plugin
  hooks/                   Bounded capture, ask, or skip lifecycle guidance
  scripts/                 Cross-host Node launcher
  skills/field-guide/      Skill, storage utility, schemas, and references
tests/workflow/            Repository-only contract and payload tests
tests/field-guide/         Field Guide contracts and utility tests
scripts/                   Version and plugin validation scripts
```

Each marketplace entry installs its plugin directory directly. Tests and
evaluation fixtures stay outside the runtime payload.

## Install with Claude

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack
# Optional local learning:
claude plugin install field-guide@filip-stack
```

Update it with:

```sh
claude plugin update workflow@filip-stack
claude plugin update field-guide@filip-stack
```

## Install with Codex

```sh
codex plugin marketplace add filipgutica/filip-stack
codex plugin add workflow@filip-stack
# Optional local learning:
codex plugin add field-guide@filip-stack
```

Update the marketplace with:

```sh
codex plugin marketplace upgrade filip-stack
```

Restart Codex after installing or upgrading so a new session loads the current
skill inventory.

## Development

Install dependencies and run the complete deterministic check:

```sh
pnpm install
pnpm check
```

The check enforces the five-skill Workflow inventory, declared activation
policy, context budgets, conditional-reference integrity, the separation of
Field Guide hooks and state, both plugins' runtime payloads, and plugin manifest
validity. Prompt routing scenarios are evaluation inputs; static contracts do
not prove model behavior.

## Releases and versioning

CI runs semantic-release after pushes to `main`. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/):

| Commit prefix | Version bump |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` | major |

When a release is due, CI stamps `package.json`, every plugin manifest, and both
marketplace registries before creating the GitHub release.

## Evaluation

[WORKFLOW_V2_PLAN.md](WORKFLOW_V2_PLAN.md) records the design, evaluation
findings that motivated it, success criteria, and the proposed matched
SWE-bench comparison. Paid benchmark runs are intentionally separate from the
runtime rewrite.
