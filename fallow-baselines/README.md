# Static analysis gate

Use Node 22.12.0 or later; the Fallow npm package requires Node 22.
`pnpm check` runs `pnpm test:static` with Fallow 3.18.0. The three checks compare
the current tree with these committed baselines and fail on new findings:

| Check | Baseline | Existing findings |
| --- | --- | --- |
| Unused files, exports, types and dependencies | `dead-code.json` | 0 |
| Function complexity | `health.json` | 9: 2 critical, 5 high, 2 moderate |
| Duplication | `dupes.json` | 11 clone groups, 22 instances |

The root configuration covers scripts, tests, plugin hooks and scripts, and the
site source and tests. It excludes skill and host templates, evaluation artifacts,
fixtures, generated files, CSS, and Fallow's built-in generated-output exclusions
such as `node_modules`, `dist`, `build`, and `coverage`. Package scripts, framework
discovery, and three explicit external entry points supply the module graph.
Tool-consumed default configuration exports and two Vite CSS query imports have
narrow exceptions in `.fallowrc.jsonc`.

Fallow 3.18.0's duplication command reports new clone groups but exits 0 even with
`--fail-on-issues`. `scripts/check-fallow-dupes.mjs` checks the baseline-filtered
JSON report and fails on any new clone group, preserving CLI failures.

Complexity uses the Workbench limits of 20 cyclomatic and 15 cognitive. Its baseline
matches function identity and severity, so a new named hotspot cannot replace an
old hotspot in the same file unnoticed. It does not enforce numeric improvement
within an existing severity band. Duplication uses mild mode, at least 50 tokens,
5 lines and 2 occurrences, with tests explicitly included. CRAP is disabled because
this gate has no runtime coverage input.

## Updating baselines

Fix new findings first. Refresh a baseline only after reviewing and accepting the
remaining findings, or after removing existing debt. From the repository root:

```sh
pnpm exec fallow dead-code --save-baseline fallow-baselines/dead-code.json
pnpm exec fallow health --complexity --baseline-mode identity --save-baseline fallow-baselines/health.json
pnpm exec fallow dupes --save-baseline fallow-baselines/dupes.json
node -e "const f='fallow-baselines/dupes.json', d=require('./' + f); delete d.normalized_clone_fingerprints; require('fs').writeFileSync(f, JSON.stringify(d, null, 2) + '\n')"
pnpm test:static
```

The `node -e` line removes `normalized_clone_fingerprints` from the duplication
baseline. In Fallow 3.18.0 those fingerprints share one hash with a report-order
suffix, so adding or removing an unrelated clone group changes which groups the
baseline accepts. Without them, Fallow matches the stable `clone_fingerprints`.

The save commands report the unsuppressed findings; dead-code and health can exit
1 while still writing their baselines. Inspect each result and the baseline diff,
update the counts above, and commit the baseline with the reviewed change. CI
never regenerates baselines.

## Not covered

Pillar 2 still has no type gate: no `tsc --checkJs`. Fallow's syntactic analysis
does not check types. This gate also does not run the site build or browser tests.
