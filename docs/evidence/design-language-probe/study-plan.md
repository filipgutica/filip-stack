# Design language probe study plan

Date: 2026-11-04

Status: first run complete on 2026-11-04, as a one-off without PluginBench. It covered the standalone build only, and the guidance was not supported. See [probe-run-2026-11-04.md](probe-run-2026-11-04.md).

Paths prefixed with `pluginbench/` are relative to the PluginBench repository at commit `c6a6909`.

## Question

Do agents build forms, data tables, and responsive layouts more consistently after the design-language change that adds the Forms, Data views, and breakpoint guidance?

The treatment is `host-config/design-language/` at the PR head.
The control is the same directory at the PR base.
The directory includes `DESIGN.md`, `tokens.css`, and the three example pages.
The examples are part of the treatment because the PR changes their breakpoints and agents copy them.

## Fixed probe briefs

Each brief is the same text in every arm.

1. **Settings form.** "Build a standalone settings page for a CLI tool: project name, default branch (select), notifications (checkbox), plan (two radio cards), one Save action, inline validation for an empty name."
2. **Data table.** "Build a page listing 8 worktrees with name, age, PR state and size; one row selected; include loading, empty and error states as separate sections."
3. **Docs landing page.** "Build a docs landing page for a library: title, one-line purpose, install command with Copy, three section links in a side rail, two prose sections."

## Arms and builds

| Variable | Value |
| --- | --- |
| Arms | Base guidance and head guidance |
| Fixed | Model, reasoning effort, harness, prompt, and capability settings |
| Attempts | 3 for each arm, probe, and build |
| Build A | Standalone page that imports `tokens.css` |
| Build B | Page on the library stack: `theme.css`, `graphite-indigo.css`, `components.css`, and `site.css` from a pinned `@filipgutica/ui` release |

## Objective scores

Each score is computed in Chromium before any judge sees the output.

| Score | Method | Better |
| --- | --- | --- |
| Undefined CSS variables | Every `var(--x)` in style sheets and style attributes with no computed value on `:root` | Fewer |
| Text contrast failures | WCAG 2.x ratio of each visible text node against its painted background, below 4.5:1 | Fewer |
| Horizontal overflow | `scrollWidth > clientWidth` at 390, 720, and 1280 px | None |
| Forced-colors focus | Emulate `forcedColors: 'active'`, press Tab through every stop, and record stops whose outline style is `none` | None |
| Distinct breakpoints | Count of distinct viewport `@media` widths in the style sheets and `<style>` blocks the agent wrote. Library style sheets are excluded, because they still carry 680 and 681 px rules until the ui follow-up below ships. | Only 640 and 800 |
| Distinct border colors and radii | Count of distinct computed `border-*-color` and `border-radius` values on visible elements | Fewer |
| Data-view states | The data-table probe shows loading, empty, and error states | All three present |

## Judges

Judges see blind side-by-side screenshots at 1280 px light and 390 px dark, in random order.
They rate consistency with `DESIGN.md` and with the library documentation.
Judge findings are diagnostics. They are not a quality score.

## Acceptance

The PR may merge only when the paid run shows all of these:

1. Head scores better than base on the objective checks, with no regression on any check.
2. Blind judges prefer head in at least 2 of 3 probes.
3. Every head probe uses only the 640 and 800 px breakpoints.
4. Every head data-table probe shows loading, empty, and error states.

## Dry-run result

PluginBench cannot run this protocol without new harness code, so no dry run was started.
No probe tasks exist for a dry run to admit. If they were added as Harbor tasks today, the run would produce no objective score.

| Requirement | PluginBench at `c6a6909` | Evidence |
| --- | --- | --- |
| A submission that can be measured | Only the four reviewed DeepSWE verifier trees produce a canonical submission. A local probe task gets `status: unsupported`, so nothing it builds is measured or reviewed. | `pluginbench/src/pluginbench/submissions.py:90-101`; `pluginbench/src/pluginbench/evaluation.py:230-239` and `:399-407` |
| Browser and CSS scores | Measurements are `tokens`, `lines`, `cyclomatic`, `cognitive`, `dead_code`, `coverage`, and `review`. None renders a page. The reviewer reads code, not screenshots. | `pluginbench/src/pluginbench/evaluation.py:52-54` |
| Host-config delivery | A treatment delivers guidance files as one private global `AGENTS.md`, up to 32,768 bytes. Real hosts read `~/design-language/DESIGN.md` beside `tokens.css` and the examples. The examples differ between arms, so they cannot sit in a shared task image. | `pluginbench/src/pluginbench/native_treatments.py:25`; `pluginbench/docs/running-evaluations.md`, "Native treatments" |
| Two guidance arms | PluginBench adds a vanilla arm automatically. It is an extra arm, not a blocker. | `pluginbench/src/pluginbench/evaluation.py:124-128` |
| Harness | Native treatment coding requires Codex. The design language also ships to Claude, which this study would not cover. | `pluginbench/src/pluginbench/native_treatments.py:65` |
| Probe tasks | No Harbor task exists for the three briefs or for the library-stack build. | None in `pluginbench/` |

## Smallest additions to PluginBench

Make these changes in PluginBench, not in filip-stack:

1. **Artifact submission contract.** Add a local task contract whose submission is a hash-bound copy of one output directory, such as `/app/site/`. Harbor admission requires a separate verifier (`pluginbench/src/pluginbench/harbor_backend.py:665-666`), so the task uses a collect-only verifier that copies `/app/site/` and grades nothing. The submission needs no patch reconstruction. `reviewed_contract` admits it next to the DeepSWE trees.
2. **Browser collector.** Add one `ui_audit` measurement that serves the submission directory and runs Playwright Chromium to record the objective scores above, plus screenshots at 1280 light and 390 dark. Base it on the audit's existing `verify.tmpl.js`, which already computes undefined variables, contrast, overflow, and forced-colors focus stops. Add a breakpoint and border count.
3. **Home-path treatment files.** Add a treatment field that copies a directory to a path under the attempt's private home, such as `home_files: {design-language: <dir>}`. Pair it with one guidance line that points to `~/design-language/DESIGN.md`, which is how hosts use it. A workaround is to ship the directory as a skill, but skill discovery changes how the agent finds the guidance, so that does not test host config.
4. **Three Harbor probe tasks.** Each task holds one brief, an empty `/app/site/`, and the pinned library CSS for build B. These are fixtures, not harness code.

Judges can run outside PluginBench from the saved screenshots, because their findings are diagnostics.

## Dependencies before the paid run

1. The PluginBench additions above.
2. A ui release that moves the library's 680 and 681 px rules to 640 and 641 px, so Build B renders with the same breakpoints the guidance names. The rules are in `src/components.css` (680) and `src/site.css` (680 and 681). The docs site's own `docs/src/styles.css` also uses 1000, 900, and 680 px.
3. Filip's approval of the paid run.

## Paid-run estimate

| Item | Count |
| --- | ---: |
| Coding attempts in the protocol: 3 attempts × 3 probes × 2 arms × 2 builds | 36 |
| Coding attempts with PluginBench's automatic vanilla arm: 3 × 3 × 3 × 2 | 54 |
| Judge calls: 18 base and head pairs × 3 judges (assumption) | 54 |

Dollar cost is an assumption until a dated `prices.json` is in place.
The estimate assumes the Codex runner at `gpt-6.1-sol` with high reasoning. The only cost anchor is earlier pytest repair attempts in the lab notebook (section 9), on an earlier model: about $0.10 to $0.13 nominal each, with 1.0 to 1.8 million input tokens. A small page build may cost less.
At that rate, 54 coding attempts cost about $5 to $7 nominal, and 36 cost about $4 to $5.
Screenshot judges add an unknown amount, assumed at no more than $0.10 each, about $5 or less.
