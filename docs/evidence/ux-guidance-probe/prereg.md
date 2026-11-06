# UX guidance probe: pre-registration

Status: plan and free dry run only. No paid call has run. The paid run needs Filip's approval (AGENTS.md, Evaluation).
Dry run: [dry-run-report.md](dry-run-report.md).

Prior art:

- [Reader pages probe](../reader-pages-probe/prereg.md): arms, blind pairs, the call ledger, and the report style.
- [Guide-body probe](../guide-body-probe/prereg.md): planted defects with a frozen key, and stop rules.
- [Design language probe](../design-language-probe/study-plan.md): browser checks of built pages.
- hill-climb: the [judge brief](../../../skills/hill-climb/SKILL.md#judge-brief) and [guidance climbs](../../../skills/hill-climb/references/guidance.md), for attempts, isolation, the answer-key tally, and the no-guidance baseline.

## Question

Does `interface-design` make agents do better UI work than the guidance it replaced, and better than no guidance?

- **Review:** do agents find more real defects in a screen, with fewer false findings?
- **Build:** do agents build a screen that passes the skill's own checks and that judges prefer?

Each attempt gets its guidance folder directly. So the probe measures what the guidance says, not whether a host picks the skill.

## Arms

| Arm | Guidance folder | Markdown words | Bundle sha256 |
| --- | --- | ---: | --- |
| vanilla | Empty | 0 | `e3b0c442…b855` (empty) |
| base | `ux-laws/SKILL.md` and `ux-laws/references/laws.md` at `94617e16` (`119c74ea^1`, the commit before PR #112 merged), and Anthropic's `frontend-design/SKILL.md` at [`41bbe19d1a1a`](https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design) | 2,441 | `88f344a4…a74d` |
| head | `interface-design/` at `48453586` (`origin/main`): `SKILL.md`, `references/` (4 files), and `scripts/` (2 files) | 3,180 | `47748d82…a7b9` |

- [`build_arms.py`](scorer/build_arms.py) builds the folders and a manifest of per-file hashes. It checks the `frontend-design` file against its sha256 (`d9197063…10c1d3`).
- Files are copied unchanged, with their relative paths, so links between a skill's files resolve inside the folder.
- Metadata files are left out: `agents/openai.yaml` and `THIRD_PARTY_NOTICES.md`.
- `laws.md` is byte-identical in base and head. The arms differ in `SKILL.md`, `craft.md` (adapted from `frontend-design`), `standards.md`, `checks.md`, and the scripts, against upstream `frontend-design`.

## Attempts

- Model: Claude Opus 5.5 (`claude-opus-5-5`), effort high, for every attempt in every arm.
- Every arm gets the same prompt apart from its guidance folder's random name ([`prompts.py`](scorer/prompts.py)).
- Tools: `Read`, `Edit`, `Write`, `Glob`, and `Grep`. No arm has a shell, a browser, or the network. So head's Check route and its scripts cannot run, the same as for every arm.

| Task | What the attempt does | Attempts per arm |
| --- | --- | ---: |
| R1–R3 | Reviews one static screen and lists defects | 5 per page, 15 in all |
| B1 | Builds one screen with real states in a fixture app | 3 |

## Isolation

User guidance reaches agents through several channels on this machine: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, user skills, plugins, hooks, and Field Guide. They point agents to `interface-design` and the design language, so any attempt that loads them contaminates vanilla and base. The reader pages probe recorded host guidance as a confound shared by every arm. This probe removes it.

### Attempts and Opus judges

[`run-claude.sh`](scorer/run-claude.sh) is the only command for Claude calls:

| Setting | What it removes or fixes |
| --- | --- |
| `env -i` with only `HOME`, `USER`, `LOGNAME`, `PATH`, `TMPDIR` | Environment variables from the parent session |
| `--safe-mode` | `CLAUDE.md` files, user skills, installed plugins, hooks, MCP servers, output styles, and custom agents |
| `--setting-sources ''`, `--strict-mcp-config`, `--disable-slash-commands` | User, project, and local settings; other MCP configuration; skills and commands |
| `--restricted` | File tools outside the working directory, which is the attempt's workspace |
| `--tools Read,Edit,Write,Glob,Grep` | Shell, web, subagent, and workflow tools |
| `--no-session-persistence` | Session files and auto-memory |
| `--model claude-opus-5-5 --effort high` | The registered model and effort |

- Each workspace is a randomly named folder under a scratch directory with no repository ancestor. It holds `task/` (review) or `app/` (build), and `g-<random>/`, the guidance folder. Vanilla's folder is empty.
- Only the private ledger maps a workspace to its arm. No path names an arm.
- The command finds the OAuth sign-in: the captured request carries an authorization header, so no API key is needed. Only a paid call can confirm the service accepts it; step 3 of the run protocol is that check.

### Codex judges

[`run-codex-judge.sh`](scorer/run-codex-judge.sh) runs Astra and Sol 6.1:

- `HOME` is an empty scratch folder, so `~/.agents/skills` and other user files do not load.
- `CODEX_HOME` is a scratch folder that holds only the login, so `~/.codex/AGENTS.md`, its config, rules, and skills do not load.
- `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, read-only sandbox, and `--disable` for apps, plugins, memories, hooks, browser use, and computer use.
- Screenshots are attached with `-i`, and text files are inline in the prompt. The dry run could not confirm that Codex file tools work in this setup without a paid call. No judge command is permitted; any tool execution invalidates the run.

### What still reaches every call

These are the same for every arm, and they hold no UI guidance:

- Claude Code's built-in system prompt, its built-in plugins (`cc-plugin-*@builtin`), and two harness reminders: the account email and the commit attribution note.
- Codex's base instructions and its four built-in system skills (`imagegen`, `openai-docs`, `skill-creator`, `skill-installer`).

### Proof

The free dry run must show, and did show:

1. For each task, the first request of each arm is identical once the random folder name, workspace name, and session IDs are normalized.
2. No user-guidance marker appears in a vanilla request. Markers: `interface-design`, `design-language`, `ux-laws`, `frontend-design`, `Field Guide`, `ctx7`, `WCAG`, and the others in `probe.py` `MARKERS`. The only hit is `DESIGN.md`, the fixture's own file named in the prompt.
3. A scripted read of `~/design-language/DESIGN.md`, `~/.claude/CLAUDE.md`, or `~/.agents` is refused, and a write outside the workspace is refused.
4. The validator tells the two outcomes of an outside call apart. A call that `--restricted` refused shows isolation working; it is counted per arm as a diagnostic. A call that succeeded is a breach. A planted run shows both, the second through a local copy of the command without `--restricted`.

In the paid run, `probe.py validate` checks every Claude trace for the tool set, empty skills and MCP servers, built-in plugins only, model, working directory, and every tool path. It rejects every Codex judge tool execution, including commands confined to the bundle, because all input is attached or inline. `validate` exits nonzero on any isolation problem. Any problem stops the run.

Head is the arm most likely to try an outside read, because its `SKILL.md` and `checks.md` name `~/design-language/DESIGN.md`. Those reads are refused, so they do not stop the run, and the report gives their count per arm.

## Review task (R1–R3)

### Pages

Three static screens of a fictional app, Acme, with its own design system: [`DESIGN.md`, `tokens.css`, and `app.css`](scorer/fixture/app/), the same files the build task uses.

| Page | Screen |
| --- | --- |
| R1 | Checkout payment form with an order summary and a coupon field |
| R2 | Team members table |
| R3 | Notification settings with switches and a saved message |

- Each page was built clean first. On every clean page, `ui-check.mjs` reports 0 axe nodes, 0 overflowing pages, and 0 off-token values at 320, 375, and 1280 px in light and dark.
- Then 9 defects were planted, 3 per page, drawn from these categories: low text contrast, missing visible focus, main action not the most prominent element, missing error state, off-token colour, overflow at 375 px, broken dark mode, motion that ignores reduced motion, and colour as the only signal.
- Each page also has 2 or 3 decoys. A decoy is a claim that looks like a defect but is false on this page, such as low contrast on text that measures above 7:1.
- `ui-check` reports evidence for 4 of the 9 planted defects. Three affect its exit status; off-token colour is diagnostic only. The other 5 need judgment.
- Each attempt gets the page's HTML, CSS, and JavaScript, the design system files, and three screenshots: desktop light, desktop dark, and a 375 px phone in light.

The pages, decoys, and answer key stay outside the repository, in the local hill-climb calibration folder for this study, `~/.hill-climb/calibration/ux-guidance-probe/`. Their sha256 hashes are frozen [below](#frozen-calibration-hashes). The attempts cannot read the repository, because `--restricted` confines them to their workspace.

### Sources for the categories

The categories paraphrase public standards. No text is copied from them.

| Category | Source |
| --- | --- |
| Low text contrast | [WCAG 2.2 SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum): 4.5:1 for normal text |
| Colour as the only signal | [WCAG 2.2 SC 1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color) |
| Overflow at 375 px | [WCAG 2.2 SC 1.4.10](https://www.w3.org/TR/WCAG22/#reflow): content reflows at 320 CSS px without scrolling in two directions |
| Missing visible focus | [WCAG 2.2 SC 2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible) |
| Motion that ignores reduced motion | [WCAG 2.2 SC 2.3.3](https://www.w3.org/TR/WCAG22/#animation-from-interactions) and the [`prefers-reduced-motion`](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion) media feature |
| Missing error state | [WCAG 2.2 SC 3.3.1](https://www.w3.org/TR/WCAG22/#error-identification); Nielsen's [heuristic 9](https://www.nngroup.com/articles/ten-usability-heuristics/) on recovering from errors |
| Main action not the most prominent | Apple's [Human Interface Guidelines on buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) advise giving the most likely action the most visual emphasis |
| Broken dark mode | The app's own design system supports both themes; WCAG 1.4.3 applies in each theme |
| Off-token colour | The app's own design system, `tokens.css` |

### Prompt

From [`prompts.py`](scorer/prompts.py) `REVIEW`. The attempt reads its guidance folder, then the task folder. It replies with one line per finding, most important first:

```
FINDING | <element: a CSS selector or the quoted visible text> | <the problem, in one sentence> | <the fix, in one sentence>
```

The prompt does not list the categories. That would turn the review into a checklist and shrink the difference the probe measures.

### Tally rule (frozen)

From the key's `rule` field, applied by `probe.py tally`:

1. A finding is one `FINDING` line. Only the first 12 lines count.
2. Each key entry has `where` and `what` patterns: case-insensitive regular expressions matched against separate fields: `where` against the element, `what` against the asserted problem. Fix text never earns credit.
3. A finding credits the first defect, in key order, that is not yet found and whose `where` and `what` both match.
4. Else, if it matches a defect already found, it is a duplicate and scores 0.
5. Else, if it matches a decoy, it is a false finding and scores −1.
6. Else it is unmatched and scores 0.
7. An attempt's tally is defects found minus false findings, from −12 to 3.
8. An arm's review score is its mean tally over its 15 attempts.

Before matching, each line loses its Markdown emphasis, code marks, list numbers, and quote and heading marks, and code-fence lines are skipped. A reply that is neither `NONE` nor has a `FINDING` line is unparsed. It counts as missing and stops the run.

A true finding that the key does not plant is unmatched, so it costs nothing. Before the key was frozen, the pages were checked for unplanted defects: the fixture's control borders were raised to 3:1 (WCAG 1.4.11), and one input was given the error state it lacked.

Diagnostics, reported but not in the rule:

- the tally at a cap of 5 findings
- findings per attempt
- unmatched findings and duplicates
- hits per category

The self-test (`probe.py selftest`) checks 25 fixed cases after the stated amendments below:

- 20 review answers: perfect, paraphrased, false-finding, near-miss, Markdown, and adversarial fix-leak answers for each page, one shared empty answer, and one prose reply with no `FINDING` line. A near miss names the right category on the wrong element, uses a key word in an unrelated complaint, or makes a false but plausible claim. The three adversarial answers must each score −1, not +1. Each answer must score exactly its expected tally; the prose reply must be unparsed.
- 5 judge replies: plain, Markdown, fenced, one with an unread file, and one with no `OVERALL` line. Each must parse to its expected votes and completeness.

## Build task (B1)

### Fixture

[`fixture/app/`](scorer/fixture/app/) is a stub Acme screen with a mock API and no answer key:

- `BRIEF.md`: build the API keys screen. List keys, create one with a field labelled `Key name` and a button labelled `Create key`, show the secret once, and let the user recover when `createKey` fails.
- `api.js`: `listKeys` and `createKey`. URL parameters select the scenario: `?keys=3` seeds three keys, and `?fail=create` makes `createKey` fail. `?fail=once` fails the first create and permits a successful retry. Secrets and created dates are deterministic.
- `DESIGN.md`, `tokens.css`, and `app.css`: the design system.
- `index.html`: the shell with an empty main area.

### Gates

The gates use `interface-design`'s unchanged scripts at frozen head `48453586`, run on each build (`probe.py gates`). The scorer waits for all three seeded names to become visible before populated `ui-check` scans:

| Gate | Command | Passes when |
| --- | --- | --- |
| `ui-check.mjs` | `?keys=0` and `?keys=3`; 320, 375, and 1280 px; light and dark; `--tokens` the fixture's frozen `tokens.css` | Exit 0: no axe WCAG 2.2 AA nodes and no sideways overflow |
| `ui-modes.mjs` | `?keys=0`, with [`ux-tasks.mjs`](scorer/ux-tasks.mjs) | 12 of 12 behavioral checks: 3 tasks in each of 4 modes. The scorer excludes all 4 overflow rows, including text-200; raw results remain diagnostic |

A build passes when `ui-check` exits 0 and all 12 counted `ui-modes` task checks pass. A runtime error in either runner fails the build. The three tasks are: an empty name triggers a current error tied to the field; creating a key visibly shows its secret and lists it; and a failed create visibly reports failure, keeps the name, and succeeds on a second submission. They use only what the brief fixes, and they accept any markup that meets it. Two reference builds with different markup both pass. One uses a readonly input for the secret, native validation, its own error text, and names inside longer text.

Diagnostics: the `ui-check` violation count, the `ui-modes` passed count, off-token values, and any fixture file the build changed.

### Judges

[`capture-states.mjs`](scorer/capture-states.mjs) screenshots 5 states in 3 views for every build:

- States: empty, validation error, server error, success, and populated.
- Views: 1280 px light, 375 px light, and 375 px dark.

`probe.py bundle` writes one blind bundle per pair, as hill-climb's Bundle section describes. Each bundle goes in its own randomly named folder outside the run folder, so no judge can reach the ledgers or the workspaces:

- `criteria.md` holds C1 Task, C2 States, C3 Access, and C4 Fit.
- `tasks/` holds the brief and the design system.
- `A/` and `B/` hold the screenshots that differ, with matching names.
- `A-files/` and `B-files/` hold each version's copy of the app files that differ.
- The A/B order is balanced, so head is A in half the pairs.
- Comments are stripped from every arm's HTML, CSS, and JavaScript alike. Marker words are counted before stripping and again after. Any residual marker stops bundling before judge prompts or commands are produced, including markers in identical files. No output is edited by hand.

Pairs: head against base, and head against vanilla, for each attempt number.

Each judge gets the [hill-climb judge brief](../../../skills/hill-climb/SKILL.md#judge-brief) with its UI, fresh-start, and scorecard lines (`prompts.py` `JUDGE`):

| Judge | Model | Command |
| --- | --- | --- |
| Opus 5.5 | `claude-opus-5-5`, effort high | `run-claude.sh`, tools `Read,Glob,Grep`, in the bundle folder |
| Astra | `gpt-6-astra`, reasoning high, default tier | `run-codex-judge.sh` |
| Sol 6.1 | `gpt-6.1-sol`, reasoning high, default tier | `run-codex-judge.sh` |

- A judge completes when its reply has an `OVERALL` line and `UNREAD: none`. A pair with fewer than two completed judges is void.
- Votes and scorecards map back to arms through the private judge ledger.
- The judges are uncalibrated, as AGENTS.md notes for reviewer findings. The guide-body probe calibrated its judges; this one does not.

## Decision rule (fixed before any paid call)

`interface-design` is **supported** only if every part holds against base and against vanilla:

| Part | Holds when |
| --- | --- |
| 1. Review gain and no harm | Head minus the control is at least 0.5, or at least 0 when that control scores 2.5 or more |
| 2. Gates, success and no harm | Head passes at least 2 of 3 builds and at least as many as each control |
| 3. Judges | A strict majority of completed `OVERALL` votes in non-void pairs prefers head. `SAME` counts for neither. |

- **Saturation:** waive only positive gain against a control whose review score is 2.5 or more. Head must still match or exceed both controls. The verdict names the waiver; it never omits review no-harm or build success.
- **Not decidable:** more than a third of the pairs are void, or an arm has fewer than 10 of its 15 review attempts scored.
- When a judge majority rests on Astra and Sol, which are both OpenAI models, the report says so, as hill-climb asks.

Expected mechanisms, named in advance:

- Base's `frontend-design` asks for a new palette and typefaces for each brief. Head defers the look to the owning design system. So C4 and the token scan should favour head by design.
- Head's review route answers standards questions that name contrast, focus, reflow, and motion. If head wins the review, those questions are the likely cause.

## Run protocol

1. Build the arms and check them against the hashes below. Install Playwright and `@axe-core/playwright` in a scratch folder, not the repository.
2. `probe.py prepare` with 5 review attempts and 3 build attempts. The three arms of each task and attempt number run next to each other, in random order.
3. Run R1 attempt 1 for all three arms. Then run `validate` and `tally`. Continue only if `validate` reports no problem and `tally` reports no unparsed reply. These first calls also confirm that the Claude sign-in works.
4. Run the remaining attempts. No more than 4 calls at once.
5. Run `gates` and `bundle`. Run the first Codex judge alone. Continue only if it completes and its trace, read by hand, shows the event format `validate` expects, no command, and nothing loaded from the login. Then run the other judges.
6. Run `score`.

Stop rules:

- Stop at the first call that breaches isolation, or that returns a review reply `tally` marks unparsed or a judge reply that does not complete. The narrow reader-pages runner checked only that a reply existed.
- No retries without Filip's approval. A failed or timed-out call is missing.
- Timeouts: 15 minutes for a review attempt, 45 minutes for a build, and 20 minutes for a judge. The Claude CLI has no turn limit.
- Hard ceiling: 72 calls.

Prerequisites, none done by this PR:

- Filip's approval of the paid run.
- A Codex login in the scratch Codex home, made by Filip with `CODEX_HOME=<scratch-codex-home> codex login`. This PR does not copy credentials.
- The gates and screenshots run Chromium, which needs to run outside the agent's sandbox.

## Cost

| Item | vanilla | base | head | Total |
| --- | ---: | ---: | ---: | ---: |
| Review attempts: 3 pages × 5 | 15 | 15 | 15 | 45 |
| Build attempts | 3 | 3 | 3 | 9 |
| **Attempts** | **18** | **18** | **18** | **54** |
| Judges, head vs base: 3 pairs × 3 judges | | | | 9 |
| Judges, head vs vanilla: 3 pairs × 3 judges | | | | 9 |
| **Total** | | | | **72** |

By model: Opus 5.5 makes 60 calls (54 attempts and 6 judges), Astra 6, and Sol 6.1 6. The gates, screenshots, tally, and scoring make no model calls. Tokens are not measured; the dry run's mock reports none. [The dry-run report](dry-run-report.md#paid-run-budget) gives request sizes.

## Limitations

- Five review attempts and three builds per arm give a bounded result. The design-language probe found no support at 3 attempts.
- The tally matches text patterns. A correct finding in unusual words can go unmatched. The self-test covers paraphrases, but not every wording.
- Planted defects in hand-built pages may be easier or harder to find than real ones.
- One model builds and reviews. Results may not carry over to Codex or Sonnet.
- No arm can run a browser, so the probe does not measure head's Check route.
- Routing is not tested. `interface-design` is a standalone skill, so `pnpm eval:routing`, which compares Workflow skills, does not apply.

## Stated changes since the original freeze

These amendments follow review of `a070ca6`, before any paid call. The guidance bundles, review pages, decoys, prompts, matched task counts, and 72-call ceiling stay fixed.

| Finding | Amendment and reason |
| --- | --- |
| S1 | Match element and problem separately; ignore fixes. Tighten D6 to an asserted token/palette problem rather than bare colour descriptors. Add three local adversarial false findings that each changed from +1 to −1. Remove two duplicate `NONE` cases; retain R1's shared parser case. Update the key's rule text and local hashes. |
| S2 | Saturation waives only positive gain against the saturated control. Retain no-harm against both controls and require at least two successful head builds. |
| S3 | Reject every Codex judge tool event and exit validation nonzero. Attached and inline inputs require no command execution. |
| S4 | Stop bundling on residual guidance markers, including identical files; remove stale judge commands and ledger before a rerun. |
| S5 | Freeze fixture secrets and created dates, and fix the screenshot clock to 2026-11-06T12:00:00Z. |
| S6 | Require current visible errors, visible secrets and list entries, and a successful second submission after `?fail=once`. Keep gate calibration pages local. |
| S7 | Add a scorer-side navigation adapter that waits for all seeded names before the unchanged `ui-check` captures and scans. |
| S8 | Drop all `ui-modes` overflow counting. `ui-check` owns ordinary reflow; no per-defect evidence establishes a distinct mode-specific overflow risk. Text-200 overflow is therefore diagnostic too. Behavioral tasks still run in all four modes. |
| S9 | Replace the PR's repeated CI results with free, runnable self-test, hash verification, and local browser calibration steps. |

No skill, skill script, or arm hash changed. The scorer adds owner-boundary regressions for verdicts, judge isolation, and bundle blindness. See the [coverage record](dry-run-report.md#coverage-record) for tests added and removed, baseline failures, and remaining proof.

## Frozen hashes

### Scorer

The scorer files are refrozen after the review amendments listed above. The original freeze was `a070ca6`; no paid call intervened. Their sha256 hashes:

```
f64da8002042e4417f080616f7c98c39b16a4c243358724fe9fdfcb17301c161  build_arms.py
5ae7b0946641b37f4c366f41098913e01030a4a24a87c060aa6f84a5b7fd8d44  calibrate.mjs
d9de1cf362781501006248a40c8ee9363df0c2fa0b886abca6464046ce533ffd  capture-states.mjs
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  fixture/app/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  fixture/app/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  fixture/app/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  fixture/app/app.css
ce4e0b3111db4c94ed192d2f86269169331b0f8c972c8a6bbf8734f2880b9cdd  fixture/app/index.html
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  fixture/app/tokens.css
3c30f82e3e029e299bcaac169213b29eba911cda6fabc205252aa3582bfbc986  listen.mjs
bc07d68792f01122f4b69788e7ceadce501ba7938edae9f03c23c6a2d112cfbb  mock.mjs
ac767db716eb25772c875137a48c098632bb0d5ea1407b00cea30daa0813937d  probe.py
f98c453b1b00d22aca76c4dfd634a450b6c1366c636a97d72cd1716a98efe5f7  prompts.py
363fe49a9627e887cac9773b11dcf116d8d464bb85f72bcb5b9f96f36f034f55  ready-check.mjs
5b100539db1be64cee47fa33f3ee071940fd7c97a5aefdaca6a91f1a029c08a4  run-claude.sh
275bb57a20944a9bf540ef96c602f54b506d4bb0eb537dc8be989ec011bdf590  run-codex-judge.sh
df251d95b057aeeeec5d2404fce6de8c7038aa4243bbdb8800f258204bfbcd59  scorer_test.py
38fdfed24d8b0dfb78d7ec7dbdb0b02319fb08e35d22fd0bd68836549c5a51be  serve.mjs
29eaa7cfd348bba9e410178c85ba1d94d6f6d38460dca7c24a57658fec691b13  ux-tasks.mjs
```

### Arms

```
d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3  base/frontend-design/SKILL.md
a64872edb8a167fcf4176a1f3a813384d747ad7325c39fc4576c450e6904b7d4  base/ux-laws/SKILL.md
fe66c5395c4449bcea02411653b3efef04ff3e49e0b67f67b15aa9010dcea691  base/ux-laws/references/laws.md
b0aba6538b6acf5f6320e4b5da83d9c1adbdf3b1c574bd0ba77c47c9a0c3b9b5  head/interface-design/SKILL.md
627a4a361e555aadd9db94f7d3540d6d8f60b0b43d9830778441211d84b9f0c8  head/interface-design/references/checks.md
c441266697fba538fe050e89d25f7a0a53689b508851e40e4087f6699591f96a  head/interface-design/references/craft.md
fe66c5395c4449bcea02411653b3efef04ff3e49e0b67f67b15aa9010dcea691  head/interface-design/references/laws.md
29e12474cbd8944c2f8b23a5ee3f6e67707e657360aaa57cda230835a5f21cfe  head/interface-design/references/standards.md
7d8c93a1d233cd309157cba0acf5b1813231099ca33f9ef8eda4a50a312d8633  head/interface-design/scripts/ui-check.mjs
4ec133944b729f9077d7e4c97c6c3b62debf6addac617f3e9667845c97a018ed  head/interface-design/scripts/ui-modes.mjs
```

Bundle hashes: base `88f344a4a02d80f8fa9ff37264297eb45f23aaa5a1740c4b96c1d6f0c504a74d`, head `47748d82e8afa59c661383e10426402158ecdf1ed0b2f307d87cabd1d8a847b9`.

### Frozen calibration hashes

The 122 files in the local calibration folder. The sha256 of this list, including its final newline, is `fa18f02f440a49f4fdbf08adb72b28c73d96af3299422903d4f6e2c81774132e`. Only hashes are committed.

```
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/bad-error/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/bad-error/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/bad-error/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/bad-error/app.css
0ed97ba5d81e450af895892d50ba5ed525c74be7ec5a526bfc496f0ecb93dca8  build/bad-error/index.html
1653d402e34002ca074198ddc15e9e2d482205a29af6aa258fea04a1bdb992db  build/bad-error/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/bad-error/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/delayed-overflow/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/delayed-overflow/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/delayed-overflow/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/delayed-overflow/app.css
33e4e97594ac9dba2d5a45d5bbec83fe4371b491a44de89f512562c95260b652  build/delayed-overflow/index.html
7a7cbd7a655c2c08b0b17f12d689f5be69979f9069c441aa6da0c627ca55d45d  build/delayed-overflow/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/delayed-overflow/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/hidden-list/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/hidden-list/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/hidden-list/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/hidden-list/app.css
33e4e97594ac9dba2d5a45d5bbec83fe4371b491a44de89f512562c95260b652  build/hidden-list/index.html
feef38fa787cc6925984af4f2b7561285e081d6fe6e15b3680f55fd1f857a37b  build/hidden-list/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/hidden-list/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/hidden-secret/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/hidden-secret/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/hidden-secret/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/hidden-secret/app.css
33e4e97594ac9dba2d5a45d5bbec83fe4371b491a44de89f512562c95260b652  build/hidden-secret/index.html
163788e807c4b2bf372c6f4aa3c5753d54c95dd4d3220ffccaa048076ec7553d  build/hidden-secret/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/hidden-secret/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/no-retry/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/no-retry/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/no-retry/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/no-retry/app.css
33e4e97594ac9dba2d5a45d5bbec83fe4371b491a44de89f512562c95260b652  build/no-retry/index.html
f67b1959ec568c11ca9488acfb485959c3618b59611f344dda728179fca61d24  build/no-retry/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/no-retry/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/reference1/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/reference1/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/reference1/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/reference1/app.css
33e4e97594ac9dba2d5a45d5bbec83fe4371b491a44de89f512562c95260b652  build/reference1/index.html
9a6a47da555930c19c6546095510d743b5daac36a09a85c7a2916c32b64cc7ba  build/reference1/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/reference1/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/reference2/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/reference2/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/reference2/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/reference2/app.css
a628aea4e8832d727cbaae0193281f461b7c692a233906b81f3fde37eb033740  build/reference2/index.html
d65dcbada85749c2b2d7669a87870f5d3cb0af28ad3aff445d08d642095923bb  build/reference2/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/reference2/tokens.css
fc5b2bd212b0aa8f44b30ddcf7f7599789b7794b0b9e09a0f30d1b1a254ba38b  build/stale-alert/BRIEF.md
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  build/stale-alert/DESIGN.md
6dee7f62e00c57ae75242ee9f8de3227b76bf0cd3c2633d16053d1841f9272cb  build/stale-alert/api.js
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  build/stale-alert/app.css
2bb2aff083f2e7b8d55af48a2974865047d3599ce7da40e6a0ee8fd5b3436fda  build/stale-alert/index.html
c217c0507b0f2bab1f08e30ef9e9d02ddc848dc388ab4c750fbc9895a06a92a9  build/stale-alert/screen.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  build/stale-alert/tokens.css
13593f36396cbde8b79e92c33d6cf44cfe8df13159d864443bf46ee4069cb6e7  build-cases.json
9ce9cf45bedb4ac8a4ab13f2da3e1972f5fad755202abcec719b69c83b01fd6f  key.json
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R1/clean/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R1/clean/app.css
7ad665d75c3042f3bae5bd72186a05aacd9b8530e5dbc599544c9eeee44238e7  review/R1/clean/page.css
232865a00df189b2b4085937a9274fdfcba7f44953f4cd0d7dfddb2fd812b366  review/R1/clean/page.html
9f14e884201260b2495aae31c74dbf0e5e5b0015b08d9ad6ca8de82928a54991  review/R1/clean/page.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R1/clean/tokens.css
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R1/planted/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R1/planted/app.css
9d8e8c890069a48327f4defcd2e4e13d57d89c1960be158ac174f76275b456fb  review/R1/planted/page.css
f412a39cfd687c9eeb1ea01cd38cb9ab9a23aa0d0ed39e1d2ac876391cf836b4  review/R1/planted/page.html
818c90d26cf374d79b60128ae0fd91c61c33543a8a67f15ed0437af02f1a2110  review/R1/planted/page.js
b79183915f0cc4ec0d4a46a0437338316bd24fd555875a22825ba243575ec91b  review/R1/planted/shots/desktop-dark.png
7652f334f66c8840708f13b02ee3d86885578bc668aa76af07817cfb96fcf33e  review/R1/planted/shots/desktop-light.png
1395fc966356cb9c73dd3eba235f8a7e7c0fac771a24af6a00859a54b352e230  review/R1/planted/shots/phone-375-light.png
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R1/planted/tokens.css
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R2/clean/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R2/clean/app.css
2dc1930a010af814a5c661e9aa0712b837bc9a45d0deb8816543f850b4596564  review/R2/clean/page.css
81e40d10b1385a4e2061295fa68c218d35016ef8f461ca6b043d77bd6e70a5d0  review/R2/clean/page.html
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R2/clean/tokens.css
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R2/planted/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R2/planted/app.css
ed68a01fb11cb90532c186c33340416fd4f1ad302947b0572dd7cf8dac0b55f3  review/R2/planted/page.css
5e1267776bd0583be01c53b7f2f03c76e516ab69b49549ed435d21b8be92c79c  review/R2/planted/page.html
4f57d5edfe4fc0c642122e87751464b104f9f8de338a3fda89bed3e41f983dfd  review/R2/planted/shots/desktop-dark.png
62e945b2d4e5c89c0ccf661fe9f1da413489c5b3ffe2addbfc989dcac2be8e44  review/R2/planted/shots/desktop-light.png
e6644f4cfa8f37d9ecc9e58920053c4042d02765cb20667503fd36f53f23102a  review/R2/planted/shots/phone-375-light.png
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R2/planted/tokens.css
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R3/clean/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R3/clean/app.css
ae188b4872261de5cb75db4efaf3937d4cc9eba2f2bc5ac395867139d57803c3  review/R3/clean/page.css
8dfd853fb3c7faf235529af0a3b182ce3fabcc8d3cbc554cf5e9d3f0bf960b9a  review/R3/clean/page.html
d2bc515b6bcacff4f81201bcae5057aa7551d08c55edd291c198b1eeda4c82f3  review/R3/clean/page.js
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R3/clean/tokens.css
1fd1d6c9fd24e97f036c0d31646de0124ad93bb1a9a8a46226c5b17cce20593d  review/R3/planted/DESIGN.md
f184eeb57368be735ceeebd1c8729067627938e519277ed8cba05f01f84f9f53  review/R3/planted/app.css
3aa65ab58c146f0f0ed587936d063dac540586df201064b1ab335ace6c06b9a9  review/R3/planted/page.css
8dfd853fb3c7faf235529af0a3b182ce3fabcc8d3cbc554cf5e9d3f0bf960b9a  review/R3/planted/page.html
d2bc515b6bcacff4f81201bcae5057aa7551d08c55edd291c198b1eeda4c82f3  review/R3/planted/page.js
64d80f74194b72019c8d5ebd30954e16669a114aad7f04f940b7f15917476fe9  review/R3/planted/shots/desktop-dark.png
b31c36e3bd00e94c2dd5a8feb69ebbf12f3c217d369a03f0d263fb486d489c28  review/R3/planted/shots/desktop-light.png
e3e0971d5490e01b0d18349239658b6674e16f545ff86310161ad5f9ce08c490  review/R3/planted/shots/phone-375-light.png
1a6fb6f0b73ef445925f883f0e978af25bca954bd996f93d561a79ba7589052b  review/R3/planted/tokens.css
77f8a5de4dc321df7dad23af4c9d8bb40d4bc1d839009d4ce23abe040c8bf9f1  selftest/R1-decoy.txt
51cfd463b6af8a57b3380487f986abf10f137073e9be453e44a7e9a5b4c0e72b  selftest/R1-empty.txt
8491a050bfbe246075ce2b9ffaf7ad3dea2c21eb74f41b0d40891f5e3a4ccb63  selftest/R1-fix-leak.txt
9f402418402b6e22952df99ddeb5d7c97e54dad58af86fb131abe11c80d20506  selftest/R1-markdown.txt
1ffb79b5793f7d01c39a4c2aa3a68ed4e5ce847ccdfdf630ce63abe5055114d0  selftest/R1-nearmiss.txt
76a31595a47e147ddfb20f658a56e74aa25724e6eb8e4eaf96104f620611e9fb  selftest/R1-paraphrase.txt
296ef28505ff07bd2a8bbfafbc650aa9ccc582d5419de9cc4f655606894fca46  selftest/R1-perfect.txt
1a942bf013388e01ad7c3ded068c3fedcebf4398e14194ad379a79405f77c9b6  selftest/R2-decoy.txt
39ab9bafa34265f7a09b51eee8a496c1996a1ef4b52e40e9ca707d2367a58fbc  selftest/R2-fix-leak.txt
10dc058eb6f5a9d678242c9811fbcb07ecce1c5bc56805d56f822a5145ac4fdf  selftest/R2-markdown.txt
a669e0f186b242ae1e3bc8c334b4af5663dd594e3c99c6f016420485cf2b9837  selftest/R2-nearmiss.txt
bd3a1d15f0d436522c28526ae5d7d09c37c4964dc5e6959d9c87dfff667c411b  selftest/R2-paraphrase.txt
7e56fbde7e549a979e401b39e28583455f6e57fb804385ce7071b77201ff44f2  selftest/R2-perfect.txt
bde5c2375817627c6a3bfbcae5bc6d8a6ad3d1e5b5833c4e6bcc3237f318ada7  selftest/R3-decoy.txt
7ef55d68f08ed614c6799f69e57fb4e4aa733e980ce13530ed3d1f17434a82d4  selftest/R3-fix-leak.txt
e0e7ec0c34727b235a11f561e280dc43ee2c7ab3539c25bf21e20639cb8f0bea  selftest/R3-markdown.txt
179d8ad9563699c68680455213434630c48a6008a5bd834d3342dd3d1e8dd68a  selftest/R3-nearmiss.txt
b6b492339ed39c5a13147d9fedc020ba0f48c586457edd7f490a6701c16cb343  selftest/R3-paraphrase.txt
1e75c941ee38d1b886b6133564e76f40b82826eea59de8e7249a8b1e044fed58  selftest/R3-perfect.txt
8525c6866e10277f7ebcf05181609537ad37155bd4dab86a28feb7d92b16afc1  selftest/R3-prose.txt
df830839992d45ac9f45f7cf5080a9ceb07704b6b4c1311738e4105a0216ee11  selftest/expected.json
```
