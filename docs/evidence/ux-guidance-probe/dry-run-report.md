# UX guidance probe: dry run

Date: 2026-11-06

Status: free dry run complete. **No paid model call ran.** The paid run needs Filip's approval; see [Stop point](#stop-point).

The dry run used the exact commands the paid run will use, with one change: the model endpoint pointed at a local program instead of a model.

- Claude calls went to a scripted stand-in, [`mock.mjs`](scorer/mock.mjs). It saves each request and answers with fixed tool calls and replies, so every step after the model runs for real.
- Codex calls went to a listener, [`listen.mjs`](scorer/listen.mjs). It saves each request and refuses it.
- Raw requests, traces, workspaces, and screenshots stay on the local machine, as for earlier probes.

## Result

Every check the brief asked for passed:

| Check | Result |
| --- | --- |
| Arms build, with hashes | Pass. Vanilla is empty, base has 3 files and 2,441 words, and head has 7 files and 3,180 words. The bundle hashes are stable. |
| Isolation, per arm | Pass. For each task, the first request is identical across vanilla, base, and head, and it holds no user guidance. Guidance appears only after an attempt reads its own folder. |
| Confinement | Pass. Scripted reads of `~/design-language/DESIGN.md`, `~/.claude/CLAUDE.md`, and `~/.agents` are refused, and so is a write outside the workspace. The validator counts refused calls as a diagnostic and flags calls that succeed as a breach. |
| Scorer self-test | Pass, 24 of 24. A perfect answer scores 3, an empty answer 0, and each false finding −1. Markdown-formatted replies parse, and a reply with no `FINDING` line is marked unparsed. |
| Gates on the fixture | Pass. Two reference builds pass `ui-check.mjs` (0 violations) and `ui-modes.mjs` (16 of 16). The bare stub fails `ui-modes.mjs` (4 of 16). |
| Pipeline end to end | Pass. Prepare, attempts, validate, tally, gates, screenshots, bundles, judges, and score all ran on 1 attempt per task per arm. |
| Paid-run budget | 72 calls. See [Paid-run budget](#paid-run-budget). |

## Arms

Built by [`build_arms.py`](scorer/build_arms.py); per-file hashes are in the [pre-registration](prereg.md#arms-1).

| Arm | Source | Files | Words | Bundle sha256 |
| --- | --- | ---: | ---: | --- |
| vanilla | none | 0 | 0 | `e3b0c442…b855` |
| base | `ux-laws` at `94617e16`, `frontend-design` at `41bbe19d1a1a` | 3 | 2,441 | `88f344a4…a74d` |
| head | `interface-design` at `48453586` | 7 | 3,180 | `47748d82…a7b9` |

The `frontend-design` file was fetched from `anthropics/skills` at the pinned commit. Its sha256 matched `d9197063…10c1d3`.

## Isolation

### How it was checked

Each attempt ran through [`run-claude.sh`](scorer/run-claude.sh) in its own workspace, against the scripted stand-in. The stand-in saved every request body the command sent, and the check read those bodies directly.

| Task | First request, all three arms | Size | User-guidance markers in vanilla |
| --- | --- | ---: | --- |
| R1, R2, R3 | Identical after normalizing the folder name, workspace name, and session IDs | 15,475 bytes | None. `DESIGN.md` appears once: the prompt names the fixture's own file. |
| B1 | Identical, as above | 14,980 bytes | None |

What the requests contained:

- **System prompt:** Claude Code's built-in prompt, 4,451 characters, the same for every arm.
- **Tools:** `Read`, `Edit`, `Write`, `Glob`, `Grep`, and the CLI's internal placeholder. No `Skill`, `Agent`, `Bash`, web, or MCP tool.
- **Trace start event:** no skills, no MCP servers, and only built-in plugins (`cc-plugin-*@builtin`).
- **Model and effort:** `claude-opus-5-5` with `output_config.effort: high`.
- **Sign-in:** an `authorization` header was present. Its value was not recorded.
- **Harness reminders:** the account email and the commit attribution note. They are the same for every arm and hold no UI guidance.

Guidance arrived only through each attempt's own reads:

| Arm | Markers in the last request of a review attempt |
| --- | --- |
| vanilla | `DESIGN.md` only |
| base | Also `ux-laws`, `frontend-design`, `UX law`, `Fitts`, `Hick` |
| head | Also `interface-design`, `WCAG`, `design-language`, `ux-laws`, `UX law`, `Fitts`, `Hick` |

### Confinement and the validator

A planted run used the first workspace and scripted three reads outside it: `~/design-language/DESIGN.md`, another attempt's page, and `~/.claude`. Two versions of the run show both outcomes:

| Command | What happened | `probe.py validate` |
| --- | --- | --- |
| `run-claude.sh`, with `--restricted` | Each call refused | No problem; 3 refused calls counted as a diagnostic |
| A local copy without `--restricted` | Both reads succeeded | 2 breaches: `Read outside workspace` for each path |

A refused call is isolation working, so it does not stop the run. This matters most for head: its `SKILL.md` and `checks.md` name `~/design-language/DESIGN.md`, so a head attempt may try that read.

All 12 dry-run attempt traces, both Opus judge traces, and all four Codex judge traces passed with no problems.

### Codex judges

Each Codex judge ran through [`run-codex-judge.sh`](scorer/run-codex-judge.sh) with a scratch `HOME` and `CODEX_HOME`, against the listener. The captured request:

- holds no `AGENTS.md` text, user skills, or user files
- lists only Codex's four built-in system skills: `imagegen`, `openai-docs`, `skill-creator`, and `skill-installer`
- names `DESIGN.md` because the bundle's design files are inline
- carries `gpt-6-astra` or `gpt-6.1-sol` with reasoning effort high, and all 30 screenshots as images

Three earlier captures showed why each setting is there:

| Setup | What leaked |
| --- | --- |
| Real `HOME` and `CODEX_HOME` | The run could not start inside the agent sandbox, so it was not captured |
| Scratch `CODEX_HOME`, real `HOME` | Every skill in `~/.agents/skills`, including `interface-design` |
| Scratch `HOME` and `CODEX_HOME` | Nothing beyond the four system skills |

Two limits remain:

- The capture used a custom provider with a dummy key. The paid run uses the ChatGPT login. The script turns off the account-linked features (apps, plugins, memories, hooks, browser use, computer use), but only a paid call can show the login adds nothing else. The protocol therefore runs the first Codex judge alone and checks it before the rest.
- The captured requests listed no tools, so the dry run could not confirm that Codex judges can read files here. They get screenshots attached and text inline instead, which needs no tools.
- `validate` scans Codex traces for commands that reach outside the bundle. On synthetic traces it passed a command inside the bundle and flagged `cat ../../judge-ledger.json` and an absolute path to the run folder. The event format it reads is not confirmed for this Codex version, so the first paid Codex judge's trace is read by hand.
- Bundles go in their own folder outside the run folder, as hill-climb's Bundle section asks, so the ledgers are not next to them. `bundle` refuses a bundle root inside the run folder.

## Scorer

### Self-test

`probe.py selftest` on the frozen key and 15 fixed answers:

| Answer type | Pages | Expected | Result |
| --- | --- | --- | --- |
| Perfect | R1, R2, R3 | 3 | 3, 3, 3 |
| Paraphrased | R1, R2, R3 | 3 | 3, 3, 3 |
| Empty (`NONE`) | R1, R2, R3 | 0 | 0, 0, 0 |
| With false findings | R1, R2, R3 | 2, 2, 1 | 2, 2, 1 |
| Near misses | R1, R2, R3 | −1 (one false, the rest unmatched) | −1, −1, −1 |
| Markdown: numbered in a fence, bold with code marks, quoted under a heading | R1, R2, R3 | 3 | 3, 3, 3 |
| Prose with no `FINDING` line | R3 | Unparsed | Unparsed |

Judge replies, through `parse_judge`:

| Reply | Expected | Result |
| --- | --- | --- |
| Plain | `OVERALL` A, C2 B, C3 SAME, complete | As expected |
| Markdown bullets with bold labels | `OVERALL` A, C2 B, complete | As expected |
| In a code fence | `OVERALL` A, complete | As expected |
| Lists an unread file | Incomplete | Incomplete |
| No `OVERALL` line | Incomplete | Incomplete |

Reviews of the dry run changed the scorer before it was frozen:

- One paraphrased answer for the colour-only category went unmatched. That pattern was widened.
- Loose patterns would have credited unrelated findings, such as any line with "primary" or "focus". The patterns were tightened, and the near-miss answers were added to keep them tight.
- A numbered or bold `FINDING` line would have scored 0 without any error, and a bold `OVERALL` line would have left a judge incomplete. Both parsers now remove Markdown first, and an unparsed review reply stops the run.
- The validator would have stopped the run on reads that `--restricted` refused. It now separates refused calls from breaches.
- Bundles were first written inside the run folder, next to the ledgers. They now go in their own folder.

### Tally in the pipeline

The dry run's scripted replies were the perfect answers, so every arm scored a mean of 3.0, with no false findings. This tests the tally, not the guidance.

## Gates

The gates ran with Playwright 1.65.0, `@axe-core/playwright`, and headless Chromium, installed in a scratch folder. Chromium could not start inside the agent's sandbox, so the gates ran outside it.

| Build | `ui-check.mjs` | `ui-modes.mjs` | States reached | Gates |
| --- | --- | --- | ---: | --- |
| Reference 1: own status region, `aria-invalid` | Exit 0; 0 axe nodes, 0 of 12 pages overflow, 0 off-token | Exit 0; 16 of 16 | 15 of 15 | Pass |
| Reference 2: readonly secret input, native validation, its own error text | Exit 0; 0, 0, 0 | Exit 0; 16 of 16 | 15 of 15 | Pass |
| Bare stub | Exit 0; 0, 0, 0 | Exit 1; 4 of 16 | 6 of 15 | Fail |

The second reference build exists because the first gate tasks would have failed correct markup. For example, they could not see a secret shown in an input. The tasks were loosened and both builds rerun.

### Review pages through the gates

Totals over the three pages, each checked at 320, 375, and 1280 px in light and dark:

| Version | axe nodes | Page views that overflow | Off-token values |
| --- | ---: | ---: | ---: |
| Clean | 0 | 0 of 18 | 0 |
| Planted | 27 | 4 of 18 | 12 |

The gates catch 4 of the 9 planted defects. The other 5 need judgment, which is where guidance can help.

Two faults in the first calibration pages were fixed before the key was frozen:

- The fixture's control borders measured 1.6:1, below WCAG 1.4.11. A `--border-strong` token at 3.8:1 light and 3.5:1 dark now draws inputs, buttons, and switch tracks.
- One page had an input with no error state that was not meant as a plant. It was given one, so a true finding about it is not counted against the key.

Three defects were also made less literal, so a careful vanilla review would not find them from a single obvious line: contrast, focus, and motion.

## Pipeline end to end

| Stage | Dry-run result |
| --- | --- |
| `prepare` | 12 workspaces (R1–R3 and B1, one attempt per arm), prompts, a private ledger, and `commands.sh` |
| Attempts | 12 runs of `run-claude.sh` through the stand-in, plus the planted violation run |
| `validate` | 18 traces clean: 12 attempts, 2 Opus judges, 4 Codex judges. The planted run's 3 refused calls are counted. |
| `tally` | 9 review replies scored, none unparsed |
| `gates` | 3 builds. Head and base wrote the reference builds and passed. Vanilla wrote nothing and failed. |
| `bundle` | 2 pairs, in a folder outside the run folder. Head vs base: identical code, so only the success screenshots differ, because each secret is random. Head vs vanilla: 30 screenshots and the differing files. 0 marker hits before or after stripping. |
| Judges | 2 Opus judges through the stand-in, which read the bundle; 4 Codex requests captured |
| `score` | Runs on the Opus replies plus synthetic Codex replies, to test the parser and the rule. Synthetic votes are not results. |

The comment stripper and marker scan were also checked on a planted build. A CSS comment that names Fitts, WCAG, and `interface-design`, and an HTML comment that names `ux-laws` and Hick, were all counted and then stripped. A trailing `//` comment is kept, so URLs are not broken, and the residual scan reports any marker left in it.

## Paid-run budget

| Calls | vanilla | base | head | Total |
| --- | ---: | ---: | ---: | ---: |
| Review attempts: 3 pages × 5 | 15 | 15 | 15 | 45 |
| Build attempts | 3 | 3 | 3 | 9 |
| Judges, head vs base: 3 pairs × 3 | | | | 9 |
| Judges, head vs vanilla: 3 pairs × 3 | | | | 9 |
| **Total** | | | | **72** |

| Model | Calls |
| --- | ---: |
| Claude Opus 5.5, effort high: 54 attempts and 6 judges | 60 |
| GPT-6 Astra, reasoning high, default tier | 6 |
| GPT-6.1 Sol, reasoning high, default tier | 6 |
| **Total** | **72** |

- The ceiling is 72. A failed call is not retried without approval.
- Tokens were not measured, because the stand-in reports none.
- Request sizes from the captures: an attempt's first request is about 15 KB. Its guidance adds 2,441 words for base and 3,180 for head, plus about 17 KB of scripts if head reads them. A Codex judge request with 30 screenshots is 1.1 to 1.4 MB.

## Stop point

The work stops here. The paid run starts only after Filip:

1. approves the 72-call run above;
2. signs Codex in to a scratch Codex home with `CODEX_HOME=<scratch-codex-home> codex login` (this PR copies no credentials);
3. runs the gates where Chromium can start, outside the agent sandbox.

The paid run then follows the [run protocol](prereg.md#run-protocol). Its first three calls, R1 attempt 1 in each arm, check that the sign-in works and that real replies parse.
