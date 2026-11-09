# Contributing to Filip Stack

This guide is for changing the repository. [README.md](README.md) covers what
each part is and how to install it. [AGENTS.md](AGENTS.md) holds the rules that
agents follow here, including how to choose where a new skill lives.

## Set up and check

Install dependencies and run the complete deterministic check. Python 3.9+ is
also required for the collector tests; no Python packages are needed.

```sh
pnpm install --frozen-lockfile
pnpm check
```

The check enforces the nine-skill Workflow inventory, declared activation
policy, context budgets, conditional-reference integrity, the separation of
Field Guide hooks and state, all three plugins' runtime payloads, plugin manifest
validity, and standalone skill contracts. Prompt routing scenarios are
evaluation inputs; static contracts do not prove model behavior.

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

## How Workflow stays small

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

Failed evidence returns only to the affected step, and explicit stop conditions
prevent unbounded retries. Complex work can form a small task graph through
dependencies and independent owners. Workflow is not a scheduler or unattended
loop runner, and it adds no graph schema, state engine, or orchestration
runtime for linear work.

### Where artifact formats live

Default specification, plan, and ticket formats live in Planning's mode
references; the PR description format lives in Technical-writing's references.
Technical-writing owns prose quality; planning owns scope, decisions, and
implementation readiness.

Grill and walkthrough log formats stay beside their skills. The notes folders
in `~/.engineering-workflow/` have no registry or task tracking. When work
resumes from a checkpoint, the agent rechecks current evidence.

## Skill budgets

The Workflow skill entrypoints other than Simplify share a 3,500-word limit, and
all nine share a 4,000-word limit. Each skill entrypoint remains limited to 900
words.

Standalone skills load independently, so Workflow's combined budgets do not
apply to them. Each needs a matching name, a description of at most 80 words, a
`SKILL.md` of at most 500 lines (a size guardrail, not a token budget),
one-level references of at most 1,200 words, and relative links that stay
inside its directory. It must not call a plugin skill or share a name with one.

## Skill packaging

Workflow, Field Guide, and repository development skills set
`metadata.internal: true`, so the skills CLI does not offer them. They depend on
their plugin or this checkout and must not install on their own.

An adapted skill carries `THIRD_PARTY_NOTICES.md` in its own directory with the
upstream source and the baseline commit. The repository's `upstream-sync` skill
compares it with upstream.

The site credits each `## <upstream>` section on the skill's page. It links the
`Tracked path` when there is one, and otherwise the `Source`. It names the
holder from the `Copyright (c)` line, or an `Author:` line when the license has
none. In `plugins/workflow/THIRD_PARTY_NOTICES.md`, each section lists the
skills it credits in an `Adapted in:` line. The site build fails when a field
is missing.

## Host config

`apply` copies `host-config/claude`, `codex`, `agents`, and `design-language` to
the targets that [README.md](README.md#host-config) lists, and replaces
`{{HOME}}` with the home directory. It assembles the guidance block from
`host-config/guidance/`. The manifest in `~/.agents/.filip-stack-host-config.json`
records the applied commit and a hash of each target.

Edit guidance in `host-config/guidance/core.md`. The `{{include:<name>}}` lines
pull in `host-config/guidance/<host>/<name>.md` for the parts that differ between
Claude and Codex.

### Share Field Guide preferences

Shared Field Guide preferences live in `~/.config/filip-stack/field-guide.json`.
When `XDG_CONFIG_HOME` is set and non-empty, the path is
`$XDG_CONFIG_HOME/filip-stack/field-guide.json` instead. With `--home <dir>` and
`XDG_CONFIG_HOME` unset or empty, the path is
`<dir>/.config/filip-stack/field-guide.json`.

`field-guide-sync` creates the file's directory when it exports, and it leaves
the repository unchanged.

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

## Site

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

| In the commit message | Version bump |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| A `BREAKING CHANGE:` footer | major |

With the default commit analyzer, a `!` after the type, as in `feat!:`, does
not trigger a major release on its own. Add the `BREAKING CHANGE:` footer.

When a release is due, CI stamps `package.json`, every plugin manifest, and both
marketplace registries before creating the GitHub release.

### CLI releases

The dependency-free Node launcher in `cli/` uses release-please independently
of the plugins. `cli/package.json` and `.release-please-manifest.json` own its
version. The **Release** workflow collects changes under `cli/` into a release
PR; merging that PR publishes `cli-vX.Y.Z`. Plugin tags remain `vX.Y.Z` and
semantic-release continues to own their versions.

The launcher runs `scripts/host-config.mjs` from `~/code/filip-stack`, or the
checkout selected with `--repo <dir>`. Host config still ships from `main`.
Homebrew installs the launcher directly; it has no dependencies to install or
build step, so the repository keeps its existing pnpm tooling.

The CLI starts at `0.0.0` until its first release PR. The bootstrap SHA in
`release-please-config.json` excludes older plugin history. Enable GitHub's
**Allow GitHub Actions to create and approve pull requests** setting before
running release-please. Bot release PRs do not trigger PR workflows; dispatch
`ci.yml` and `cli.yml` on that PR's branch and verify its exact head before merging.

The `filipgutica/homebrew-tap` updater selects stable `cli-v` releases and
creates the first formula from its template when one exists. Later runs update
that formula. It hashes the tagged source archive and opens a formula PR;
Homebrew installation becomes available after that PR merges. The tap tests
the formula on macOS and Linux.

Standalone skills have no version of their own. The skills CLI installs them
from `main`, so they ship when they merge. A releasing commit that changes only
`skills/` still bumps the plugin manifests. Host config also ships from `main`
without a version. The site deploys from `main` when the site, the README, or
a skill's `SKILL.md` or references change.

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
