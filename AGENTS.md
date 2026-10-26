# Filip Stack

This repository is Filip's plugin marketplace and the home for the skills he maintains, for Claude and Codex. [README.md](README.md) describes each component and how to install it.

## Skill tiers

Decide a skill's tier before you add or move it:

| Tier | What it is | Where it lives | How to tell |
| --- | --- | --- | --- |
| 1. Workflow | Works with other Workflow skills | `plugins/workflow/skills/<name>/` | Links another Workflow skill's references, routing, or handoffs, or another skill depends on it |
| 2. Standalone | Written here and useful alone | `skills/<name>/` | No dependency on a plugin skill |
| 3. Adapted | A standalone skill based on an upstream skill, with local changes | `skills/<name>/` with `THIRD_PARTY_NOTICES.md` (source and baseline commit) | `upstream-sync` compares it with upstream |
| 4. Downloaded | An upstream skill used unchanged | Outside this repository | Installed with `npx skills add <source>` and unchanged from its lock entry |
| Excluded | Organization-specific skills | Outside this repository | Depends on an employer's systems or repositories |

Host configuration is not a skill. `host-config/` holds the general global guidance, agent templates, output styles, design language, and shared Field Guide export that `scripts/host-config.mjs` applies to `~/.claude`, `~/.codex`, `~/.agents`, and `~/design-language`. It ships from `main` without a version. Keep it free of employer-specific content and machine-specific paths; use `{{HOME}}` for the home directory.

Skills that are not standalone set `metadata.internal: true`, so the skills CLI does not offer them. This covers plugin skills and repository development skills. Field Guide stays a plugin because it ships a hook.

## Principles

- Keep context small. Hosts see only names and descriptions; a selected `SKILL.md` names the one reference its route needs. `tests/workflow/validate-contracts.mjs` and `tests/skills/validate-skills.mjs` enforce the budgets.
- A public Workflow skill does not invoke another. The validator allows only the declared `test-audit` calls from `engineering` and `review`.
- Manual-only skills set `disable-model-invocation: true` and `allow_implicit_invocation: false`.
- Runtime payloads contain no tests or evaluation fixtures. Workflow ships no hooks and does not depend on Field Guide.
- Removed or renamed skills get no compatibility aliases. A change to an invocation name is a major release.
- Static contracts do not prove model behavior. Measure that with PluginBench.

## Evaluation

PluginBench (`~/code/pluginbench`, [filipgutica/pluginbench](https://github.com/filipgutica/pluginbench)) evaluates the skills and plugins here, and this repository is its main customer. Ship a behavior change to Workflow guidance only after an evaluation supports it.

- Compare every treatment with vanilla on matched tasks, model, reasoning, harness, and attempts.
- Run a dry run first. A paid run needs the user's approval.
- Reviewer findings are uncalibrated diagnostics, not a quality score.
- Record each study in `docs/workflow-skill-evaluation-lab-notebook.md` and its saved reports in `docs/evidence/`.

## Checks and release

- Run `pnpm check` before you commit. CI runs the same check.
- Use Conventional Commits. semantic-release on `main` versions the plugins and both marketplaces. Do not edit versions by hand.
- Standalone skills ship from `main` when they merge and have no version.
- Use the `release-and-refresh` skill to ship a change and refresh local Claude and Codex installs.
- Repository development skills live in `.agents/skills/<name>/`, with a relative `.claude/skills/<name>` link and a `.gitignore` exception for that link.
