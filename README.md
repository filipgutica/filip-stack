# Filip Stack

Filip Stack is a personal plugin marketplace and skills home for Claude and
Codex. It distributes the `workflow` plugin, the optional `field-guide` and
`guardrails` plugins, standalone skills, and the shared host configuration that sets up each machine.

The [Filip Stack site](https://filipgutica.github.io/filip-stack/) gives an
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

Workflow is intentionally small. Nine skills cover the normal engineering loop
without chaining a large collection of procedures together.

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

`engineering`, `planning`, `review`, `test-audit`, and `technical-writing` may be selected
from a matching request. `grill-me`, `walkthrough`, `checkpoint`, and `simplify` are manual-only.

Invoke a manual skill by name: `$workflow:simplify` in Codex or
`/workflow:simplify` in Claude.

### How it stays small

The plugin uses three levels of progressive disclosure:

1. The host sees only each skill's name and description while choosing a route.
2. The selected `SKILL.md` supplies the operating contract.
3. A short reference file is opened only when the selected mode needs it.

Engineering and Review check routine test value directly. They invoke
`test-audit` for requested audits, substantial coverage changes, or uncertainty
about test value or preservation. Other routes select internal modes without
chaining public Workflow skills:

- `engineering` selects implementation, debugging, refactoring, or review
  correction guidance.
- `planning` selects exploration, specification, plan, or tickets.
- `review` selects read-only review or final verification of an exact range or
  artifact.

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

### Artifacts

Planning and writing stay in the conversation unless the user requests a saved
document. Use the supplied destination. Specifications and plans are optional;
ordinary changes do not create task ledgers or companion artifacts.

Default specification, plan, and ticket formats live in Planning's mode
references; the PR description format lives in Technical-writing's references.
User instructions and repository or project guidance take precedence over them.
Technical-writing owns prose quality; planning owns scope, decisions, and
implementation readiness.

Grill and walkthrough log formats stay beside their skills. For an explicitly
requested saved log or checkpoint without a supplied destination, use plain
notes directories:

```text
~/.engineering-workflow/<project-or-subject>/
├── checkpoints/
├── grills/
└── walkthroughs/
```

These folders need no work-item setup, registry, or task tracking. Checkpoints
are new snapshots; earlier snapshots remain intact. Recheck current evidence
when resuming. Workflow does not install hooks or update these notes
automatically.

## Field Guide

Field Guide is a separate, optional plugin. It keeps durable preferences,
corrections, and recurring lessons under `~/.field-guide` and retrieves only a
bounded relevant set. Installing it opts into its `SessionStart` and `UserPromptSubmit` lifecycle
guidance; leaving it uninstalled keeps that context out of normal Workflow use.
At session start and on the first prompt, it injects the stored guidance that
matches the work.
Local effectiveness analytics can be enabled separately after the guide is
initialized. It records metadata in a local JSONL file and reports activity,
agent-reported impact, and reviewed outcomes separately.

Workflow does not invoke or depend on Field Guide. Current instructions, live
code, and repository contracts continue to outrank stored guidance.

## Guardrails

Guardrails is a separate, optional plugin. Its `PreToolUse` hook checks each
shell command, including commands inside `bash -c` and `zsh -i -c` wrappers:

| Rule | Commands | Decision |
| --- | --- | --- |
| No AI attribution | `git commit`, `gh pr create`, `gh pr edit`, `gh pr comment`, `gh issue create`, `gh issue edit`, `gh issue comment`, and `gh api` writes to pull requests or issues | Deny when a whole line of the write's message is a `Co-Authored-By` naming an AI or a "Generated with" footer. Lines inside fenced code blocks are examples and pass. |
| 1Password needs approval | `op` in command position | Ask |

The hook fails open: an internal error or a missing Node.js runtime leaves the
normal permission flow in charge. Codex skips plugin hooks until you review and
trust them. Codex hooks cannot ask yet, so on Codex the 1Password
prompt comes from `~/.codex/rules/filip-stack.rules`, which host config
installs. That rule matches only a plain `op …` command. On Codex the hook
denies any other form, such as one inside a wrapper or a chain, and tells the
agent to run the plain form.

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

```sh
npx skills add filipgutica/filip-stack --list
npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s full-send full-stop sol-loop babysit-pr -y
npx skills add filipgutica/filip-stack -g -a claude-code codex -s hill-climb council -y
```

The CLI keeps the canonical copy in `~/.agents/skills/<name>`, which Codex
reads, and links `~/.claude/skills/<name>` to it for Claude. To refresh a skill,
run the same `add` command again. Avoid `npx skills update`: it reinstalls into
every agent it detects, not only the ones you chose.

Workflow, Field Guide, and repository development skills set
`metadata.internal: true`, so the CLI does not offer them. They depend on their
plugin or this checkout and must not install on their own.

An adapted skill carries `THIRD_PARTY_NOTICES.md` in its own directory with the
upstream source and the baseline commit. The repository's `upstream-sync` skill
compares it with upstream.

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
`node scripts/host-config.mjs` from the checkout.

```sh
filip-stack status            # applied commit, then each target's state
filip-stack apply [--force]   # write targets and import shared guidance
filip-stack update [--force]  # on main only: git pull --ff-only, apply, then sync
filip-stack field-guide-sync  # import, then export local shared guidance
```

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

Edit guidance in `host-config/guidance/core.md`. The `{{include:<name>}}` lines
pull in `host-config/guidance/<host>/<name>.md` for the parts that differ between
Claude and Codex.

Shared Field Guide preferences live in `~/.config/filip-stack/field-guide.json`.
When `XDG_CONFIG_HOME` is set and non-empty, the path is
`$XDG_CONFIG_HOME/filip-stack/field-guide.json` instead. With `--home <dir>` and
`XDG_CONFIG_HOME` unset or empty, the path is
`<dir>/.config/filip-stack/field-guide.json`.

`apply` imports this file when it exists. If it is missing, apply prints where
to put it and continues. `field-guide-sync` imports the file if present, then
exports local shared guidance to it, creating the directory. It leaves the
repository unchanged. `update` runs `field-guide-sync` after apply when the file
exists, so guidance saved on this machine reaches it. Use a dotfile manager to
sync this file between machines.

To migrate existing preferences, run these commands on a machine that already
has them in `~/.field-guide`:

```sh
filip-stack field-guide-sync
chezmoi add ~/.config/filip-stack/field-guide.json
```

If you set `XDG_CONFIG_HOME`, use the path printed by `field-guide-sync` in the
`chezmoi add` command. Review the export before syncing it: it carries every
active shared learning.

chezmoi keeps its own copy of the file, so run `chezmoi re-add` after each
update or sync. Run `chezmoi update` first: the sync then merges the other
machines' guidance, and chezmoi has no conflict to report.

## Repository layout

```text
.claude-plugin/marketplace.json   Claude marketplace
.agents/plugins/marketplace.json  Codex marketplace
plugins/workflow/          Runtime plugin shared by Claude and Codex
  .claude-plugin/          Claude manifest
  .codex-plugin/           Codex manifest
  skills/                  The nine Workflow skills and conditional references
  THIRD_PARTY_NOTICES.md   Notices for adapted upstream guidance
plugins/field-guide/       Optional local-learning plugin
  hooks/                   Guidance injection and capture, ask, or skip lifecycle guidance
  scripts/                 Cross-host Node launcher
  skills/field-guide/      Skill, storage utility, schemas, and references
plugins/guardrails/        Optional rule-enforcement plugin
  hooks/                   PreToolUse hook for attribution and 1Password rules
  scripts/                 Cross-host Node launcher
skills/                    Standalone skills installed with the skills CLI
host-config/               General Claude and Codex guidance, agents, and styles
.agents/skills/            Repository development skills (linked from .claude/skills)
tests/workflow/            Repository-only contract and payload tests
tests/skills/              Standalone skill contracts
tests/field-guide/         Field Guide contracts and utility tests
tests/guardrails/          Guardrails hook tests
tests/host-config/         Host config apply tests
scripts/                   Version, plugin validation, and host-config scripts
docs/                      Evaluation lab notebook and evidence
docs/site/                 GitHub Pages site
```

Each marketplace entry installs its plugin directory directly, and the skills
CLI copies one `skills/<name>/` directory. Tests and evaluation fixtures stay
outside both payloads.

[AGENTS.md](AGENTS.md) explains how to choose where a new skill lives.

## Development

Install dependencies and run the complete deterministic check. Python 3.9+ is
also required for the collector tests; no Python packages are needed.

```sh
pnpm install
pnpm check
```

The check enforces the nine-skill Workflow inventory, declared activation
policy, context budgets, conditional-reference integrity, the separation of
Field Guide hooks and state, both plugins' runtime payloads, plugin manifest
validity, and standalone skill contracts. Prompt routing scenarios are evaluation inputs; static contracts do
not prove model behavior.

The Workflow skill entrypoints other than Simplify share a 3,500-word limit, and
all nine share a 4,000-word limit. Each skill entrypoint remains limited to 900
words.

Standalone skills load independently, so Workflow's combined budgets do not
apply to them. Each needs a matching name, a description of at most 80 words, a
`SKILL.md` of at most 500 lines (a size guardrail, not a token budget), one-level references of at most 1,200 words,
and relative links that stay inside its directory. It must not call a plugin
skill or share a name with one.

The site in `docs/site/` is a separate pnpm package. When it builds, it takes
the skill list and summaries from the README skill tables and each skill's
references from its directory. Each page's text in
`docs/site/src/content/skills/` is written by hand, so update it when the
skill's behavior changes.

```sh
cd docs/site
pnpm install
pnpm dev
```

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

Standalone skills have no version of their own. The skills CLI installs them
from `main`, so they ship when they merge. A releasing commit that changes only
`skills/` still bumps the plugin manifests. Host config also ships from `main`
without a version; run `filip-stack update` to pick it up. The site deploys from
`main` when the site or a skill changes.

## Evaluation

Skills and plugins in this repository are evaluated with
[PluginBench](https://github.com/filipgutica/pluginbench), which compares each
treatment with a vanilla arm on the same tasks, model, and harness.
[The lab notebook](docs/workflow-skill-evaluation-lab-notebook.md) records the
studies, decisions, and limits, and
[the evidence directory](docs/evidence/workflow-skill-evaluation/) keeps their
saved reports. Give PluginBench Workflow as a `plugins:` treatment and a
standalone skill as a `skills:` treatment pointing at `skills/<name>`. Paid runs
are separate from changes to the runtime guidance.
