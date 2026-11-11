# Filip Stack

This repository is Filip's plugin marketplace and the home for the skills he maintains, for Claude and Codex. [README.md](README.md) describes each component and how to install it.

## Skill tiers

Decide a skill's tier before you add or move it:

| Tier | What it is | Where it lives | How to tell |
| --- | --- | --- | --- |
| 1. Workflow | Works with other Workflow skills | `plugins/workflow/skills/<name>/` | Links another Workflow skill's references, routing, or handoffs, or another Workflow skill depends on it |
| 2. Standalone | Written here and useful alone | `skills/<name>/` | No dependency on a plugin skill |
| 3. Adapted | A standalone skill based on an upstream skill, with local changes | `skills/<name>/` with `THIRD_PARTY_NOTICES.md` (source and baseline commit) | `upstream-sync` compares it with upstream |
| 4. Downloaded | An upstream skill used unchanged | Outside this repository | Installed with `npx skills add <source>` and unchanged from its lock entry |
| Excluded | Organization-specific skills | Outside this repository | Depends on an employer's systems or repositories |

Host configuration is not a skill. `host-config/` holds the general global guidance, agent templates, and output styles that `scripts/host-config.mjs` applies to `~/.claude`, `~/.codex`, and `~/.agents`. The script also installs the design language to `~/design-language` from the published `@filipgutica/design-system` package that `host-config/design-system.json` pins. Edit the design language in `filipgutica/design-system`, then bump the pin with `node scripts/pin-design-system.mjs <version>`. Host config ships from `main` without a version; the design language follows its pin. Keep it free of employer-specific content and machine-specific paths; use `{{HOME}}` for the home directory. Shared Field Guide preferences live in the user's dotfile, outside this repository; see [CONTRIBUTING.md](CONTRIBUTING.md#share-field-guide-preferences).

Skills that are not standalone set `metadata.internal: true`, so the skills CLI does not offer them. This covers plugin skills and repository development skills. Field Guide stays a plugin because it ships a hook.

A standalone skill may require other standalone skills by name, as `full-send` requires `sol-loop` and `babysit-pr`. It stops when one is missing, and its README row says to install them together. A skill that depends on Workflow skills belongs in the plugin.

## Principles

- Keep context small. Hosts see only names and descriptions; a selected `SKILL.md` names the one reference its route needs. `tests/workflow/validate-contracts.mjs` and `tests/skills/validate-skills.mjs` enforce the budgets.
- A public Workflow skill does not invoke another. The validator allows only the declared `test-audit` calls from `engineering` and `review`.
- Manual-only skills set `disable-model-invocation: true` and `allow_implicit_invocation: false`.
- Runtime payloads contain no tests or evaluation fixtures. Workflow ships no hooks and does not depend on Field Guide.
- Removed or renamed skills get no compatibility aliases. A change to an invocation name is a major release.
- Static contracts do not prove model behavior. Measure that with PluginBench.

## Site pages

- The site in `docs/site/` is written for people choosing or learning a skill.
- Explain what the skill is for and how to start.
- Do not copy `SKILL.md` steps. Link the `SKILL.md` for the exact contract.
- The README skill table row is the page's lede. Keep it to one line about what the skill is for.
- Do not repeat the lede in "What it does".
- When a skill's behavior changes, update its page in the same PR.

## Evaluation

PluginBench (`~/code/pluginbench`, [filipgutica/pluginbench](https://github.com/filipgutica/pluginbench)) evaluates the skills and plugins here, and this repository is its main customer. Ship a behavior change to Workflow guidance only after an evaluation supports it. For a change to activation text only, meaning skill descriptions and the pointers that choose a reference, a `pnpm eval:routing` run with no regressions is that evaluation; put its table in the PR. Changes to what a skill does need PluginBench.

- Compare every treatment with vanilla on matched tasks, model, reasoning, harness, and attempts.
- Run a dry run first. A paid run needs the user's approval.
- Reviewer findings are uncalibrated diagnostics, not a quality score.
- Record each study in `docs/workflow-skill-evaluation-lab-notebook.md` and its saved reports in `docs/evidence/`.
- `pnpm eval:<name>` runs a promptfoo guidance test: it checks a stated choice on fixed scenarios, base ref against working tree. PluginBench owns whole-task behavior and comparisons with vanilla or other guidance. Read [CONTRIBUTING.md](CONTRIBUTING.md#guidance-tests) before you add a scenario or a guidance test.
- Before you push a Workflow `SKILL.md` edit, run `pnpm eval:routing --dry-run`, then a real run when the user approves. It compares skill and reference routing against the base branch through the local CLIProxyAPI.
- Before you push a change to the delegation guidance, role tables, or `host-config/models.json`, run `pnpm eval:delegation --dry-run`, then a real run when the user approves. It asks each host's main-thread model where the scenarios in `tests/host-config/delegation-scenarios.json` should run, with the guidance at the base branch and in the working tree.
- Before you push a change to the autonomy guidance, which says when to decide, ask the advisor, convene a council, or ask the user, run `pnpm eval:autonomy --dry-run`, then a real run when the user approves. It scores the scenarios in `tests/host-config/autonomy-scenarios.json` the same way.

## Checks and release

- Set up a fresh worktree with `pnpm install --frozen-lockfile`.
- Run one test file with `node --test tests/host-config/host-config.test.mjs` or one contract validator with `node tests/workflow/validate-contracts.mjs`.
- Run `pnpm check` before you commit. CI runs the same check.
- Use Conventional Commits. semantic-release on `main` versions the plugins and both marketplaces. Do not edit versions by hand.
- Standalone skills ship from `main` when they merge and have no version. semantic-release bumps the plugins for every release, so a `BREAKING CHANGE:` footer belongs only on a change that breaks a plugin or marketplace. Describe a breaking standalone-skill change in the PR description.
- Use the `release-and-refresh` skill to ship a change and refresh local Claude and Codex installs.
- Repository development skills live in `.agents/skills/<name>/`, with a relative `.claude/skills/<name>` link and a `.gitignore` exception for that link.
