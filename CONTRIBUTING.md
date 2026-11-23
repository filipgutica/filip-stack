# Contributing to Filip Stack

This guide covers setup, checks, layout, releases, and guidance tests. See
[README.md](README.md) for installation and usage, and [AGENTS.md](AGENTS.md)
for repository rules and skill tiers.

## Set up and check

Requirements: Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` (required by locked
promptfoo dependencies; `package.json` declares `>=22.12.0`), pnpm (`10.34.7`),
and Python 3.9+ for `tests/skills/pr_review_churn_collector_test.py` (no Python
packages needed).

```sh
pnpm install --frozen-lockfile
pnpm check
```

Run a single test file or validator while iterating:

```sh
node --test tests/host-config/host-config.test.mjs
node tests/workflow/validate-contracts.mjs
```

`pnpm check` runs the root repository's deterministic checks (site checks run in
`docs/site/`):

| Suite | Covers |
| --- | --- |
| `test:workflow-contracts`, `test:skills` | Skill inventories, activation policy, budgets, links, and skill script tests |
| `test:field-guide*`, `test:guardrails` | Field Guide boundary, schemas, hooks, storage, dreaming, and Guardrails rules |
| `test:plugin-payload`, `validate-plugins` | Runtime payload exclusions and Claude, Codex, and Antigravity manifests |
| `test:host-config` | Host config apply, helper scripts, design-system migration, CLI, and sync |
| `test:evals` | Guidance test dry runs, gate logic, and a stubbed end-to-end run |
| `test:static` | Fallow dead-code, complexity health, and duplicate checks |

Static contracts do not prove model behavior; use
[Guidance tests](#guidance-tests) for behavior changes.

## Repository layout

```text
.claude-plugin/marketplace.json   Claude marketplace
.agents/plugins/marketplace.json  Codex marketplace
cli/                              Dependency-free filip-stack CLI launcher
plugins/workflow/                 Workflow plugin (.antigravity-plugin, .claude-plugin, .codex-plugin, skills/, THIRD_PARTY_NOTICES.md)
plugins/field-guide/              Local-learning plugin (hooks/, scripts/, skills/field-guide/)
plugins/guardrails/               Rule-enforcement plugin (hooks/, scripts/)
skills/                           Standalone skills installed with the skills CLI
host-config/                      Global guidance, models.json, agents, rules, and styles
.agents/skills/                   Repository development skills (linked from .claude/skills)
tests/                            Unit, contract, hook, CLI, and scenario tests by component
evals/                            promptfoo guidance tests run by pnpm eval:<name>
scripts/                          Version, validation, host-config, and sync scripts
docs/                             Evaluation lab notebook, evidence, and GitHub Pages site (docs/site/)
```

Each marketplace installs its plugin directory directly, and the skills CLI
copies one `skills/<name>/` directory. Tests and evaluation fixtures stay
outside both payloads.

## How Workflow stays small

Workflow uses three levels of progressive disclosure:

1. The host sees only each skill's name and description while routing.
2. The selected `SKILL.md` gives the operating contract.
3. A short reference file loads only when the chosen mode needs it.

Public Workflow skills do not chain each other, except that `engineering` and
`review` call `test-audit` when a test audit is requested, coverage changes are
substantial, or test value is uncertain. Internal modes live inside
`engineering`, `planning`, and `review` (see `plugins/workflow/skills/` for each
contract). Default spec, plan, and ticket formats live in `planning` references;
PR description format lives in `technical-writing` references. Workflow installs
no hooks, scheduler, or state engine.

## Skill budgets

Contract validators enforce these limits:

| Rule | Workflow skills | Standalone skills |
| --- | --- | --- |
| Combined entrypoints | 3,500 words max across all five `SKILL.md` files | No combined limit |
| Single `SKILL.md` | 900 words max | 500 lines max (size guardrail, not a token budget) |
| Description | 80 words max | 80 words max |
| References | One level deep, 1,200 words max per file | One level deep, 1,200 words max per file |
| Links and naming | References resolve inside the skill | Relative links stay inside the skill; name matches directory; cannot call or shadow a plugin skill |

## Skill packaging

- **Internal skills:** Workflow, Field Guide, and `.agents/skills/` set
  `metadata.internal: true` so the skills CLI hides them.
- **Adapted skills:** Carry `THIRD_PARTY_NOTICES.md` with `Source:` and
  `Baseline:` (commit SHA). The `upstream-sync` skill compares against upstream.
- **Site upstream credits:** The site reads each `## <upstream>` section in
  `THIRD_PARTY_NOTICES.md`, linking `Tracked path` if present (else `Source`),
  reading the holder from `Copyright (c)` or `Author:`, and reading `Adapted in:`
  in `plugins/workflow/THIRD_PARTY_NOTICES.md`. Missing fields fail the site
  build.

## Host config

`scripts/host-config.mjs` copies `host-config/claude`, `host-config/codex`, and
`host-config/agents` to the targets in [README.md](README.md#host-config),
substituting `{{HOME}}` and `{{model:<provider>.<tier>.<id|label>}}` from
`host-config/models.json`, and writes a manifest to
`~/.agents/.filip-stack-host-config.json`.

- **Global guidance:** Edit `host-config/guidance.md` (installed to
  `~/.agents/AGENTS.md`, imported by `~/.claude/CLAUDE.md`, copied into
  `~/.codex/AGENTS.md`). Put host-specific rules in its Host notes section.
- **Model updates:** Update `host-config/models.json` for host config (enforced
  by test). For standalone skills and site docs, run
  `git grep -n <old model id>` and update `skills/` and `docs/site/` directly.
- **Design system:** Ships from
  [filipgutica/design-system](https://github.com/filipgutica/design-system).
  `scripts/host-config.mjs` retires older `~/design-system` and
  `~/design-language` installs (`tests/host-config/design-system-migration.test.mjs`).

### Share Field Guide preferences

Shared preferences live in `field-guide.json`, with confirmations and event
triggers in `field-guide-annotations.json` beside it:

| Condition | Directory |
| --- | --- |
| Default | `~/.config/filip-stack/` |
| `XDG_CONFIG_HOME` set and non-empty | `$XDG_CONFIG_HOME/filip-stack/` |
| `--home <dir>` with `XDG_CONFIG_HOME` unset or empty | `<dir>/.config/filip-stack/` |

`apply` imports `field-guide-annotations.json` when present. `field-guide-sync`
imports and exports both files, creates their directory if needed, and leaves
this repository unchanged. Both imports validate before writing.

Migrate existing preferences from `~/.field-guide`:

```sh
filip-stack field-guide-sync
chezmoi add ~/.config/filip-stack/field-guide.json ~/.config/filip-stack/field-guide-annotations.json
```

If `XDG_CONFIG_HOME` is set, pass the paths printed by `field-guide-sync` to
`chezmoi add`. Review the exported files before syncing, because they carry
every active shared learning. When using chezmoi, run `chezmoi update`, then
sync or update, then `chezmoi re-add` to avoid conflicts.

## Site

`docs/site/` is a separate pnpm package. Its build reads skill names, summaries,
and "Needs `a` and `b`." install lists from the `README.md` skill tables,
references and notices from each skill directory, and hand-written prose from
`docs/site/src/content/skills/`. Update a skill's page when its behavior
changes.

```sh
pnpm --dir docs/site install --frozen-lockfile
pnpm --dir docs/site check                                         # Astro and vue-tsc check
pnpm --dir docs/site build                                         # build and validate catalog
pnpm --dir docs/site exec playwright install --with-deps chromium  # once per fresh checkout
pnpm --dir docs/site test:e2e                                      # Playwright tests
```

Run a local preview server in the foreground:

```sh
pnpm --dir docs/site dev
```

## Releases and versioning

CI runs `semantic-release` on pushes to `main` using
[Conventional Commits](https://www.conventionalcommits.org/). PRs merge by
squash: the PR title becomes the commit title on `main`, and the branch's commit
messages become its body, so footers such as `BREAKING CHANGE:` carry over. CI
lints the PR title with commitlint.

| In the commit message | Version bump |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `BREAKING CHANGE:` footer | major |

With the default commit analyzer, `!` after a type (like `feat!:`) does not
trigger a major bump; include a `BREAKING CHANGE:` footer. On release, CI stamps
`package.json`, all Claude, Codex, and Antigravity plugin manifests, and both
marketplaces, then tags `vX.Y.Z`.

- **Standalone skills** have no version and ship on merge to `main` (a releasing
  commit touching only `skills/` still bumps plugin manifests).
- **Host config** ships from `main` without a version.
- **The site** deploys on pushes to `main` touching `docs/site/**`, `README.md`,
  `SKILL.md`, `references/**`, or `THIRD_PARTY_NOTICES.md`.

### CLI releases

The zero-dependency launcher in `cli/` releases separately via `release-please`:

- `cli/package.json` and `.release-please-manifest.json` own the version;
  merging the **Release** workflow's PR tags `cli-vX.Y.Z` (the bootstrap SHA in
  `release-please-config.json` excludes older plugin history).
- The launcher runs `scripts/host-config.mjs` (or `scripts/sync.mjs` for `sync`)
  from `~/code/filip-stack` or `--repo <dir>`, with no build step.
- Enable GitHub's **Allow GitHub Actions to create and approve pull requests**
  setting. Bot release PRs do not trigger PR workflows, so dispatch `ci.yml` and
  `cli.yml` on the PR branch and verify its exact head before merging.
- `filipgutica/homebrew-tap` picks up stable `cli-v` tags, hashes the source
  archive, opens a formula PR, and tests on macOS and Linux. Users can install
  the new version only after that formula PR merges.

## Guidance tests

Guidance tests use [promptfoo](https://www.promptfoo.dev/) to send a fixed
scenario with guidance in the prompt and check the model's stated choice. By
default each test compares a base ref against the working tree; `--no-base`
checks only the working tree (used for new models). See
[evals/README.md](evals/README.md) for rendering, scoring, and gate internals.

| Command | Guidance under test | Scenarios |
| --- | --- | --- |
| `pnpm eval:routing` | Routable skill descriptions and Workflow reference pointers | `tests/workflow/contract-scenarios.json`, `tests/skills/scenarios/<skill>.json` |
| `pnpm eval:delegation` | Delegation guidance, role tables, `host-config/models.json` | `tests/host-config/delegation-scenarios.json` |
| `pnpm eval:delegation-rules` | Delegated brief rules and escalation | `tests/host-config/delegation-rules-scenarios.json` |
| `pnpm eval:autonomy` | Who settles an open decision | `tests/host-config/autonomy-scenarios.json` |
| `pnpm eval:handoff` | Current state footer and thread renaming | `tests/host-config/handoff-scenarios.json` |
| `pnpm eval:host-rules` | Other host guidance rules | `tests/host-config/host-rules-scenarios.json` |
| `pnpm eval:workflow-rules` | Other Workflow rules | `tests/workflow/workflow-rules-scenarios.json` |
| `pnpm eval:coding-standards` | `CODING_STANDARDS.md` with Engineering, Reviewer, and council gate | `tests/host-config/coding-standards-scenarios.json` |
| `pnpm eval:skill-rules` | Standalone skill decision points | `tests/skills/scenarios/<skill>.json` |
| `pnpm eval:hill-climb` | `hill-climb` score checks, locked files, and holdout | `tests/skills/hill-climb-scenarios.json` |
| `pnpm eval:retrieval` | Retrieval queries and post-compaction rereads | `tests/host-config/retrieval-scenarios.json` |

### Add a scenario

- **Delegation and autonomy:** Add `{ id, task, accept }` (`accept` is a list,
  or a `{ claude, codex }` map).
- **Rules tests:** Also add `options` as `{ key: description }`; `accept` lists
  passing keys.
- **New fixes and controls:** Set `needsNewGuidance: true` on the scenario a
  change fixes, and pair it with a control scenario where the rule should not
  apply.

### Write a regression and its control

Give the model the exact facts from the failure and plausible choices. Keep the
same choices in the control and change only the condition that triggers the new
rule. For a standalone skill, add both objects to its `rules` array:

```json
[
  {
    "id": "review-approval-stale-head",
    "task": "The user asks whether the PR is ready. The current head is b6e091c and all required checks passed. The automated review approved a489d2f. No other review is required.",
    "options": {
      "ready": "report that the PR is ready",
      "wait": "report that approval of the current head is still needed"
    },
    "accept": ["wait"],
    "needsNewGuidance": true
  },
  {
    "id": "review-approval-current-head",
    "task": "The user asks whether the PR is ready. The current head is b6e091c and all required checks passed. The automated review approved b6e091c. No other review is required.",
    "options": {
      "ready": "report that the PR is ready",
      "wait": "report that approval of the current head is still needed"
    },
    "accept": ["ready"]
  }
]
```

A strong fix misses on the base and passes in the working tree, while the
control passes on both.

### Test a standalone skill

Each routable standalone skill, plus Field Guide, needs
`tests/skills/scenarios/<skill>.json` (`node tests/skills/validate-skills.mjs`
enforces this):

- **`routing`:** `{ id, prompt, expectedSkill, alsoAccept?, expectedReference? }`
  with at least one positive prompt and one near miss (`expectedSkill: null` or
  another skill).
- **Manual-only skills:** Optional file. Any routing scenarios set
  `activation: "explicit"` and name `$<skill>` to test `expectedReference`,
  paired with a near miss.
- **`rules` (optional):** `{ id, task, options, accept, files? }`. `files` adds
  extra repo files (such as a reference) alongside `SKILL.md`.

Run one skill's tests (no base; every attempt must pass):

```sh
pnpm eval:routing --skill <name>
pnpm eval:skill-rules --skill <name>
```

### Assert a choice

To add a new decision test, add the prompt, test generator, and `javascript`
assertion to `evals/host-guidance.mjs` (or a new module), add
`evals/<name>.yaml`, register it in `evals/run.mjs`, and add `eval:<name>` to
`package.json`. See [evals/README.md](evals/README.md#files).

### Compare against `main`

```sh
pnpm eval:delegation --dry-run   # free: validates config, renders both versions, counts calls
pnpm eval:delegation             # paid: compares with origin/main through local CLIProxyAPI
pnpm eval:view                   # opens saved results in the promptfoo viewer
```

Flags: `--base <ref>` (default `origin/main`), `--attempts <n>` (default `3`),
`--model <id>` (from `evals/providers.yaml`), and `--api-key-file <path>`. The
CLIProxyAPI key comes from `--api-key-file` first, then `CLIPROXY_API_KEY`, then
`~/.config/secrets/cliproxy-client-key`. Ask before a paid run. `eval:routing`
runs only affected steps and exits `0` when nothing routable changed.

After promptfoo finishes, the gate in `evals/run.mjs` fails on any regression
against base, any `needsNewGuidance` case that fails to improve and misses an
attempt, any missed attempt under `--no-base`, or any provider error.

### Check a new model

1. Add the model to `evals/providers.yaml`.
2. Run each test with `--no-base --model <id>`, starting with `--dry-run`.
3. Fix failing guidance, then run normal base comparisons to confirm no
   regressions on existing models.

### Results, CI, and PluginBench

- **Results:** Promptfoo stores raw runs locally (`pnpm eval:view`). Do not
  commit raw runs to `docs/evidence/`; save only printed summary tables for a
  study in `docs/evidence/<study>/`.
- **CI:** Never calls live models. `pnpm check` runs every test's `--dry-run`,
  gate tests, and a stubbed autonomy run.
- **PluginBench:** [PluginBench](https://github.com/filipgutica/pluginbench) is
  a separate whole-task benchmark; no change here requires it. Past studies live
  in [the lab notebook](docs/workflow-skill-evaluation-lab-notebook.md) and
  [the evidence directory](docs/evidence/workflow-skill-evaluation/).
