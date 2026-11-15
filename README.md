# Filip Stack

Filip Stack is a set of skills and agent setup for Claude Code and Codex. A
skill is a set of reusable instructions that an agent loads when a task needs
them, such as reviewing a change or writing a plan.

The [Filip Stack site](https://filipgutica.github.io/filip-stack/) explains
each skill.

## Try Workflow

Workflow is a plugin with five skills for everyday engineering work: planning,
code changes, review, test audits, and technical writing. Install it from this
repository's plugin marketplace.

In Claude Code:

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack
```

In Codex:

```sh
codex plugin marketplace add filipgutica/filip-stack
codex plugin add workflow@filip-stack
```

If you use Codex, restart it so a new session loads the plugin.

Then open a repository that has changes on a branch, and ask:

> Review the changes on this branch against main.

The agent picks the `review` skill on its own. It reads every changed file and
reports findings ranked by impact, each with a file and line. It changes no
files.

That is all Workflow needs. Everything below is optional.

## What else is here

| Part | What it is | How it installs |
| --- | --- | --- |
| [Workflow](#workflow) | Five skills that work together on engineering tasks | Plugin |
| [Standalone skills](#standalone-skills) | Skills that each work on their own | One at a time, with the skills CLI |
| [Field Guide](#field-guide) | Optional memory of your preferences and lessons | Plugin |
| [Guardrails](#guardrails) | Optional hook that blocks AI attribution and asks before 1Password commands | Plugin |
| [Host config](#host-config) | Optional global guidance, agent profiles, and design system for each machine | Homebrew CLI and a checkout |

## Workflow

Workflow gives your agent one skill for each stage of engineering work. You
describe the task in your own words, and the host picks the skill that fits.
Each skill loads only the guidance its task needs.

| Skill | Use |
| --- | --- |
| `engineering` | Makes the code change you ask for and proves it with tests and checks. |
| `planning` | Writes a direction, specification, PRD, ADR, implementation plan, or tickets from what the repository shows. |
| `test-audit` | Finds tests that duplicate other tests, break on harmless refactors, or need test-only production code. |
| `review` | Reviews one exact change or document and reports only the findings it can back with evidence. |
| `technical-writing` | Writes or revises technical documents so readers can act on them without guessing. |

Plans and other writing stay in the conversation unless you ask for a file.
Ordinary changes create no extra files. Your instructions and your
repository's guidance override Workflow's default formats. Workflow installs
no hooks.

To update Workflow and the other plugins:

```sh
# Claude Code
claude plugin update workflow@filip-stack
claude plugin update field-guide@filip-stack
claude plugin update guardrails@filip-stack

# Codex, then restart it
codex plugin marketplace upgrade filip-stack
```

## Standalone skills

Standalone skills work on their own. Install only the ones you want, with the
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
| `sol-loop` | Has OpenAI's Sol model review a change in rounds and fixes the findings that are in scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
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

To update a skill, run the same `add` command again. Standalone skills have no
version and install from `main`. Avoid `npx skills update`: it reinstalls into
every agent it detects, not only the ones you chose.

The skills CLI keeps each skill in `~/.agents/skills/<name>` for Codex and
links `~/.claude/skills/<name>` to it for Claude. Workflow and Field Guide
skills install only with their plugins.

When you ask `checkpoint`, `grill-me`, or `walkthrough` to save notes without
naming a place, they use these folders. A grill log can also go beside the
document it questions. Each checkpoint is a new snapshot.

```text
~/.engineering-workflow/<project-or-subject>/
├── checkpoints/
├── grills/
└── walkthroughs/
```

## Field Guide

Field Guide is a separate, optional plugin. It remembers durable preferences,
corrections, and recurring lessons in `~/.field-guide`, so you do not repeat
them each session. At session start it adds the stored guidance for the
current repository. On your first prompt it adds up to three more records that
match.

```sh
claude plugin install field-guide@filip-stack   # Claude Code
codex plugin add field-guide@filip-stack        # Codex
```

Installing it opts into its `SessionStart` and `UserPromptSubmit` lifecycle
hooks. Leave it uninstalled to keep that context out of your sessions.
Workflow does not invoke or depend on Field Guide. Your current instructions,
the live code, and repository contracts always outrank what it remembers.

You can also turn on local analytics, which record metadata only, in a local
JSONL file.

## Guardrails

Guardrails is a separate, optional plugin. Its `PreToolUse` hook checks each
shell command your agent runs, including commands inside `bash -c` and
`zsh -i -c` wrappers.

```sh
claude plugin install guardrails@filip-stack   # Claude Code
codex plugin add guardrails@filip-stack        # Codex
```

| Rule | Commands | Decision |
| --- | --- | --- |
| No AI attribution | `git commit`, `gh pr create`, `gh pr edit`, `gh pr comment`, `gh issue create`, `gh issue edit`, `gh issue comment`, and `gh api` writes to pull requests or issues | Deny when a whole line of the message is a `Co-Authored-By` naming an AI or a "Generated with" footer. Lines inside fenced code blocks are examples and pass. |
| 1Password needs approval | `op` in command position | Ask |

If the hook hits an internal error or Node.js is missing, it steps aside and
your normal permission prompts apply. Codex skips plugin hooks until you
review and trust them.

Codex hooks cannot ask yet, so on Codex the 1Password prompt comes from
`~/.codex/rules/filip-stack.rules`, which host config installs. It matches
only a plain `op …` command; the hook denies other forms and tells the agent
to run the plain one.

## Host config

Host config is optional. It gives every machine the same global agent
guidance, agent profiles, output styles, and design system. The `filip-stack`
CLI applies it from a checkout of this repository.

### Set up a machine

1. Clone the repository and keep the checkout on `main`. `filip-stack update`
   pulls it.

   ```sh
   git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack
   ```

2. Install the CLI with Homebrew and apply host config:

   ```sh
   brew install filipgutica/tap/filip-stack
   filip-stack apply
   ```

The CLI uses `~/code/filip-stack` by default. For another location, run
`filip-stack --repo <dir> <command>`. Without Homebrew, run
`node cli/filip-stack.mjs --repo . <command>` from the checkout.

If an old `~/.local/bin/filip-stack` symlink shadows Homebrew, remove it.
`command -v filip-stack` shows which command runs.

### What apply installs

`host-config/` holds the setup that every machine shares:

- the global guidance, written into a marked block in `~/.claude/CLAUDE.md`
  and `~/.codex/AGENTS.md`
- Claude agent templates (`critic`, `explorer`, `planner`, `reviewer`,
  `worker-high`) and output styles
- Codex agent profiles and `~/.codex/rules/filip-stack.rules`: the 1Password
  prompt that Guardrails relies on, and the usage reader's sandbox exception
- `~/.agents/roles.md` and `~/.agents/CODING_STANDARDS.md`
- the model tiers in `host-config/models.json`, which fill in every model name
  in the guidance and agent profiles
- `~/.agents/scripts/model-usage.mjs`, described below
- `~/design-system`, from the pinned
  [`@filipgutica/design-system`](https://github.com/filipgutica/design-system)
  package in `host-config/design-system.json`

Machine-local text outside the marked block stays, and it wins where it
conflicts with the shared guidance. Apply removes files that the repository
no longer has.

The design system is the default for UX and visual work, unless you ask for
another or the repository has its own. See its
[component specs](https://github.com/filipgutica/design-system/blob/main/language/components.md),
[component catalogue](https://filipgutica.github.io/design-system/components.html),
and [data visualizations](https://github.com/filipgutica/design-system/blob/main/language/visualizations.md).
Apply downloads the pinned tarball once, checks its integrity, and caches it
at `~/.cache/filip-stack/design-system/<version>.tgz`
(`$XDG_CACHE_HOME/filip-stack/…` when set). If the version is neither cached
nor downloadable, apply stops before it writes anything. `status` never
downloads; it reports the pin change, such as `design-system 1.0.0 → 1.1.0`.

Threads run `model-usage.mjs` before they delegate, so work moves to the other
provider when one is short of usage. It needs the
[CodexBar](https://codexbar.app) CLI (`brew install --cask codexbar` on macOS,
`brew install steipete/tap/codexbar` on Linux), and uses
[claude-swap](https://github.com/realiti4/claude-swap) when it manages the
active Claude account. Without CodexBar, threads use the role tables as
written. The script needs network and Keychain access, so it runs outside the
sandbox. Host config allows it on Codex. On Claude Code, add this to
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

Host config has no version. It ships from `main`, so run `filip-stack update`
to pick up changes. The CLI launcher has its own version: check it with
`filip-stack --version`, and upgrade it with `brew update` and
`brew upgrade filipgutica/tap/filip-stack`.

When managed text was changed locally, apply prints the diff and stops. Move
the change into `host-config/` and commit it, or rerun with `--force`. Force
saves the local file as `<file>.bak` and overwrites it. A guidance file
without a marked block counts as changed; after a forced apply, restore your
machine-local text below the block from the backup.

### Sync this machine or the fleet

`filip-stack sync` installs missing baseline skills and plugins and refreshes
existing ones. It needs a clean checkout that tracks published `main`. It
keeps machine-local guidance, plugin enabled states and scopes, explicit pins,
and skill host assignments. A local edit, unmerged applied guidance, or a
custom agent home blocks only its own component. The command then exits
nonzero and saves a report at `~/.local/state/filip-stack/last-sync.json`
(under `$XDG_STATE_HOME` when set).

To sync every machine, install `fleet-sync` and ask your agent to sync the
fleet. The policy lives at `~/.config/filip-stack/fleet.json` (under
`XDG_CONFIG_HOME` when set):

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
or `--config <file>` for another policy; the fleet workflow passes both. T3
keeps credentials and access grants. See
[Fleet Sync](https://filipgutica.github.io/filip-stack/skills/fleet-sync/).

### Share Field Guide preferences

Keep shared preferences in `~/.config/filip-stack/field-guide.json` and sync
that file with a dotfile manager.

- `apply` imports the file when it exists. If it is missing, apply prints
  where to put it and continues.
- `field-guide-sync` imports the file if present, then exports this machine's
  shared guidance to it.
- `update` runs `field-guide-sync` after apply when the file exists, so
  guidance saved on this machine reaches the file.

[CONTRIBUTING.md](CONTRIBUTING.md#share-field-guide-preferences) covers other
locations for the file and a chezmoi setup.

## Contributing

To change Filip Stack, read [CONTRIBUTING.md](CONTRIBUTING.md) for the checks,
skill budgets, repository layout, releases, and evaluation.
