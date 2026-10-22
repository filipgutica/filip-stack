# Filip Stack

This repository is Filip's plugin marketplace and the home for the skills he maintains, for Claude and Codex. [README.md](README.md) describes each component and how to install it.

## Skill tiers

Decide a skill's tier before you add or move it:

1. **Workflow skill:** depends on other Workflow skills' references, routing, or handoffs. It lives in `plugins/workflow/skills/` and ships with the plugin.
2. **Standalone skill:** written here and useful alone. It lives in `skills/<name>/` and installs with `npx skills add filipgutica/filip-stack -s <name>`.
3. **Adapted skill:** a standalone skill based on an upstream skill. It is a tier 2 skill with `skills/<name>/THIRD_PARTY_NOTICES.md` recording the source and baseline commit. `upstream-sync` compares it with upstream.
4. **Downloaded skill:** used unchanged from upstream with `npx skills add <source>`. It does not belong in this repository.

Skills that are not standalone set `metadata.internal: true`, so the skills CLI does not offer them. Field Guide stays a plugin because it ships a hook. Organization-specific skills do not belong here.

## Principles

- Keep context small. Hosts see only names and descriptions; a selected `SKILL.md` names the one reference its route needs. `tests/workflow/validate-contracts.mjs` and `tests/skills/validate-skills.mjs` enforce the budgets.
- A public Workflow skill does not invoke another. The validator allows only the declared `test-audit` calls from `engineering` and `review`.
- Manual-only skills set `disable-model-invocation: true` and `allow_implicit_invocation: false`.
- Runtime payloads contain no tests or evaluation fixtures. Workflow ships no hooks and does not depend on Field Guide.
- Removed or renamed skills get no compatibility aliases. A change to an invocation name is a major release.
- Static contracts do not prove model behavior. Measure that with PluginBench.

## Evaluation

PluginBench (`~/code/pluginbench`, [filipgutica/pluginbench](https://github.com/filipgutica/pluginbench)) evaluates the skills and plugins here, and this repository is its main customer. Give it Workflow as a `plugins:` treatment and a standalone skill as a `skills:` treatment pointing at `skills/<name>`.

- Compare every treatment with vanilla on matched tasks, model, reasoning, harness, and attempts.
- Run `pluginbench run --config <file> --dry-run` first. A paid run needs the user's approval.
- Reviewer findings are uncalibrated diagnostics, not a quality score.
- Record each study in `docs/workflow-skill-evaluation-lab-notebook.md` and its saved reports in `docs/evidence/`.

## Checks and release

- Run `pnpm check` before you commit. CI runs the same check.
- Use Conventional Commits. semantic-release on `main` versions the plugins and both marketplaces. Do not edit versions by hand.
- Standalone skills ship from `main` when they merge and have no version.
- Use the `release-and-refresh` skill to ship a change and refresh local Claude and Codex installs.
- Repository development skills live in `.agents/skills/<name>/`, with a relative `.claude/skills/<name>` link and a `.gitignore` exception for that link.
