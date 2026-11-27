# Filip Stack

Filip Stack is a set of skills, plugins, and machine setup for developers using
Claude Code and Codex, with plugin support for Antigravity. A **skill** is a
folder of instructions an agent loads when a task matches it, such as reviewing
a branch or writing a plan. A **plugin** packages skills or hooks so a host can
install and update them together. The
[Filip Stack site](https://filipgutica.github.io/filip-stack/) documents each
skill.

## Try Workflow

Workflow is a plugin with five skills for everyday engineering: planning, code
changes, review, test audits, and technical writing. Install it from this
repository's plugin marketplace, a catalog that `claude plugin` and
`codex plugin` read:

```sh
# Claude Code
claude plugin marketplace add filipgutica/filip-stack
claude plugin install workflow@filip-stack

# Codex, then restart Codex so a new session loads the plugin
codex plugin marketplace add filipgutica/filip-stack
codex plugin add workflow@filip-stack
```

Open a repository with changes on a branch and ask:

> Review the changes on this branch against main.

The agent picks `review` on its own. It reads every changed file and reports
findings ranked by impact with file and line numbers, or says it found nothing
backed by evidence. It changes no files.

## What else is here

Workflow is enough to start. Every other part is optional.

| Part | What it is | How it installs |
| --- | --- | --- |
| [Workflow](#workflow) | Five skills for engineering tasks | Plugin |
| [Standalone skills](#standalone-skills) | Independent skills you install individually | Skills CLI |
| [Field Guide](#field-guide) | Memory of your preferences, corrections, and lessons | Plugin |
| [Guardrails](#guardrails) | Shell hook blocking AI attribution and prompting before 1Password commands | Plugin |
| [devchat](#devchat) | Client for devchat, a self-hosted board for todos and agent work; this version keeps todos on the machine | Plugin |
| [Host config](#host-config) | Shared global guidance and agent profiles across machines | Homebrew CLI and a checkout |
| [Design system](https://github.com/filipgutica/design-system) | Design language agents follow for visual work | Plugin, from its own marketplace |

## Workflow

Describe your task in plain language. The host selects the matching skill and
loads the references the task needs.

| Skill | Use |
| --- | --- |
| `engineering` | Makes the code change you ask for and proves it with tests and checks. |
| `planning` | Writes a direction, specification, PRD, ADR, implementation plan, or tickets from what the repository shows. |
| `test-audit` | Gates new tests, and audits or cleans up tests that duplicate coverage, break on harmless refactors, or need test-only production code. |
| `review` | Reviews one exact change or document and reports only the findings it can back with evidence. |
| `technical-writing` | Writes or revises technical documents so readers can act on them without guessing. |

Plans and other writing stay in the conversation, and ordinary changes create
no extra files unless you ask for one. Your instructions and your repository's
guidance override Workflow's defaults. Workflow installs no hooks.

Update installed plugins:

```sh
# Claude Code
claude plugin update workflow@filip-stack
claude plugin update field-guide@filip-stack
claude plugin update guardrails@filip-stack

# Codex, then restart Codex
codex plugin marketplace upgrade filip-stack
```

### Antigravity

Antigravity has no third-party marketplaces, so install the plugins directly
from this repository. One command installs Workflow, Field Guide, and
Guardrails; run it again to update them:

```sh
agy plugin install https://github.com/filipgutica/filip-stack
```

Remove a plugin with `agy plugin uninstall <name>`. Antigravity reads each
plugin's `.antigravity-plugin/plugin.json`: Guardrails runs as a `run_command`
hook, and Field Guide installs its skill only because its lifecycle hooks need
Claude Code or Codex.

## Standalone skills

Install only the standalone skills you need with the
[skills CLI](https://github.com/vercel-labs/skills).

| Skill | Use |
| --- | --- |
| `agent-ready-environments` | Audits or sets up a repository or its agent guidance so agents can check their own work. |
| `babysit-pr` | Watches a PR through CI and automated review and fixes verified problems within its scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `catch-up` | Recaps a thread's goal, progress, and next step in four lines when you return to it. |
| `checkpoint` | Records current work, evidence, and next actions for a pause or handoff. |
| `council` | Asks several models separately to answer a question, review a plan, or gate a PR. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `fleet-sync` | Keeps the same filip-stack skills, plugins, and guidance on every machine linked in T3 Code, with per-machine exceptions. |
| `full-send` | Takes a change or PR through review and CI, then merges it or returns a verdict. Needs `sol-loop`, `babysit-pr`, and `council`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `full-stop` | Takes a change or PR through review and CI and leaves the merge to you. Needs `full-send`, `sol-loop`, `babysit-pr`, and `council`. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `grill-me` | Questions a proposal one decision at a time to expose assumptions and settle consequential choices. Adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills). |
| `hill-climb` | Improves a working change, or climbs toward a named goal, in small rounds, and keeps an edit only when it wins under the chosen rule: blind judges, a score, or both. Needs `council`. |
| `home-repo` | Sets up a home repo where agent sessions start for work that spans several repos. |
| `interface-design` | Designs, builds, reviews, or checks interfaces for task completion and accessibility. Adapted from [frontend-design](https://github.com/anthropics/skills). |
| `jira-work-links` | Creates or checks Jira relationships and verifies the PRs and commits behind an issue. |
| `pr-review-churn` | Finds review objections that recur across your GitHub PRs and proposes guidance to prevent them. |
| `simplify-pass` | Simplifies selected code after three independent reviews, preserving its observable behavior. |
| `sol-loop` | Has Sol (currently OpenAI's `gpt-6.2-sol`) review a change in rounds and fixes the findings that are in scope. Adapted from [tstack](https://github.com/t3dotgg/tstack). |
| `todos` | Keeps the items you defer for later in one list that any agent on any machine can read and clear. |
| `vue-best-practices` | Guides Vue component, composable, and test work with explicit state ownership and component contracts. |
| `walkthrough` | Explains a change in parts and waits for your acceptance of each part. |

List skills, install one by name, or install a skill with the skills it needs:

```sh
npx skills add filipgutica/filip-stack --list
npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send full-stop sol-loop babysit-pr council -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s hill-climb council -y
```

- **Updates:** Re-run `npx skills add` for each skill. Standalone skills ship
  from `main` with no version. Avoid `npx skills update`, which installs into
  every detected agent.
- **Locations:** The skills CLI installs each skill into
  `~/.agents/skills/<name>` for Codex and symlinks `~/.claude/skills/<name>` to
  it for Claude. Workflow and Field Guide skills install only with their
  plugins.
- **Saved notes:** Unless you name a path, `checkpoint`, `grill-me`, and
  `walkthrough` save notes under `~/.engineering-workflow/<project-or-subject>/`
  in `checkpoints/`, `grills/`, and `walkthroughs/`. A grill log can also live
  beside the document it questions.

## Field Guide

Field Guide is a separate, optional plugin. It stores durable preferences,
corrections, and recurring lessons in `~/.field-guide`, so you do not repeat
them each session. The
[Field Guide page](https://filipgutica.github.io/filip-stack/field-guide/)
explains what it saves, how confirmations work, and how maintenance runs.

Add the marketplace first, as [Try Workflow](#try-workflow) shows:

```sh
claude plugin install field-guide@filip-stack   # Claude Code
codex plugin add field-guide@filip-stack        # Codex, then restart Codex
```

- Installing it opts into its `SessionStart`, `UserPromptSubmit`, and
  `PostToolUse` lifecycle hooks. `PostToolUse` injects guidance you tagged for a
  merge or new PR after a successful `gh pr merge` or `gh pr create` in the main
  thread.
- Workflow does not invoke or depend on Field Guide. Your current instructions,
  live code, and repository contracts always outrank stored guidance.
- To confirm a stored record yourself, send `confirm fg:<id>` as the entire
  prompt in a main thread; to approve a proposed merge of confirmed records,
  send `confirm fg:proposal:<id>`.
- Merges and archives applied by Field Guide or its nightly maintenance script
  are journaled and reversible for 90 days. While confirmation history is
  intact, maintenance never archives or merges guidance you ever confirmed. See
  [dreaming.md](plugins/field-guide/skills/field-guide/references/dreaming.md) for
  the full maintenance rules.

## Guardrails

Guardrails is a separate, optional plugin. Its `PreToolUse` hook checks every
shell command your agent runs, including inside `bash -c` and `zsh -i -c`
wrappers.

Add the marketplace first, as [Try Workflow](#try-workflow) shows:

```sh
claude plugin install guardrails@filip-stack   # Claude Code
codex plugin add guardrails@filip-stack        # Codex, then restart Codex
```

| Rule | Commands | Decision |
| --- | --- | --- |
| No AI attribution | `git commit`, `gh pr` and `gh issue` `create`, `edit`, and `comment`, and `gh api` writes to pull requests or issues | Deny when a whole line of the message is a `Co-Authored-By` naming an AI or a "Generated with" footer. Lines inside fenced code blocks pass. |
| 1Password needs approval | `op` in command position | Ask |

- **Errors:** If the hook hits an internal error or Node.js is missing, it steps
  aside and your normal permission prompts apply.
- **Codex:** Review and trust plugin hooks to enable them. Because Codex hooks
  cannot ask yet, the 1Password prompt comes from
  `~/.codex/rules/filip-stack.rules` (installed by Host config), which matches
  only a plain `op ...` command; the hook denies wrapped or chained `op` calls
  and asks the agent to run the plain form.
- **Antigravity:** Prompts on every 1Password call, even one approved earlier.

## devchat

devchat is a separate, optional plugin and the client for
[devchat](https://github.com/filipgutica/devchat), a self-hosted board for todos,
work items, and agent messages. This version has no network code: every todo
stays on the machine, and board writes arrive with `devchat setup` in a later
release.

```sh
claude plugin install devchat@filip-stack   # Claude Code
codex plugin add devchat@filip-stack        # Codex, then restart Codex
```

- **Session hook:** At `SessionStart`, the hook records the repository the
  session started in, so the write router can tell where a write came from. It
  prints nothing, opens no network connection, and steps aside on any error.
- **Router:** A write can reach the board only from a recorded Claude Code or
  Codex session, in mode `readwrite`, when the starting repository and the
  working directory are both GitHub repositories whose owner is on your
  allowlist. Everything else stays on the machine.
- **Config:** `~/.config/devchat/config.json` (or under `$XDG_CONFIG_HOME`)
  holds `mode`, `githubLogin`, and `allowlist`. Without it the mode is `off`.
  State lives in `~/.local/state/devchat` (or under `$XDG_STATE_HOME`).
- **Antigravity:** The hook does not run, so every write stays on the machine.

The skill's [SKILL.md](plugins/devchat/skills/devchat/SKILL.md) lists the
commands agents call.

## Host config

Host config gives every machine the same global guidance, agent profiles, and
output styles. The `filip-stack` CLI applies it from a local checkout of this
repository.

### Set up a machine

Clone the repository onto `main`, install the CLI, and apply:

```sh
git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack
brew install filipgutica/tap/filip-stack
filip-stack apply
```

See the [CLI page](https://filipgutica.github.io/filip-stack/cli/#install) for
another checkout path, running without Homebrew, or resolving a shadowing
symlink.

### What apply installs

`filip-stack apply` copies `host-config/` into `~/.claude`, `~/.codex`, and
`~/.agents`:

- Global guidance in `~/.agents/AGENTS.md` (for T3 Code, with Claude Code and
  Codex fallbacks), imported by a managed block in `~/.claude/CLAUDE.md` and
  copied into a managed block in `~/.codex/AGENTS.md`.
- Claude agent templates (`critic`, `explorer`, `planner`, `reviewer`,
  `worker-high`) and output styles.
- Codex agent profiles and `~/.codex/rules/filip-stack.rules` (1Password prompt
  and `model-usage.mjs` sandbox exception).
- `~/.agents/roles.md`, `~/.agents/CODING_STANDARDS.md`, and model names
  rendered from `host-config/models.json`.
- Helper scripts `~/.agents/scripts/model-usage.mjs` and
  `~/.agents/scripts/check-secret-exposure.mjs`.

Text outside a managed block stays local and wins on conflict. `apply` removes
previously managed files the repository no longer ships, including unchanged
files from older `~/design-system` and `~/design-language` installs.

**Design system:** For UX and visual work, guidance points to the repository's
design system first, then to the separate
[design-system plugin](https://github.com/filipgutica/design-system). Host
config does not install it; install it manually below or add it to your fleet
baseline. Without it, agents apply no house style and mention once that it is
missing.

**Model usage (`model-usage.mjs`):** Threads run `model-usage.mjs` before
delegating and shift work to the other provider when one runs low. It needs
[CodexBar](https://codexbar.app) (`brew install --cask codexbar` on macOS,
`brew install steipete/tap/codexbar` on Linux) and uses
[claude-swap](https://github.com/realiti4/claude-swap) when active; without
CodexBar, threads follow the role tables as written. Because it needs network
and Keychain access, it runs outside the sandbox (configured automatically on
Codex; on Claude Code, add this to `~/.claude/settings.json` with your home
directory):

```json
{
  "permissions": { "allow": ["Bash(node /Users/you/.agents/scripts/model-usage.mjs)"] },
  "sandbox": { "excludedCommands": ["node /Users/you/.agents/scripts/model-usage.mjs"] }
}
```

**Secret files (`check-secret-exposure.mjs`):** Keep secrets out of shell
environments so agent logs and Codex shell snapshots never capture them. Put
each secret in its own file under `~/.config/secrets/` (mode `700` folder, `600`
files), such as `~/.config/secrets/cliproxy-client-key` for eval runners.
`check-secret-exposure.mjs` fails if your shell exports a stored value or if
permissions are wrong; `--scan` also lists Claude, Codex, and T3 logs containing
a value, printing names only.

### Commands

```sh
filip-stack status                 # applied commit and each target's state
filip-stack apply [--force]        # write targets and import shared Field Guide preferences
filip-stack update [--force]       # on main only: git pull --ff-only, apply, then field-guide-sync if configured
filip-stack sync                   # apply the fleet baseline and refresh this machine
filip-stack sync --dry-run --json  # preview sync without fetching or changing installations
filip-stack field-guide-sync       # import, then export local shared Field Guide guidance
```

Host config has no version; run `filip-stack update` to pull from `main`. If you
edited managed text locally, `apply` prints the diff and stops. See the
[CLI page](https://filipgutica.github.io/filip-stack/cli/) for `--force`
recovery and CLI upgrades.

### Sync this machine or the fleet

`filip-stack sync` installs missing baseline skills and plugins and refreshes
installed ones, including `design-system`. It requires a clean checkout tracking
published `main`, preserves local guidance, pins, and plugin states, and writes
its report to `~/.local/state/filip-stack/last-sync.json` (or under
`$XDG_STATE_HOME`). A blocked source or configuration stops the refresh before
any installation changes; once those pass, one blocked component does not stop
the others, though `sync` exits nonzero. When a machine has skill agents,
the JSON skills component can include `unselected`: published standalone
skills that are not installed, not in the baseline, and not excluded, so a
new skill shows up before you add it to the baseline. Guidance writes to
`~/.agents/AGENTS.md`, `~/.claude`, and `~/.codex`; custom `CODEX_HOME` or
`CLAUDE_CONFIG_DIR` blocks that step.

To sync multiple machines, install `fleet-sync`, define your policy in
`~/.config/filip-stack/fleet.json` (or under `$XDG_CONFIG_HOME`), and ask your
agent to sync the fleet:

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

- `baseline` sets what every machine gets; extras stay installed. Without a
  baseline, `sync` refreshes existing selections.
- `agents` defaults to `codex` and `claude-code`.
- `exclude` keeps per-machine exceptions without uninstalling anything.

To install the optional `design-system` plugin manually (or list `design-system`
under `baseline.plugins`):

```sh
claude plugin marketplace add filipgutica/design-system
claude plugin install design-system@design-system --scope user
codex plugin marketplace add filipgutica/design-system
codex plugin add design-system@design-system
```

Pass `--environment-id <id>` when the roster label differs from the hostname, or
`--config <file>` to apply another policy file. A real run saves that file as
the default policy (backing up a differing copy and leaving a symlinked default
alone); `--dry-run` previews without saving. See
[Fleet Sync](https://filipgutica.github.io/filip-stack/skills/fleet-sync/).

### Share Field Guide preferences

Sync `~/.config/filip-stack/field-guide.json` and
`field-guide-annotations.json` beside it (confirmations and event triggers) with
a dotfile manager. `apply` imports them, `field-guide-sync` imports and exports
them, and `update` runs `field-guide-sync` after `apply` when the file exists.
See the [CLI page](https://filipgutica.github.io/filip-stack/cli/#sync) and
[CONTRIBUTING.md](CONTRIBUTING.md#share-field-guide-preferences).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, skill budgets,
releases, and guidance tests.
