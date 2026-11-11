# Trigger-bundle candidate: pre-registration

Date: 2026-11-10. **Frozen** on 2026-11-10, after `check` and the dry run on PluginBench febdf03 and before any coding call. This file authorizes no paid call; each option needs the owner's approval.

**Order: option A first, as a cheap rejection gate. Run option B only if A passes, and only with a separate approval.** If A rejects the candidate, B does not run. That saves about 62M tokens, and the loop-only candidate already failed once on A's six tasks.

## Question

Does removing the three guidance triggers that drove the screen's extra cost bring `workflow-lean` near vanilla's cost, without losing correctness that vanilla gets?

## Why this candidate

- The loop-only pilot was rejected under rule 1 (`../loop/result.md`). It failed etree, which vanilla passed, at a token geometric mean of 1.287× vanilla.
- Its pre-registration names the fallback: Opus 5.5's trigger bundle from the council.
- The council traced the screen's 25.0M excess over vanilla, on 19 tasks:
  - Reviewer subagents used 7.27M (29%). They started on additive format work and forked the parent's history.
  - Test-audit was read in 15 of 18 attempts, and technical-writing in 13 of 18.
  - Opus projects 1.35–1.45× vanilla for this bundle; Fable projects 1.45× for the review edit alone. Both are above 1.3, so this candidate may pass correctness and still miss the token bar.

## Arms

| Arm | Delivery |
| --- | --- |
| `vanilla` | Codex built-in instructions only |
| `workflow-triggers` | `../arms/workflow-triggers/AGENTS.md` as guidance, `../arms/workflow-triggers/workflow` as plugin |

`workflow-triggers` is `../arms/workflow-lean` (the screened arm) with three edits. The full diff is in `../arms/workflow-triggers.diff`.

1. **Separate review only when the change is hard to undo, in a fresh context.**
   - `engineering/SKILL.md` ("Load only what the route needs") and `references/delegation-and-review.md` ("Independent review") now trigger review only for:
     - a change to security or authentication,
     - a migration of stored data,
     - the removal or renaming of a published API.
   - "Persisted data or formats" is gone. A new API, format, or option uses step 9's diff inspection.
   - New line: start the reviewer in a fresh context, not a fork of this conversation; its brief is the only context it gets.
2. **Test-audit only on request.**
   - `engineering/SKILL.md` now invokes `$workflow:test-audit` only when the user or repository asks for a test audit or cleanup.
   - `AGENTS.md` "Testing hygiene" drops "and use `$workflow:test-audit` for substantial or uncertain coverage changes".
3. **No writing skill for code-adjacent text.** `AGENTS.md` "Written deliverables" adds: "Code comments, README edits, and commit messages written as part of a code change need no writing skill."

Fixed settings:

- Codex harness, `gpt-6.1-sol`, reasoning `high`.
- Subagents on, `max_threads: 4`.
- `timeout_seconds: 1800`, `jobs: 2`, `seed: 42`, `repeats: 1`.

These are the screen's settings, kept so that vanilla can hit `screen/cache`.

The reviewer is Codex `gpt-6-astra`, reasoning high, `../review-standard.md`, 900 seconds. It runs so that `pluginbench judge prepare` works without a workaround. Its findings are diagnostics.

## Pinned setup (from the eval-readiness thread, 2026-11-10)

- PluginBench **febdf03**, worktree `eval-febdf03`, which includes #33. `XDG_CACHE_HOME` is `screen/cache`. Only that thread runs PluginBench commands. Logs are in `../logs/triggers/`.
- **Option A:** `check` reported Ready, exit 0, with vanilla hits 6 of 6. The dry run plans 12 coding attempts (6 of them cached vanilla) and 12 reviews; reviews cover the cached vanilla attempts. Files: `dry-run-triggers-febdf03.json`, `check-triggers-febdf03/`.
- **Option B:** `check` reported Ready, exit 0, with vanilla hits 19 of 20. Coverage is `not_configured` on the 18 tasks without a profile. The dry run plans 40 attempts and 40 reviews. Files: `dry-run-triggers-20-febdf03.json`, `check-triggers-20-febdf03/`.
- **Vanilla attempts reused for the five top-up tasks:**

| Task | Vanilla attempt | Same as the screen's pairing? |
| --- | --- | --- |
| adaptix | `1b8d7252ecf8b3bd` (top-up) | yes |
| oxvg | `c7abce9b6054bb92` (top-up) | yes |
| skrub | `60b341255a4c206f` (top-up) | yes (also used in option A) |
| wasmi | `721d381d6f637fce` (first screen part) | **no.** The screen paired the top-up's `128deb20c8c0ac43`. Both are valid vanilla attempts with the same settings, and both pass with reward 1 (22/22 new, 58/58 existing). Their tokens differ: 5.06M against 4.57M. Option B's wasmi pair uses `721d381d6f637fce`. |
| textual | miss: the top-up's `68bda444361d2f11` is not in the cache | **no.** Coded fresh in option B; reported separately. |

- **Version and dead_code.** Readiness smokes on febdf03 passed: 2 of 2 reviews ran under the #23 sandbox, Astra, Opus, and Fable each returned a verified verdict, and `judge prepare` works on a run with a reviewer. `dead_code` is broken for JS/TS in `check`, so it stays out of both configs.

## Options

Run option A first. Run option B only if A passes and the owner approves it separately.

### Option A: six-task rejection pilot (`triggers.yaml`, machine-local)

- **Tasks:** the loop pilot's six (go-critic, tomlkit, etree, skrub, fd, sql-formatter). Adaptix and csstree are excluded, and the holdouts are not in the panel.
- **Vanilla:** all six hit on febdf03, and they are the same attempts the loop pilot reused, including skrub's top-up attempt `60b341255a4c206f`.
- **Rejected** if either holds:
  1. It fails a task that this run's vanilla passes (pass or overlap pass).
  2. The geometric mean of its per-task token ratio to vanilla (input plus output) is above 1.3.
- **Otherwise it advances** to option B, which needs a separate approval.
- **Reported, not deciding:**
  - The 90% CI of the token ratio (task bootstrap, seed 0, 10,000 draws).
  - Ratios to `workflow-lean`'s screen attempts and to `workflow-loop`'s pilot attempts.
  - Trace counts per attempt: `spawn_agent` calls, test-audit reads, and technical-writing reads. Mechanism target: 0 forked reviewer spawns, at most 1 test-audit read, and at most 1 technical-writing read.
  - Judges, as described under "Judging".
- **Limits.**
  - A candidate exactly as correct as vanilla trips rule 1 about 41% of the time.
  - A six-task CI on the token ratio is about ±30% wide.
  - A rejection is weak evidence. It goes back to the council; it does not end the climb.

### Option B: 20 admitted screen tasks (`triggers-20.yaml`, machine-local)

- **Tasks:** the 20 tasks the screen admitted, in panel order. This includes adaptix and csstree, so the sensitivity analysis below applies.
- **Vanilla:** 19 of 20 attempts hit. Textual misses and is coded fresh. Wasmi reuses a different valid vanilla attempt from the screen's pairing (see "Pinned setup"). Report both tasks separately, and also report the result without them.
- **Decision:** the screen's pre-registered rule, unchanged (`../screen/prereg.md`, "Analysis" and "Decision rule"):
  - Correctness non-inferiority: the lower bound of the 90% CI on the paired pass-rate difference must be at least −10 pp.
  - Token gate: the upper bound of the geometric-mean ratio to vanilla must be at most 1.3.
  - Judged preference is used only when correctness is non-inferior: 4 judges, 3 of 4 to win a pair, and a lower bound above 50% to advance.
  - Admission is arm-blind. Both-fail and infrastructure tasks are dropped.
  - Sensitivity: repeat the analysis without adaptix and csstree.
- **Free reference:** `workflow-lean`'s screen attempts on the same tasks, compared on tokens and outcomes. They do not decide anything.
- **Limits.** A candidate exactly as correct as vanilla is declared non-inferior only about 30–60% of the time (screen power table). This option buys a token estimate on the whole admitted set. It does not prove correctness.

## Judging

Judging is diagnostic in option A and decisive in option B (when correctness is non-inferior).

- **Judges:**
  - Astra and Sol 6.1, with `../review-standard.md`.
  - Opus 5.5, with `../review-standard.md`.
  - Fable 5.2, with the owner-profile criteria (private).
  - Claude judges need PluginBench #31.
- **Format:** one pair per call, on admitted pairs where both arms pass. Sides come from the `judge prepare` seed.
- **First step:** one judge call on one pair. On `main`, the judge and reviewer sandbox denies writes to `/` and `/tmp` (PR #23), and no paid judge call has tested that yet.

## Cost estimate

These are model usage figures, scaled from the screen's records. There is no dollar figure, because there is no price table. All coding and review calls are Codex.

The candidate's scale against vanilla:

- Low: 1.0×.
- Expected: 1.4× (Opus's projection).
- High: `workflow-lean`'s actual cost on the same tasks.

| Option A, six tasks | Low | Expected | High |
| --- | ---: | ---: | ---: |
| `workflow-triggers`, 6 attempts (vanilla 7.90M) | 7.9M | 11.1M | 17.7M |
| Reviews, 12 calls at 150k / 270k / 500k | 1.8M | 3.2M | 6.0M |
| **Coding and review** | **9.7M** | **14.3M** | **23.7M** |
| Judges, 4 per pair: 2 / 4 / 5 pairs at 150k / 350k / 700k per call | 1.2M | 5.6M | 14.0M |
| **Total** | **10.9M** | **19.9M** | **37.7M** |

| Option B, 20 tasks | Low | Expected | High |
| --- | ---: | ---: | ---: |
| `workflow-triggers`, 20 attempts (vanilla 36.96M) | 37.0M | 51.7M | 64M |
| Vanilla, textual coded fresh (top-up record 1.98M; 0.7× / 1.0× / 2.0×) | 1.4M | 2.0M | 4.0M |
| Reviews, 40 calls | 6.0M | 10.8M | 20.0M |
| **Coding and review** | **44M** | **64.5M** | **88M** |
| Judges, 4 per pair: 10 / 14 / 18 pairs | 6.0M | 19.6M | 50.4M |
| **Total** | **50M** | **84M** | **138M** |

- **Vanilla coding:** none in option A, where all 6 attempts hit. In option B, only textual is coded fresh.
- **Review calls:** the dry runs confirm that reviews cover the cached vanilla attempts too: 12 in option A and 40 in option B.
- **Judges** in option B run only when correctness is non-inferior. Without them, option B is 44–88M.
- **Sequence:** option A alone is expected to cost about 20M (11–38M). Running both options is expected to cost about 104M.
- **More repeats.** Repeats above 1 change the vanilla key, so every vanilla attempt would miss and be re-coded. Each extra repeat on all tasks costs about the coding row again, plus vanilla's tokens: about 19M in option A and 89M in option B.
- **Wall clock:** about 1–2 hours for option A and 5–7 hours for option B, at `jobs: 2`.
- **Usage:** on 2026-11-10, the Codex weekly window was 59% used, against 18% expected (it resets on 2026-11-16). The loop pilot added 9.84M since then.

## Changes after this point

Any change to the arms, tasks, control, judges, or decision rule is an amendment. Log it with its reason before the run starts. After the run starts, log it before any result is read.
