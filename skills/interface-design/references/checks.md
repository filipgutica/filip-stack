# Checks

Two scripts check a running UI in a real browser, so they work for any
framework. Both live in this skill's `scripts/` directory.

## Before you run

- Start the app and note the URL of each screen in scope.
- The target project needs `playwright` or `@playwright/test`, and
  `ui-check.mjs` also needs `@axe-core/playwright`. The scripts load them from
  `--project` (default: the current directory). When either is missing, the
  script exits 2 and names the package; add it to the project's dev
  dependencies with its package manager, or report the check as not run.
- A page that answers with an HTTP error also exits 2, so an error page is
  never checked as a pass.

## `ui-check.mjs`: accessibility, reflow, and tokens

```sh
node <skill-directory>/scripts/ui-check.mjs --url http://localhost:5173/settings \
  --widths 320,375,1280 --themes light,dark --tokens src/tokens.css
```

For each URL, width, and theme it loads a fresh page and:

- saves a full-page screenshot;
- runs axe-core with the WCAG 2.0 to 2.2 A and AA rules;
- checks that the page does not scroll sideways;
- with `--tokens`, lists computed colors, font sizes, radii, and padding or
  gaps that match no custom property in that CSS file. Aliases such as
  `var(--space-2)` resolve through the page, and `em` values resolve per
  element. Point it at the project's own token file, else
  `~/design-system/tokens.css`.

Options: `--theme-attr <attribute>` for apps that switch themes with an
attribute on `<html>` instead of `prefers-color-scheme`; `--fail-on-tokens`
to make off-token values fail the run; `--out <dir>` for the results.

It writes `results.json` and the screenshots, prints what it did not check,
and prints the violation count (axe nodes plus pages that overflow) as its
last line. It exits 1 when axe or overflow finds a problem.

## `ui-modes.mjs`: tasks in every accessibility mode

```sh
node <skill-directory>/scripts/ui-modes.mjs --url http://localhost:5173/settings \
  --tasks tests/ux-tasks.mjs
```

It loads each URL at 375px in four modes: reduced motion, dark, 200% text,
and grayscale. Each mode applies to every page the browser loads, so it
holds when a task follows a link. The script confirms the mode before the
screenshot and after each task; when the page removes it, the run exits 2
or the task fails. Pass `--theme-attr` for apps that switch
themes with an attribute. In each mode it saves a screenshot, checks for
sideways scrolling, and runs every task from a fresh load of the URL.

A tasks module default-exports `[{ name, run: async (page) => {} }]`, using
the Playwright `page` API; a task fails when `run` throws. A module without
that default export exits 2. Write two or three tasks that a real user must
complete on these screens.

A version passes only when every task passes in every mode. The script
prints the passed count as its last line and exits 1 on any failure. Without
`--tasks`, it still captures each mode for review.

## Reading the results

- A clean run is not proof of accessibility. axe-core covers about half of
  issues; `ui-check.mjs` prints the rest as not checked, such as non-text
  contrast, target size, and keyboard paths. Cover those with the review
  questions in `standards.md`.
- The 200% text mode doubles the page's root font size. Text sized in `px`
  does not grow, which is itself a finding.
- The token scan matches values, not intent: a value that matches the wrong
  token passes, and tokens built from `calc()`, `clamp()`, or percentages may
  appear as off-token. Treat its list as places to look.
- For a hill climb, use the exit code as a gate and the last output line as a
  score: lower is better for `ui-check.mjs`, higher for `ui-modes.mjs`.
