# Filip Stack

Filip Stack is Filip's collection of skills and agent setup for Claude and
Codex: an engineering workflow, standalone skills, optional local memory, and
one command that sets up the agent guidance on each machine. Install it to give
your agents the same skills and the same guidance on every machine you use.

The plugins install from this repository's plugin marketplace, a catalog that
the `claude plugin` and `codex plugin` commands read. The
[Filip Stack site](https://filipgutica.github.io/filip-stack/) gives an
overview and lists every skill.

| Part | What it is | How it installs |
| --- | --- | --- |
| [Workflow](#workflow) | Nine skills for the engineering loop | Plugin, from this marketplace |
| [Field Guide](#field-guide) | Optional local memory of preferences and lessons | Plugin, from this marketplace |
| [Guardrails](#guardrails) | Optional hook that enforces attribution and 1Password rules | Plugin, from this marketplace |
| [Standalone skills](#standalone-skills) | Independent skills | One at a time with the skills CLI |
| [Host config](#host-config) | Global guidance, agents, styles, and design language | Homebrew CLI with a source checkout |

## Set up a machine

1. Clone the repository. Host config runs from this checkout, and
   `filip-stack update` pulls it, so keep it on `main`.

   ```sh
   git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack
   ```

2. Install the plugins in [Claude](#install-with-claude) or
   [Codex](#install-with-codex).
3. Install the [standalone skills](#standalone-skills) you use.
4. Install the CLI with Homebrew and apply host config:

   ```sh
   brew install filipgutica/tap/filip-stack
   filip-stack apply
   ```

   The CLI uses `~/code/filip-stack` by default. For another location, pass
   `filip-stack --repo <dir> <command>`. If an old
   `~/.local/bin/filip-stack` symlink shadows Homebrew, remove that symlink.
   Check the active command with `command -v filip-stack`.

   Upgrade the CLI with `brew update` and
   `brew upgrade filipgutica/tap/filip-stack`. Check its version with
   `filip-stack --version`.

## Install with Claude

```sh
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack
# Optional local learning:
claude plugin install field-guide@filip-stack
# Optional rule enforcement:
claude plugin install guardrails@filip-stack
```

Update it with:

```sh
claude plugin update workflow@filip-stack
claude plugin update field-guide@filip-stack
claude plugin update guardrails@filip-stack
```

## Install with Codex

```sh
codex plugin marketplace add filipgutica/filip-stack
codex plugin add workflow@filip-stack
# Optional local learning:
codex plugin add field-guide@filip-stack
# Optional rule enforcement:
codex plugin add guardrails@filip-stack
```

Update the marketplace with:

```sh
codex plugin marketplace upgrade filip-stack
```

Restart Codex after installing or upgrading so a new session loads the current
skill inventory.

## Workflow

Workflow gives your agent one skill for each stage of the engineering loop.
Each skill loads only the guidance its task needs.

| Skill | Use |
| --- | --- |
| `engineering` | Makes an authorized code change and verifies the requested behavior with tests and checks. |
| `planning` | Develops a direction, specification, implementation plan, or tickets from repository evidence. |
| `test-audit` | Audits test value and identifies duplicate coverage, implementation-coupled tests, and test-only production code. |
| `review` | Reviews one exact change or document and reports only the findings it can back with evidence. |
| `simplify` | Simplifies selected code while preserving its observable behavior. |
| `technical-writing` | Writes or revises technical documents so readers can act on them without guessing. |
| `grill-me` | Questions a proposal one decision at a time to expose assumptions and settle consequential choices. |
| `walkthrough` | Explains a change in parts and waits for your acceptance of each part. |
| `checkpoint` | Captures current work, evidence, and next actions for a pause or handoff. |

The host may pick `engineering`, `planning`, `review`, `test-audit`, and
`technical-writing` when a request matches. `grill-me`, `walkthrough`,
`checkpoint`, and `simplify` run only when you call them by name, such as
`/workflow:simplify` in Claude or `$workflow:simplify` in Codex.

Plans, specifications, and other writing stay in the conversation unless you
ask for a saved document, and a saved document goes where you say. Ordinary
changes create no task ledgers or companion files. Your instructions and your
repository's guidance override Workflow's default formats for specifications,
plans, tickets, and PR descriptions.

When you ask to save a checkpoint, grill log, or walkthrough log and name no
place, Workflow defaults to plain notes folders that need no setup. A grill log
can also go beside the document it questions.

```text
~/.engineering-workflow/<project-or-subject>/
├── checkpoints/
├── grills/
└── walkthroughs/
```

Each checkpoint is a new snapshot, and earlier ones stay as they are. Workflow
installs no hooks and never updates these notes on its own.

## Field Guide

Field Guide is a separate, optional plugin. It keeps durable preferences,
corrections, and recurring lessons under `~/.field-guide`. At session start, it
adds the stored guidance for the current repository and a list of other stored
subjects. On your first prompt, it adds up to three more records that match it.
Installing it opts into its `SessionStart` and `UserPromptSubmit` lifecycle
guidance; leaving it uninstalled keeps that context out of normal Workflow use.

Workflow does not invoke or depend on Field Guide. Current instructions, live
code, and repository contracts continue to outrank stored guidance.

After you initialize the guide, you can turn on local effectiveness analytics.
They record metadata in a local JSONL file and report activity, agent-reported
impact, and reviewed outcomes separately.

## Guardrails

Guardrails is a separate, optional plugin. Its `PreToolUse` hook checks each
shell command your agent runs, including commands inside `bash -c` and
`zsh -i -c` wrappers:

| Rule | Commands | Decision |
| --- | --- | --- |
| No AI attribution | `git commit`, `gh pr create`, `gh pr edit`, `gh pr comment`, `gh issue create`, `gh issue edit`, `gh issue comment`, and `gh api` writes to pull requests or issues | Deny when a whole line of the write's message is a `Co-Authored-By` naming an AI or a "Generated with" footer. Lines inside fenced code blocks are examples and pass. |
| 1Password needs approval | `op` in command position | Ask |

If the hook hits an internal error or Node.js is missing, it steps aside and
your normal permission prompts apply. Codex skips plugin hooks until you review
and trust them.

Codex hooks cannot ask yet, so on Codex the 1Password prompt comes from
`~/.codex/rules/filip-stack.rules`, which host config installs. That rule
matches only a plain `op …` command. On Codex the hook denies any other form,
such as one inside a wrapper or a chain, and tells the agent to run the plain
form.

## Standalone skills

Independent skills install one at a time with the
[skills CLI](https://github.com/vercel-labs/skills):

| Skill | Use |
| --- | --- |
| `agent-ready-environments` | Audits or sets up repositories and agent guidance so agents can verify their work. |
| `babysit-pr` | Monitors a PR through CI and automated review, fixing verified problems within its scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `cli-tool-template` | Creates or aligns Filip's CLI tools with shared repository, release, site, and Homebrew conventions. |
| `council` | Gathers independent model opinions and synthesizes advice on a question or artifact. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `fleet-sync` | Syncs a shared filip-stack baseline across linked T3 environments with per-machine exceptions. |
| `full-send` | Finishes a change or PR through review and CI, then merges or returns a verdict. Needs `sol-loop` and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `full-stop` | Finishes a change or PR through review and CI and leaves merging to you. Needs `full-send`, `sol-loop`, and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `hill-climb` | Improves a working change or named goal in bounded rounds judged by blind comparisons, a score, or both. Needs `council`. |
| `interface-design` | Designs, builds, reviews, or checks interfaces for task completion and accessibility. Adapted from [frontend-design](https://github.com/anthropics/skills). |
| `jira-work-links` | Creates or checks Jira relationships and verifies the PRs and commits behind an issue. |
| `merge-council` | Runs a council on a PR, fixes agreed findings, and returns a verdict tied to the reviewed commits. Needs `council`. |
| `pr-review-churn` | Analyzes recurring human review objections on GitHub PRs and proposes guidance changes. |
| `sol-loop` | Checks a change through GPT Sol review rounds and resolves findings within scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `vue-best-practices` | Guides Vue component, composable, and test work with explicit state ownership and component contracts. |

List the skills, install one by name, or install a skill together with the
skills it needs:

```sh
npx skills add filipgutica/filip-stack --list
npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send full-stop sol-loop babysit-pr -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s hill-climb council -y
```

The CLI keeps the canonical copy in `~/.agents/skills/<name>`, which Codex
reads, and links `~/.claude/skills/<name>` to it for Claude. Standalone skills
have no version and install from `main`, so to update a skill, run the same
`add` command again. Avoid `npx skills update`: it reinstalls into every agent
it detects, not only the ones you chose.

The CLI does not offer Workflow or Field Guide skills. Install them with their
plugins.

## Host config

`host-config/` holds the general agent setup shared by every machine:

- the global guidance for `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`
- Claude agent templates (`critic`, `explorer`, `reviewer`, `worker-high`) and
  output styles
- Codex agent profiles and the `~/.codex/rules/filip-stack.rules` prompts that
  Guardrails relies on
- `~/.agents/roles.md` and `~/.agents/CODING_STANDARDS.md`
- the `~/design-language` files the guidance refers to, installed from the
  pinned [`@filipgutica/design-system`](https://github.com/filipgutica/design-system)
  package in `host-config/design-system.json`; filip-stack uses it as the default
  design system for UX and visual work, unless you ask for another or the
  repository has its own
  - [Component specs](https://github.com/filipgutica/design-system/blob/main/language/components.md) and the [component catalogue](https://filipgutica.github.io/design-system/components.html) cover each component's states, marked core or identity, so another project can reuse the core.
  - [Data visualizations](https://github.com/filipgutica/design-system/blob/main/language/visualizations.md) covers source-consistent snapshots, filterable count reports, and self-contained HTML exports using the shared design tokens.

It contains no employer-specific guidance; keep that local to the machine that
needs it.

Without the Homebrew CLI from [Set up a machine](#set-up-a-machine), run
`node scripts/host-config.mjs <command>` from the checkout.

```sh
filip-stack status            # applied commit, then each target's state
filip-stack apply [--force]   # write targets and import shared guidance
filip-stack update [--force]  # on main only: git pull --ff-only, apply, then sync
filip-stack sync              # apply the fleet baseline and refresh this machine
filip-stack sync --dry-run --json # preview without fetching or changing installations
filip-stack field-guide-sync  # import, then export local shared guidance
```

Host config has no version. It ships from `main`, so run `filip-stack update`
to pick up changes. The CLI launcher has its own version and Homebrew release;
`filip-stack update` updates the checkout, and `brew upgrade` updates the launcher.

`filip-stack sync` installs missing baseline skills and plugins and refreshes
existing filip-stack installations. It requires a clean checkout tracking
published `main`. It preserves machine-local guidance, plugin enabled states
and scopes, explicit pins, and existing skill host assignments. Local edits
or unmerged applied guidance block the affected component; independent
components continue. The command exits nonzero when a component fails and
saves a JSON report under `~/.local/state/filip-stack/last-sync.json`
(`$XDG_STATE_HOME/filip-stack/last-sync.json` when set).
Guidance currently targets `~/.claude` and `~/.codex`; custom agent homes
block that component before any guidance files are written.

For the whole fleet, install `fleet-sync` and invoke `$fleet-sync`, or ask your
agent to sync the fleet. Its policy lives at `~/.config/filip-stack/fleet.json`
(under `XDG_CONFIG_HOME` when set):

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

List the standalone skills and plugins you want in the shared baseline.
Each machine receives that selection plus its existing extras. `agents`
defaults to `codex` and `claude-code` for skill/plugin installation;
per-machine overrides and exclusions preserve exceptions without uninstalling
anything. Shared host guidance keeps its normal managed targets. Missing
required clients or conflicting installation ownership remain blocked.
Without a baseline, the command refreshes existing selections.

Pass `--environment-id <id>` when the roster label differs from the hostname,
or `--config <file>` to select another policy. The fleet workflow supplies both.
It can use a separate clean source clone while a development checkout is busy.
T3 retains credentials and access grants. Unlinked and offline machines remain
visible in the result. See
[Fleet Sync](https://filipgutica.github.io/filip-stack/skills/fleet-sync/).

`apply` copies the host config files into `~/.claude`, `~/.codex`, `~/.agents`,
and `~/design-language`. It writes the shared guidance into a marked block in
`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. Text outside the block, such as
the ctx7 block or machine-local notes, stays as it is, and the shared guidance
tells agents that it overrides the block where they conflict. Apply removes a
file it applied earlier once the repository no longer has it.

`apply` downloads the pinned design-system tarball from the npm registry, checks
it against the pin's integrity, and caches it at
`~/.cache/filip-stack/design-system/<version>.tgz`
(`$XDG_CACHE_HOME/filip-stack/…` when set). After that, it works offline. When
the pinned version is neither cached nor downloadable, apply stops before
writing anything. `status` never downloads; it reports an uncached version and
the pin change, such as `design-system 1.0.0 → 1.1.0`.

When managed text was changed locally, apply prints the diff and stops. Move the
change into `host-config/` and commit it, or rerun with `--force` to save the
local file as `<file>.bak` and overwrite it. A guidance file without a block
counts as changed. With `--force`, apply replaces it with the block, and you
restore machine-local text below the block from the backup.

To share Field Guide preferences between machines, keep them in
`~/.config/filip-stack/field-guide.json` and sync that file with a dotfile
manager. `apply` imports the file when it exists; if it is missing, apply prints
where to put it and continues. `field-guide-sync` imports the file if present,
then exports this machine's shared guidance to it. `update` runs
`field-guide-sync` after apply when the file exists, so guidance saved on this
machine reaches the file.
[CONTRIBUTING.md](CONTRIBUTING.md#share-field-guide-preferences) covers other
locations for the file and a chezmoi setup.

## Contributing

To change Filip Stack, read [CONTRIBUTING.md](CONTRIBUTING.md) for the checks,
skill budgets, repository layout, releases, and evaluation.
