# Filip Stack

Filip Stack is a set of skills and agent setup for Claude Code and Codex. A
skill is a set of reusable instructions that an agent loads when a task needs
them, such as reviewing a change or writing a plan. The
[Filip Stack site](https://filipgutica.github.io/filip-stack/) explains each
skill.

## Try Workflow

Workflow is a plugin with five skills for engineering work: planning, code
changes, review, test audits, and technical writing. Install it from this
repository's plugin marketplace, a catalog that the `claude plugin` and
`codex plugin` commands read:

```sh
# Claude Code
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack

# Codex, then restart it so a new session loads the plugin
codex plugin marketplace add filipgutica/filip-stack
codex plugin add workflow@filip-stack
```

Then, in a repository with changes on a branch, ask:

> Review the changes on this branch against main.

The agent picks the `review` skill on its own. It reads every changed file and
reports findings ranked by impact, each with a file and line, or says that it
found nothing it can back with evidence. It changes no files.

Everything below is optional.

## What else is here

| Part | What it is | How it installs |
| --- | --- | --- |
| [Workflow](#workflow) | Five skills that work together on engineering tasks | Plugin |
| [Standalone skills](#standalone-skills) | Skills that each work alone | Skills CLI |
| [Field Guide](#field-guide) | Memory of your preferences and lessons | Plugin |
| [Guardrails](#guardrails) | Hook that blocks AI attribution and asks before 1Password commands | Plugin |
| [Host config](#host-config) | Global guidance, agent profiles, and design system for each machine | Homebrew CLI and a checkout |

## Workflow

Describe the task in your own words, and the host picks the matching skill.
Each skill loads only the guidance its task needs.

| Skill | Use |
| --- | --- |
| `engineering` | Makes the code change you ask for and proves it with tests and checks. |
| `planning` | Writes a direction, specification, PRD, ADR, implementation plan, or tickets from what the repository shows. |
| `test-audit` | Finds tests that duplicate other tests, break on harmless refactors, or need test-only production code. |
| `review` | Reviews one exact change or document and reports only the findings it can back with evidence. |
| `technical-writing` | Writes or revises technical documents so readers can act on them without guessing. |

Plans and other writing stay in the conversation, and ordinary changes create
no extra files, unless you ask for a file. Your instructions and your
repository's guidance override Workflow's default formats. Workflow installs
no hooks.

To update the plugins:

```sh
# Claude Code
claude plugin update workflow@filip-stack
claude plugin update field-guide@filip-stack
claude plugin update guardrails@filip-stack

# Codex, then restart it
codex plugin marketplace upgrade filip-stack
```

## Standalone skills

Install only the standalone skills you want, with the
[skills CLI](https://github.com/vercel-labs/skills).

| Skill | Use |
| --- | --- |
| `agent-ready-environments` | Audits a repository or its agent guidance for how well agents can check their own work. |
| `babysit-pr` | Watches a PR through CI and automated review and fixes verified problems within its scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `catch-up` | Recaps a thread's goal, progress, and next step in four lines when you return to it. |
| `checkpoint` | Records current work, evidence, and next actions for a pause or handoff. |
| `cli-tool-template` | Creates or aligns Filip's CLI tools with shared repository, release, site, and Homebrew conventions. |
| `council` | Asks several models the same question separately and combines their advice. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `fleet-sync` | Keeps the same filip-stack skills, plugins, and guidance on every machine linked in T3 Code, with per-machine exceptions. |
| `full-send` | Takes a change or PR through review and CI, then merges it or returns a verdict. Needs `sol-loop` and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `full-stop` | Takes a change or PR through review and CI and leaves the merge to you. Needs `full-send`, `sol-loop`, and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `grill-me` | Questions a proposal one decision at a time to expose assumptions and settle consequential choices. Adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills). |
| `hill-climb` | Improves a working change in small rounds and keeps an edit only when blind judges or a score prefer it. Needs `council`. |
| `interface-design` | Designs, builds, reviews, or checks interfaces for task completion and accessibility. Adapted from [frontend-design](https://github.com/anthropics/skills). |
| `jira-work-links` | Creates or checks Jira relationships and verifies the PRs and commits behind an issue. |
| `merge-council` | Runs a council review on a PR, fixes the findings every member agrees on, and returns a merge verdict. Needs `council`. |
| `pr-review-churn` | Finds review objections that recur across your GitHub PRs and proposes guidance to prevent them. |
| `simplify-pass` | Simplifies selected code after three independent reviews, preserving its observable behavior. |
| `sol-loop` | Has Sol (OpenAI's `gpt-6.1-sol`) review a change in rounds and fixes the findings that are in scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `vue-best-practices` | Guides Vue component, composable, and test work with explicit state ownership and component contracts. |
| `walkthrough` | Explains a change in parts and waits for your acceptance of each part. |

List the skills, install one by name, or install a skill with the skills it
needs:

```sh
npx skills add filipgutica/filip-stack --list
npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send full-stop sol-loop babysit-pr -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s hill-climb council -y
```

To update a skill, run its `add` command again. Standalone skills install from
`main` and have no version. Avoid `npx skills update`: it reinstalls into
every agent it detects, not only the ones you chose.

The skills CLI keeps each skill in `~/.agents/skills/<name>` for Codex and
links `~/.claude/skills/<name>` to it for Claude. Workflow and Field Guide
skills install only with their plugins.

`checkpoint`, `grill-me`, and `walkthrough` save notes here when you do not
name a place. A grill log can also go beside the document it questions.

```text
~/.engineering-workflow/<project-or-subject>/
├── checkpoints/
├── grills/
└── walkthroughs/
```

## Field Guide

Field Guide is a separate, optional plugin. It remembers durable preferences,
corrections, and recurring lessons in `~/.field-guide`, so you do not repeat
them each session. The
[Field Guide page](https://filipgutica.github.io/filip-stack/field-guide/)
shows what it saves and when.

```sh
claude plugin install field-guide@filip-stack   # Claude Code
codex plugin add field-guide@filip-stack        # Codex
```

Installing it opts into its `SessionStart` and `UserPromptSubmit` lifecycle
hooks. Workflow does not invoke or depend on Field Guide. Your current
instructions, the live code, and repository contracts always outrank what it
remembers.

## Guardrails

Guardrails is a separate, optional plugin. Its `PreToolUse` hook checks each
shell command your agent runs, including inside `bash -c` and `zsh -i -c`
wrappers.

```sh
claude plugin install guardrails@filip-stack   # Claude Code
codex plugin add guardrails@filip-stack        # Codex
```

| Rule | Commands | Decision |
| --- | --- | --- |
| No AI attribution | `git commit`; `gh pr` and `gh issue` `create`, `edit`, and `comment`; `gh api` writes to pull requests or issues | Deny when a whole line of the message is a `Co-Authored-By` naming an AI or a "Generated with" footer. Lines inside fenced code blocks are examples and pass. |
| 1Password needs approval | `op` in command position | Ask |

If the hook hits an internal error or Node.js is missing, it steps aside and
your normal permission prompts apply. Codex skips plugin hooks until you
review and trust them. Codex hooks cannot ask yet, so on Codex the 1Password
prompt comes from `~/.codex/rules/filip-stack.rules`, which host config
installs. That rule matches only a plain `op …` command. The hook denies other
forms and tells the agent to run the plain one.

## Host config

Host config gives every machine the same global agent guidance, agent
profiles, output styles, and design system. The `filip-stack` CLI applies it
from a checkout of this repository.

### Set up a machine

Clone the repository, keep the checkout on `main`, then install the CLI and
apply:

```sh
git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack
brew install filipgutica/tap/filip-stack
filip-stack apply
```

The [CLI page](https://filipgutica.github.io/filip-stack/cli/#install) covers
another checkout location, running without Homebrew, and a shadowing symlink.

### What apply installs

`apply` copies the shared setup in `host-config/` into `~/.claude`,
`~/.codex`, `~/.agents`, and `~/design-system`:

- the global guidance, in a marked block in `~/.claude/CLAUDE.md` and
  `~/.codex/AGENTS.md`
- Claude agent templates (`critic`, `explorer`, `planner`, `reviewer`,
  `worker-high`) and output styles
- Codex agent profiles and `~/.codex/rules/filip-stack.rules`: the 1Password
  prompt Guardrails relies on, and the usage reader's sandbox exception
- `~/.agents/roles.md` and `~/.agents/CODING_STANDARDS.md`
- the model tiers in `host-config/models.json`, which fill in every model name
  in the guidance and agent profiles
- `~/.agents/scripts/model-usage.mjs`, the usage reader described below
- `~/design-system`, from the pinned
  [`@filipgutica/design-system`](https://github.com/filipgutica/design-system)
  package in `host-config/design-system.json`

Text outside the marked block stays, and wins where it conflicts with the
shared guidance. Apply removes files that the repository no longer has.

Agents use the design system for UX and visual work unless you ask for another
or the repository has its own. See its
[component specs](https://github.com/filipgutica/design-system/blob/main/language/components.md),
[component catalogue](https://filipgutica.github.io/design-system/components.html),
and [data visualizations](https://github.com/filipgutica/design-system/blob/main/language/visualizations.md).
Apply downloads the pinned tarball once, checks its integrity, and caches it
at `~/.cache/filip-stack/design-system/<version>.tgz`
(`$XDG_CACHE_HOME/filip-stack/…` when set). If that version is neither cached
nor downloadable, apply stops before it writes anything. `status` never
downloads; it reports the pin change, such as `design-system 1.0.0 → 1.1.0`.

Threads run `model-usage.mjs` before they delegate, and move work to the
other provider when one is short of usage. The script needs the
[CodexBar](https://codexbar.app) CLI (`brew install --cask codexbar` on macOS,
`brew install steipete/tap/codexbar` on Linux), and uses
[claude-swap](https://github.com/realiti4/claude-swap) when it manages the
active Claude account. Without CodexBar, threads use the role tables as
written. The script needs network and Keychain access, so it runs outside the
sandbox. Host config allows that on Codex. On Claude Code, add this to
`~/.claude/settings.json`, with your home directory:

```json
{
  "permissions": { "allow": ["Bash(node /Users/you/.agents/scripts/model-usage.mjs)"] },
  "sandbox": { "excludedCommands": ["node /Users/you/.agents/scripts/model-usage.mjs"] }
}
```

### Commands

```sh
filip-stack status            # applied commit, then each target's state
filip-stack apply [--force]   # write targets and import shared guidance
filip-stack update [--force]  # on main only: git pull --ff-only, apply, then sync
filip-stack sync              # apply the fleet baseline and refresh this machine
filip-stack sync --dry-run --json # preview without fetching or changing installations
filip-stack field-guide-sync  # import, then export local shared guidance
```

Host config has no version: run `filip-stack update` to pick up changes from
`main`. If you edited managed text locally, apply prints the diff and stops.
The [CLI page](https://filipgutica.github.io/filip-stack/cli/) covers that
recovery and upgrading the CLI launcher.

### Sync this machine or the fleet

`filip-stack sync` installs missing baseline skills and plugins and refreshes
existing ones. It needs a clean checkout that tracks published `main`. It
keeps local guidance, plugin states, pins, and host assignments. A component
it cannot update, such as one with a local edit, does not block the others,
but the command then exits nonzero. Its report goes to
`~/.local/state/filip-stack/last-sync.json` (under `$XDG_STATE_HOME` when
set).

To sync every machine, install `fleet-sync` and ask your agent to sync the
fleet. The policy lives at `~/.config/filip-stack/fleet.json` (under
`XDG_CONFIG_HOME` when set). For example:

```json
{
  "version": 1,
  "baseline": {
    "skills": ["fleet-sync"],
    "plugins": ["workflow", "field-guide", "guardrails"]
  },
  "environments": [{
    "environmentId": "your-t3-environment-id",
    "label": "your-hostname",
    "agents": ["codex"],
    "exclude": { "skills": [], "plugins": ["guardrails"] }
  }]
}
```

- `baseline` lists what every machine gets. Machines keep their extras.
  Without a baseline, sync refreshes existing selections.
- `agents` defaults to `codex` and `claude-code`.
- `exclude` and other per-machine overrides keep exceptions without
  uninstalling anything.

Pass `--environment-id <id>` when the roster label differs from the hostname,
or `--config <file>` for another policy. The fleet workflow passes both, and
T3 keeps credentials and access grants. See
[Fleet Sync](https://filipgutica.github.io/filip-stack/skills/fleet-sync/).

### Share Field Guide preferences

Sync `~/.config/filip-stack/field-guide.json` with a dotfile manager.
`apply` and `update` import it, and `field-guide-sync` also exports this
machine's shared guidance to it. See the
[CLI page](https://filipgutica.github.io/filip-stack/cli/#sync) for the steps,
and [CONTRIBUTING.md](CONTRIBUTING.md#share-field-guide-preferences) for other
locations.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for checks, skill budgets, repository
layout, releases, and evaluation.
