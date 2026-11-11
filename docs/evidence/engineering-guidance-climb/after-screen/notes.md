# After the screen: loop pilot, trigger bundle, and close

Date: 2026-11-10. Summary numbers: [summary.json](summary.json).

Both pilots compared one candidate with cached vanilla on six screen tasks, with one attempt each and Codex `gpt-6.1-sol` at high reasoning:

- skrub
- etree
- tomlkit
- fd
- sql-formatter
- go-critic

Rule 1 rejects a candidate that fails a task vanilla passed. Rule 2 rejects a token geometric mean above 1.3× vanilla.

## Loop pilot

The pilot tested `workflow-loop` ([AGENTS.md](workflow-loop-AGENTS.md), [pre-registration](loop-prereg.md)). It keeps only `workflow-lean`'s authority and ask-fix bullets, plus the Engineering steps. It has no plugin. It is 3,081 bytes, against lean's 19,476.

| Task | Vanilla | Loop | Loop to vanilla tokens |
| --- | --- | --- | ---: |
| skrub | pass | pass | 0.82 |
| etree | pass | **fail** | 1.67 |
| tomlkit | pass | pass | 1.69 |
| fd | pass | pass | 1.33 |
| sql-formatter | pass | pass | 1.60 |
| go-critic | fail | pass | 0.92 |

- **Decision: reject on rule 1** (etree).
- **Rule 2 passed:** 1.287× [1.05, 1.55].
- **Against lean:** the loop used 0.56× lean's tokens on these tasks. No attempt started a reviewer.

## Trigger bundle

The second candidate was `workflow-triggers` ([diff from lean](workflow-triggers.diff), [pre-registration](triggers-prereg.md)). It is lean with three edits:

- The reviewer trigger is narrower.
- The test-audit trigger is narrower.
- The writing-skill trigger is narrower.

| Task | Vanilla | Triggers | Triggers to vanilla tokens |
| --- | --- | --- | ---: |
| skrub | pass | pass | 1.02 |
| etree | pass | **fail** | 1.72 |
| tomlkit | pass | pass | 1.23 |
| fd | pass | pass | 1.75 |
| sql-formatter | pass | pass | 1.98 |
| go-critic | fail | fail | 1.39 |

- **Decision: reject on both rules:** etree, and 1.48× [1.27, 1.71].
- **Reviewer:** no attempt started one.
- **Reads:** the technical-writing skill was still read in 2 of 6 attempts.

## Council on the overhead and on etree

Astra, Sol 6.1, Opus 5.5, and Fable 5.2 read the traces. All four were read-only.

### etree

The etree losses for lean and loop are a verifier artifact.

- **What happened:**
  - Before the existing-test suite runs, the verifier replaces the agent's `diff_test.go` with the trusted one.
  - The trusted file builds only with the `diff` tag.
  - The agent's other test files called a helper that lived in its own `diff_test.go`, so the untagged build failed.
  - All 15 existing tests then counted as failed.
- **Regrade:** in the task image, with no model calls, only the test files that the base commit does not contain were removed. Both attempts then pass the same 15 existing tests the verifier lists, and all 52 new tests.
- **Scope:** 79 attempts outside the holdouts were scanned for this failure. The 78 with verifier output show no other case, in any arm. One attempt has no verifier output: the screen's cattrs vanilla attempt, which was never graded.
- **Triggers:** its etree loss is different. One new test rejects `/@color` anywhere in the patch output, and the candidate's undo metadata contains it. Three members called the assertion too broad. Opus called it a spec slip.
- **Vanilla is one attempt:** the screen's etree attempt and the cached pilot attempt are the same submission.

### Base overhead

Cached input on more requests causes the overhead. Output, including the ledger and the report, is about 1%.

| 16 screen pairs with no reviewer | Vanilla | `workflow-lean` |
| --- | ---: | ---: |
| Tokens | 25.39M | 36.76M (1.44× geometric mean) |
| Model requests | 402 | 469 |
| Test commands | 107 | 158 |
| Guidance reads | 0 | 74 |
| Mean input per request | 62.3k | 77.5k |

- **Plugin weight:** the plugin arms' `AGENTS.md` adds about 4.3k tokens to every request. Skill and reference reads stay in context.
- **Engineering steps:** steps 3, 6, 8, and 9 add requests. These are baseline and pre-fix test runs, extra suites, and diff re-reads.
- **Loop on four tasks with no reviewer** (skrub, fd, sql-formatter, go-critic): 1.03× vanilla in aggregate input tokens, and 1.13× as a geometric mean of input tokens. Most of the 1.45× belongs to the plugin layer. The loop's cost is on etree and tomlkit, where it added tests beyond the spec.

## Post hoc, no decision weight

- **Loop pilot:** with the etree regrade, rule 1 would not have fired. Rule 2 stood at 1.287×.
- **Screen:** with the regrade, `workflow-lean` passes 85% of tasks, against vanilla's 90%.
- **Gate power:** rule 1 can wrongly reject a candidate, at a rate of about 41% (1 − 0.9⁵). That figure assumes:
  - vanilla passes five of the six tasks;
  - the candidate passes each of them with probability 0.9;
  - the task outcomes are independent.

## Close

The owner stopped the cost climb.

- **What ships:** no guidance change, because no evaluation supports one.
- **PluginBench follow-up:** a regrade rule applied to every arm, owned by the PluginBench audit work. When a trusted test file replaces an authored one and the existing-test suite then fails to build, the rule removes only test files absent from the base commit and grades again. A fix to the task's own verifier script is out, because task assets are part of the vanilla cache identity.
