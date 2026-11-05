---
name: cli-tool-template
description: Shared stack and consistency checklist for Filip's personal CLI tools (annoterm, wtree, devps) published through filipgutica/homebrew-tap. Use when creating a new CLI tool, adding a tool to the tap, or aligning an existing tool's repo, CI, release, or formula setup.
---

# Personal CLI tool template

Every tool is one repo at `~/code/<tool>` and `github.com/filipgutica/<tool>`, released by release-please and installed with `brew install filipgutica/tap/<tool>`. The tools are _consistent_ when each item below holds. Language, CI steps, and README body vary by tool.

## Stack

**Releases use release-please on every tool.** Merged PRs accumulate in a release PR, and merging that release PR tags and publishes the version. That gives one review point before each release. semantic-release is not used: it publishes on every merge, with no release PR.

Pick the language by what the tool needs, then follow that row. The reference tool in each row is the live implementation to copy from.

| Language | Pick when | Reference | Build and CI | release-please `release-type` (version source) | Formula |
| --- | --- | --- | --- | --- | --- |
| Rust | Interactive TUI, speed, or a native macOS bundle | annoterm | `rust-toolchain.toml` pin; `cargo fmt --check`, `clippy -D warnings`, `test --locked` | `rust` (`Cargo.toml`) | `depends_on "rust" => :build`; `cargo install *std_cargo_args` |
| TypeScript on Node | Git, GitHub, process, or JSON-heavy logic that wants npm packages and types | wtree, devps | npm with `package-lock.json`; `npm ci`, `typecheck`, `test`, `build`; Node 22 | `node` (`package.json`) | `depends_on "node"`; `npm ci`, `npm run build`, `npm install *std_npm_args` |

## Repo contract

- **Files:** `README.md`, MIT `LICENSE`, `.gitignore`, `.github/workflows/{ci,pr-title,release}.yml`, `release-please-config.json`, `.release-please-manifest.json`. release-please writes `CHANGELOG.md`.
- **Workflows:** copy `templates/release.yml` and `templates/pr-title.yml` byte for byte. `ci.yml` is per language. It runs the tool's tests on `macos-latest`, adds `ubuntu-latest` when the tool supports Linux, and asserts that `--version` matches the manifest version.
- **Release config:** start from `templates/release-please-config.json`. Set `release-type` to `rust` or `node`.
- **CLI surface:** `<tool> --version` and `<tool> --help`, with a one-line usage per command.
- **README sections, in order:** one-line summary and a sample output, Install (the brew command), Use, how it works and safety rules, Development (local check commands), Releases (one line pointing to Conventional PR titles).
- **Repo settings:** these are not copied with the files. Set them on every new repo:

  ```sh
  gh repo edit filipgutica/<tool> --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false
  gh api -X PATCH repos/filipgutica/<tool> -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY
  gh api -X PUT repos/filipgutica/<tool>/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true
  ```

  The last command lets release-please open its release PR. Without it, the Release workflow fails with "GitHub Actions is not permitted to create or approve pull requests". The release PR gets no CI run, because PRs opened by `GITHUB_TOKEN` do not trigger workflows.

## Pages site

Each tool has one page at `https://filipgutica.github.io/<tool>/`. Start from a sibling tool's `docs/site/`, then replace its content, captures, links, and tests with the new tool's. Keep the page's look in `@filipgutica/ui`, not in the site.

- **Stack:** Astro with Vue in `docs/site/`, with its own `package.json` and `package-lock.json`. Copy `astro.config.mjs` and `tsconfig.json` byte for byte, changing only the tool name. Pin `@filipgutica/ui` to its latest release.
- **Frame:** wrap the page in the library's `.fg-site-docs` shell, with `UiSiteHeader`, `UiSiteNav` (`label="On this page"`), and `.fg-site-footer`. Use `UiCapture` for terminal output, `.fg-site-legend` for what the screen shows, and `.fg-site-definitions` for notes. `src/styles/site.css` keeps the sibling's `@layer` and `@import` header unchanged, then holds only page-specific rules. The library owns the frame, rail, footer, base type, `kbd`, and the terminal palette.
- **Sections, in order:** intro (H1 that says what the tool does; a lede that says what the tool is, in the README's words, and when you would reach for it; the install command; the facts row), the capture, Commands, Keys, then tool-specific sections, and Good to know last. Define any term the page relies on, such as a devps *job*, in the intro. Write the copy in full sentences. Facts are plain text, not badges. Good to know terms are noun phrases, and their definitions are full sentences.
- **Links:** the header links to GitHub and Releases, and a "Full reference" link to the README closes the page. The footer links to the author, the Homebrew tap, issues, and Releases. Do not add a "Guide" link: the page is the guide.
- **CI:** copy `site-ci.yml` and `pages.yml` byte for byte, changing only the tool name. `pages.yml` deploys `main`. Both use Node 22 in `docs/site`. Site CI runs `npm ci`, `npm run check` (`astro check` and `vue-tsc`), `npm run build`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`. The Playwright tests cover phone and desktop widths and a no-JavaScript render.

## Versioning

- The squash commit is the PR title plus the PR body. release-please reads only that: `fix:` bumps patch, `feat:` bumps minor, and `!` in the title or a `BREAKING CHANGE:` footer in the body bumps major. Breaking markers inside the PR's own commits are lost when the PR is squashed.
- Before 1.0, a breaking change goes to 1.0.0, because both `bump-*-pre-major` options are `false`.
- Tags are `vX.Y.Z`. First release: set the manifest to `0.1.0`, push the `v0.1.0` tag, and run `gh release create v0.1.0`. release-please takes over from there.

## Homebrew tap

The tap is `~/code/homebrew-tap`. Change it only through a PR, never by pushing to `main`.

A tool reaches users in this order: its release PR merges and tags `vX.Y.Z`; the tap's **Update formulae** workflow (every 6 hours, or run by hand) hashes the new archive and opens a formula PR; merging that PR ships `brew upgrade <tool>`. Adding a new tool:

1. Add `Formula/<tool>.rb`, modelled on the reference tool's formula from the Stack table. The `url` is the tag archive, which lets Homebrew infer the version, so leave out `version`. The `test do` block checks `--version` and runs one real command.
2. Hash the archive with `gh release download vX.Y.Z -R filipgutica/<tool> --archive=tar.gz` and then `shasum -a 256`.
3. Add the tool to `TOOLS` in `scripts/update-formulae.py`, to the bot PR text in `update-formulae.yml`, to the README install and check lists, and to `.github/workflows/tests.yml`. Guard a macOS-only tool with `if: runner.os == 'macOS'`.
4. **Done:** `brew audit --strict filipgutica/tap/<tool>` is clean, and `brew install --build-from-source` and `brew test` pass locally and in tap CI.

For a local test before merge, copy the formula into `$(brew --repo filipgutica/tap)/Formula/`, test it, and delete the copy. Leave `HOMEBREW_NO_INSTALL_FROM_API` unset, because it clones all of homebrew-core. Afterwards, run `brew developer off`, because `brew audit` turns developer mode on.

## Aligning an existing tool

Compare the tool against every item in the repo contract, the repo settings, the Pages site, and its formula. **Done:** each item matches or is recorded as an intended per-language difference. Open one PR per repo for the gaps.

## Gotchas

- Hosted macOS runners hide sockets from unprivileged `lsof`. Run socket tests with `sudo --preserve-env=PATH`.
