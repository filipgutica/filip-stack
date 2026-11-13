# Contributing to Filip Stack

This guide is for changing the repository. [README.md](README.md) covers what
each part is and how to install it. [AGENTS.md](AGENTS.md) holds the rules that
agents follow here, including how to choose where a new skill lives.

## Set up and check

Install dependencies and run the complete deterministic check. The check needs
Node 22.22 or later for promptfoo, and Python 3.9+ for the collector tests; no
Python packages are needed.

```sh
pnpm install --frozen-lockfile
pnpm check
```

The check enforces the five-skill Workflow inventory, declared activation
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
  skills/                  The five Workflow skills and conditional references
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
tests/evals/               Guidance test gate and runner tests
evals/                     promptfoo guidance tests run by pnpm eval:<name>
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

The Workflow skill entrypoints share a 3,500-word limit. Each skill entrypoint
remains limited to 900 words.

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

`apply` copies `host-config/claude`, `codex`, and `agents` to the targets that
[README.md](README.md#host-config) lists, and replaces `{{HOME}}` with the home
directory and each `{{model:<provider>.<tier>.<id|label>}}` with its entry in
`host-config/models.json`. It assembles the guidance block from `host-config/guidance/`. The
manifest in `~/.agents/.filip-stack-host-config.json` records the applied
commit, the installed design-system version and integrity, and a hash of each
target.

The design language lives in
[filipgutica/design-system](https://github.com/filipgutica/design-system).
`apply` installs the `language/` folder of the published
`@filipgutica/design-system` version that `host-config/design-system.json` pins.
To ship a design-system release, run
`node scripts/pin-design-system.mjs <version>`, which writes the version,
integrity, and tarball URL from the npm registry, and commit the pin.
`node scripts/pin-design-system.mjs --check` downloads the pinned tarball and
verifies it; CI runs it. Tests never use the network: they pin a fixture
package from `tests/host-config/design-system-fixture.mjs`.

Edit guidance in `host-config/guidance/core.md`. The `{{include:<name>}}` lines
pull in `host-config/guidance/<host>/<name>.md` for the parts that differ between
Claude and Codex.

When a model ships, update its tier in `host-config/models.json`. Host config
names models only there, and a test enforces it. Standalone skills install
without host config, so they keep their own model names: run
`git grep -n <old model id>` and update `skills/` and `docs/site/` by hand.

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

## Guidance tests

[promptfoo](https://www.promptfoo.dev/) is the test framework for guidance.
A guidance test gives a model a fixed scenario with the guidance in its
prompt, and checks the choice it states. By default a test compares two
prompts, the guidance at a base ref and the guidance in the working tree, to
catch a regression from a change. With `--no-base` it checks only the working
tree, which is how you check the guidance on a new model.
[evals/README.md](evals/README.md) explains how a run, the rendering, and the
gate work.

| Command | Guidance under test | Scenarios |
| --- | --- | --- |
| `pnpm eval:routing` | Every routable skill's description, and Workflow reference pointers | `tests/workflow/contract-scenarios.json`, `tests/skills/scenarios/<skill>.json` |
| `pnpm eval:delegation` | Delegation guidance, role tables, `host-config/models.json` | `tests/host-config/delegation-scenarios.json` |
| `pnpm eval:autonomy` | Who settles an open decision | `tests/host-config/autonomy-scenarios.json` |
| `pnpm eval:handoff` | The footer's goal line, and when to rename the thread | `tests/host-config/handoff-scenarios.json` |
| `pnpm eval:workflow-rules` | Workflow rules no other test covers | `tests/workflow/workflow-rules-scenarios.json` |
| `pnpm eval:skill-rules` | The choices a standalone skill states at its decision points | `tests/skills/scenarios/<skill>.json` |
| `pnpm eval:hill-climb` | `hill-climb` rules: score checks, locked files, holdout | `tests/skills/hill-climb-scenarios.json` |
| `pnpm eval:retrieval` | Retrieval queries and rereading sources after compaction, in host guidance and Field Guide | `tests/host-config/retrieval-scenarios.json` |

### Add a scenario

Add an object to the scenario file. For the delegation and autonomy tests,
give it an `id`, a `task`, and `accept`: the passing choices, as one list or
a list per host (`claude`, `codex`). Set `needsNewGuidance: true` when the
change under test is meant to fix the scenario. A Workflow rules scenario also
lists its `options` as `{ key: description }`; `accept` names keys. Pair each
new rule with a control scenario where the rule should not apply.

### Test a standalone skill

Each routable standalone skill, and Field Guide, has a test file at
`tests/skills/scenarios/<skill>.json`. `node tests/skills/validate-skills.mjs`
fails when one is missing.

- `routing`: `{ id, prompt, expectedSkill, alsoAccept?, expectedReference? }`.
  Give at least one prompt that should load the skill and one near miss that
  should load another skill or none (`expectedSkill: null`). Use `alsoAccept`
  only when a second skill is also a correct choice. `expectedReference` names
  the reference file the skill's body should send the request to.
- A manual-only skill needs no file. Its routing scenarios, if any, set
  `activation: "explicit"` and name the skill in the prompt as `$<skill>`, so
  they test only `expectedReference`. Add a near miss for a similar request
  that should load no skill or another one.
- `rules`: optional. Each scenario has an `id`, a `task`, `options` as
  `{ key: description }`, and an `accept` list of keys. The prompt holds only
  that skill's `SKILL.md`.

Run one skill's tests with `pnpm eval:routing --skill <name>` or
`pnpm eval:skill-rules --skill <name>`. They run without a base, and every
attempt must pass.

### Assert a choice

Each `evals/<name>.yaml` names two prompt functions, a test generator, and one
`javascript` assertion. The assertion parses the JSON reply, classifies it
into a choice, and passes when `accept` includes that choice. Its reason is
the choice, which the result tables print. For a new decision, add these to
`evals/host-guidance.mjs` or a new module, a config beside the others, an
entry in `evals/run.mjs`, and an `eval:<name>` package script.

### Compare against `main`

```sh
pnpm eval:delegation --dry-run   # free: validates the config, renders both versions, counts calls
pnpm eval:delegation             # paid: compares with origin/main through the local CLIProxyAPI
pnpm eval:view                   # opens saved results in the promptfoo viewer
```

`--base <ref>` changes the base, `--attempts <n>` sets promptfoo's `--repeat`
(default 3), and `--model <id>` narrows the models in `evals/providers.yaml`.
The runner needs `CLIPROXY_API_KEY` or `--api-key-file`; ask before a paid run.

In a comparison, routing runs only the steps a change can affect: skill steps
when a routable skill's name or description changed, and a skill's reference
steps when its body changed. With no such change it exits 0 without a call.

promptfoo scores each answer alone, so the runner applies the gate after the
run. It fails when a scenario passes fewer attempts in the working tree than
at the base, or when a `needsNewGuidance` scenario does not gain and the
working tree misses an attempt. Without a base, it fails when the working
tree misses any attempt. A provider error stops the run; it never counts as a
failed attempt.

### Check a new model

1. Add the model to `evals/providers.yaml`.
2. Run each test with `--no-base --model <id>`, starting with a dry run.
3. A failing row shows guidance the model reads differently. Change the
   guidance, then confirm with a normal comparison that the change does not
   regress the current models.

### Results

Every run is saved in promptfoo's local results store, which `pnpm eval:view`
opens. Runs are not written to `docs/evidence/`: each saved result holds the
full rendered guidance and reply for every call, which is raw per-call data.
For a study, put the printed tables in `docs/evidence/<study>/` and record the
study in the lab notebook.

### CI

CI cannot reach the CLIProxyAPI, so it never makes model calls. `pnpm check`
runs each test's dry run, the gate tests, and an autonomy run against a local
stub that checks the request body and the results tables.

### PluginBench

A guidance test checks a stated choice. [PluginBench](https://github.com/filipgutica/pluginbench)
is a separate research project. It measures what an agent does over a whole
task and compares guidance with vanilla or with other guidance packages. It is
optional: no change here needs a PluginBench run.
[The lab notebook](docs/workflow-skill-evaluation-lab-notebook.md) and
[the evidence directory](docs/evidence/workflow-skill-evaluation/) keep its
past studies.

