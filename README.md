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
| [Host config](#host-config) | Global guidance, agents, styles, and design language | `scripts/host-config.mjs` from a checkout |

## Set up a machine

1. Clone the repository. Host config applies from this checkout, so keep it on
   `main`.

   ```sh
   git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack
   ```

2. Install the plugins in [Claude](#install-with-claude) or
   [Codex](#install-with-codex).
3. Install the [standalone skills](#standalone-skills) you use.
4. Put the host config command on your `PATH` and apply it:

   ```sh
   mkdir -p ~/.local/bin
   ln -s ~/code/filip-stack/scripts/host-config.mjs ~/.local/bin/filip-stack
   export PATH="$HOME/.local/bin:$PATH"
   filip-stack apply
   ```

   If `~/.local/bin` is not already on your `PATH`, add the `export` line to
   your shell profile, such as `~/.zshrc`.

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
| `engineering` | Makes an authorized code change, fix, or refactor and proves it with tests and checks. |
| `planning` | Turns a problem into a direction, specification, implementation plan, or set of tickets. |
| `test-audit` | Checks whether your tests protect real behavior, and finds the ones that only add maintenance cost. |
| `review` | Reviews one exact change or document and reports only the findings it can back with evidence. |
| `simplify` | Makes code you choose simpler without changing what it does. |
| `technical-writing` | Writes or revises documentation, reports, and PR descriptions so readers can act on them. |
| `grill-me` | Stress-tests an idea, design, or plan by questioning you until its decisions hold up. |
| `walkthrough` | Explains a change to you one part at a time, waiting for your answer before it moves on. |
| `checkpoint` | Records where the work stands, with evidence, so it can be paused or handed off. |

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

Independent skills live in `skills/<name>/` and install one at a time with the
[skills CLI](https://github.com/vercel-labs/skills):

| Skill | Use |
| --- | --- |
| `agent-ready-environments` | Audits or sets up a repository and its agent guidance so coding agents can check their own work. |
| `babysit-pr` | Watches a pull request through CI and review bots, and fixes the real problems they find. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `cli-tool-template` | Creates or aligns Filip's personal CLI tools so each follows the same repository, release, and Homebrew conventions. |
| `council` | Asks three AI models for independent advice on a question, plan, or piece of work, and weighs their answers. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `full-send` | Takes a change through review and CI to a merged PR, or to a PASS or FAIL verdict, while you are away. Needs `sol-loop` and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `full-stop` | Does the `full-send` work but leaves the merge to you. Needs `full-send`, `sol-loop`, and `babysit-pr`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `hill-climb` | Polish a change that already works, keeping only the small edits that blind judges prefer. Needs `council`. |
| `jira-work-links` | Creates or checks Jira issue links, such as blockers and Epics, and the PRs and commits behind each issue. |
| `merge-council` | Has three AI reviewers review a pull request and return one merge verdict. |
| `pr-review-churn` | Finds the review objections that keep coming back on your GitHub PRs and proposes guidance to prevent them. |
| `sol-loop` | Has GPT Sol review your change in rounds until Sol and your agent agree it is correct. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `ux-laws` | Designs or reviews interfaces and user flows with established UX laws. |
| `vue-best-practices` | Guides your agent's Vue 3 work on components, composables, and their tests. |

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

The CLI does not offer Workflow, Field Guide, or this repository's development
skills. They need their plugin or this checkout, so install them that way.

## Host config

`host-config/` holds the general agent setup shared by every machine:

- the global guidance for `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`
- Claude agent templates (`critic`, `explorer`, `reviewer`, `worker-high`) and
  output styles
- Codex agent profiles and the `~/.codex/rules/filip-stack.rules` prompts that
  Guardrails relies on
- `~/.agents/roles.md` and `~/.agents/CODING_STANDARDS.md`
- the `~/design-language` files the guidance refers to
  - [Data visualizations](host-config/design-language/visualizations.md) covers source-consistent snapshots, filterable count reports, and self-contained HTML exports using the shared design tokens.

It contains no employer-specific guidance; keep that local to the machine that
needs it.

The command runs from a checkout, because `update` pulls it. A symlink on your
`PATH` is enough; see
[Set up a machine](#set-up-a-machine). Without one, run
`node scripts/host-config.mjs <command>` from the checkout.

```sh
filip-stack status            # applied commit, then each target's state
filip-stack apply [--force]   # write targets and import shared guidance
filip-stack update [--force]  # on main only: git pull --ff-only, apply, then sync
filip-stack field-guide-sync  # import, then export local shared guidance
```

Host config has no version. It ships from `main`, so run `filip-stack update`
to pick up changes.

`apply` copies `host-config/claude`, `codex`, `agents`, and `design-language` into
`~/.claude`, `~/.codex`, `~/.agents`, and `~/design-language`, and replaces
`{{HOME}}` with the home directory.
It writes the guidance assembled from `host-config/guidance/` into a marked block
in `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. Text outside the block, such
as the ctx7 block or machine-local notes, stays as it is, and the shared
guidance tells agents that it overrides the block where they conflict. The manifest in
`~/.agents/.filip-stack-host-config.json` records the applied commit and a hash
of each target. Apply removes a file it applied earlier once the repository no
longer has it.

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
