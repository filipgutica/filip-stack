# Workflow skill evaluation lab notebook

Date started: 2026-09-02

Status: Active experiment

Paths prefixed with `pluginbench/` are relative to the PluginBench repository unless stated otherwise.

## BLUF

This study tests whether engineering workflow skills improve a coding agent's work.
It also tests whether any gain justifies the added tokens, cost, time, and ceremony.

The evidence does not yet show general effectiveness.
The first hard-task study found a smaller core bundle more promising than the full bundle.
The full bundle used more resources and did not improve task completion.
The first Workflow v2 hard-task run also used more resources and passed only one task.

The focused repair loop has now produced its first positive canary signal.
The real-boundary rule repaired two of three failing patches.
The no-skill baseline repaired none.
The treatment added 21.42% nominal cost and failed the configured 20% cost ceiling.

This is promising directional evidence, not an accepted workflow result.
The passing-patch control preserved all three treatment attempts without regressions.
However, the treatment added 64.36% cost to work that was already correct.

That preservation result is the clearest evidence of workflow overprocessing so far.
The bounded replacement stayed within the cost ceiling but repaired zero attempts.

None of those earlier rules passed both the correctness and efficiency gates.
They were rolled back, and the holdout did not run.

A later five-attempt run tested an adaptive v2.1 candidate with a task-capable runtime.
The no-skill baseline repaired five of five attempts.
The v2.1 candidate repaired four of five attempts and cost 57.18% more.
The candidate failed the efficiency gate and was rolled back.

A four-line activation control then repaired four of five attempts.
It added 5.90% total cost and reduced total duration by 1.21%.
It removed all reference and reviewer activity from the observed paths.
One official result was ambiguous after the agent changed only an existing test.
The control failed its fixed gate, so the micro-skill did not run.

The next preregistered run tested the micro engineering loop directly.
It repaired five of five failing patches and preserved three of three passing patches.
Against the compatible repair baseline, its median reported tokens fell 34.40%,
cost fell 23.97%, and latency fell 19.45%.
In the fresh preservation pair, candidate median tokens rose 17.68% and cost
rose 12.71%, while latency fell 20.33%. All fixed ceilings passed.
The candidate was promoted to the Workflow source.

This result preserves saturated correctness; it does not show a correctness lift.
Trace order also exposes a remaining weakness: the candidate reached its first
actual test later than baseline in both stages.

The successful-patch quality study then compared five resolved attempts from each arm.
The candidate median patch churn was 7 lines. The baseline median was 10 lines.
The distributions overlapped. Candidate churn ranged from 4 to 27 lines.
Baseline churn ranged from 7 to 22 lines. Both arms had the same median
decision-point change.
The study did not measure human correction turns or review time.

The blinded reviewer study did not solve the quality measurement problem.
That reviewer objected to gold patches more often than experimental patches.
Raw finding counts therefore cannot rank code quality or review burden.

The current loop uses a fixed failing patch and a fixed passing control patch.
This design can measure repair, preservation, scope, and resource use.
It cannot establish general effectiveness from one task.

## Research questions

This study asks these product questions:

1. Do the skills reduce mistakes that require review?
2. Do the skills help an agent repair an existing mistake?
3. Do the skills preserve correct work?
4. Do the skills produce simple and maintainable changes?
5. Do the skills prevent unrelated changes and unnecessary abstractions?
6. Do the benefits justify the resource overhead?

Task completion is a guardrail. It is not the complete product outcome.

## Why “with skills” is underspecified

A label such as “with skills” hides the treatment.
It does not identify the available skills, invoked skills, read references, or followed procedures.
It also hides the instruction size and runtime cost.

A workflow bundle can help through planning, tests, review, and verification.
It can also add repeated context, tool calls, reviews, and procedural work.
A larger bundle can therefore cost more while producing the same or worse result.

This study records these treatment details:

- the exact skill bundle and digest
- the skills and references that the trace shows as read
- the model, reasoning setting, task, timeout, and runtime image
- the final patch and official verifier result
- the input, cached, and output tokens
- the nominal cost and duration
- the changes made after a starting patch

## Intended product outcomes

The initial product goals were broader than benchmark pass rate.

| Goal | Best current measure | Main limit |
| --- | --- | --- |
| Less review slop | Calibrated action-required findings and review time | Model review needs human-adjudicated anchors. |
| Fewer corrections | Correction turns and active human time | This is expensive and not in the current canary. |
| Maintainable code | Success on an unseen follow-on extension | Static review is a weak proxy. |
| Less overengineering | Unnecessary layers, options, dependencies, and indirection | Line count alone is not sufficient. |
| Less unrelated scope | Unrelated files, APIs, behavior, and formatting | Required integration work must remain allowed. |
| Reliable execution | Official task result and preservation result | One task cannot represent general work. |
| Efficient execution | Tokens, cost, duration, and cost per success | Correctness remains the primary gate. |

## Chronological research record

### 1. Local workflow smoke study

Date: 2026-08-31

The first local study used three hand-authored tasks.
The tasks covered debugging, review-feedback triage, and planning.

| Arm | Passed | Input tokens | Nominal cost | Duration |
| --- | ---: | ---: | ---: | ---: |
| No supplied skills | 2 of 3 | 365,071 | $0.0280 | 199.5 seconds |
| Full Workflow bundle | 3 of 3 | 934,985 | $0.1009 | 354.8 seconds |

The full bundle fixed the planning outcome.
It also used 2.56 times the input tokens and 3.60 times the nominal cost.

These tasks were written to expose workflow behavior.
They provided routing evidence, not a general effectiveness result.

Evidence: [2026-08-31 evaluation report](https://github.com/filipgutica/pluginbench/blob/main/reports/2026-08-31-filip-stack-evaluation.md#22-local-workflow-smoke-evaluation).

### 2. One-task SWE-bench isolation study

Date: 2026-08-31

The next study added the official SWE-bench verifier.
It used `sympy__sympy-20590` after the gold-patch oracle passed.

Both arms passed the official task.
The full bundle used about 22% more tokens and 12.25% more nominal cost.
It added no task-score lift.

Earlier diagnostic pairs exposed host-artifact leakage and sandbox problems.
The final pair isolated each trial in its own container.

Evidence: [2026-08-31 evaluation report](https://github.com/filipgutica/pluginbench/blob/main/reports/2026-08-31-filip-stack-evaluation.md#23-one-task-swe-bench-evaluation).

### 3. Paired hard-task study and core ablation

Date: 2026-08-31 to 2026-09-01

The main capability study used eight pinned SWE-bench Verified tasks.
Seven tasks produced a strict three-way comparison.
Each arm had one attempt per task.

The three treatments were:

- baseline with no supplied workflow skills
- full Workflow bundle with 23 available skills
- core bundle with `implementation`, `minimal-code`, and `systematic-debugging`

| Arm | Strict tasks passed | Total tokens | Tokens per task | Cost per task | Duration per task |
| --- | ---: | ---: | ---: | ---: | ---: |
| No supplied skills | 2 of 7 | 11,251,938 | 1,607,420 | $0.1253 | 460.2 seconds |
| Full Workflow bundle | 1 of 7 | 14,726,939 | 2,103,848 | $0.1571 | 471.3 seconds |
| Core bundle | 3 of 7 | 11,708,595 | 1,672,656 | $0.1314 | 526.7 seconds |

The full bundle used 30.88% more tokens than the baseline.
It had a 14.29 percentage-point lower pass rate.
The core bundle used 4.06% more tokens and had a higher pass rate.

The full bundle digest was `sha256:27843a5bd6c34252b740399bf678bc0ba3bca4841f82875b795e289d26b24b37`.
The core bundle digest was `sha256:4776917dabb87664baf0126719a27c4a0b699ab49736725207c49ddfff376d22`.

Raw run roots:

- `pluginbench/runs/20260831T215323Z-filip-stack-swe-bench-verified-hard`
- `pluginbench/runs/20260901T003052Z-filip-stack-core-ablation`

Published evidence:

- [narrative evaluation report](https://github.com/filipgutica/pluginbench/blob/main/reports/2026-08-31-filip-stack-evaluation.md)
- [strict full-bundle summary](https://github.com/filipgutica/pluginbench/blob/main/reports/generated/filip-stack-swe-bench-strict.md)
- [three-way core summary](https://github.com/filipgutica/pluginbench/blob/main/reports/generated/filip-stack-core-ablation.md)

### 4. How the study exposed workflow inefficiency

The hard-task study did not prove that skill count caused failure.
It did show a measurable process cost.

The full bundle exposed 23 skills.
It spread one coding task across coordination, implementation, review, simplification, debugging, and Field Guide procedures.
The full arm used 457 visible commands across all eight tasks.
The baseline used 230 commands.

The full arm did not create the largest aggregate patch.
Its main inefficiency appeared in context and procedure, not changed-line count.

The traces also exposed an enforcement gap.
The full arm read the independent-review procedure but reviewed its own work.
No separate reviewer identity or review artifact existed.
PluginBench's skill-read heuristic proved discovery, not procedure compliance.

The `pytest-dev__pytest-5787` result provided the clearest technical contrast.
The baseline and full patches broke one existing compatibility test.
The core patch preserved the legacy path for one-element exception chains.
It passed 125 tests, including both new chained-exception tests.

This evidence led to two hypotheses:

1. Direct engineering constraints can be useful without a large workflow graph.
2. More procedure does not help when it repeats the implementation's assumptions.

These are hypotheses from one-attempt evidence.
They are not causal conclusions.

### 5. Blinded reviewer-proxy study

Date: 2026-09-01

The next study reused 21 saved patches from seven tasks.
Each patch received two fresh, blinded reviews.
The 42 experimental-arm reviews completed without infrastructure failures.

| Arm | Reviews | Accepts | Findings | Findings per review |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 14 | 6 | 17 | 1.21 |
| Full | 14 | 6 | 12 | 0.86 |
| Core | 14 | 7 | 10 | 0.71 |

The raw counts made the core arm look better.
The official verifier and later calibration did not support that interpretation.

The reviewer verdict matched the official pass or fail result in 25 of 42 reviews.
It accepted all three failing Xarray patches.
It also accepted the failing baseline and full Pytest patches.

#### Setup and calibration run record

| Run | Outcome |
| --- | --- |
| `20260901T062334Z` | PluginBench rejected Git-normalized gold metadata. |
| `20260901T062625Z` | Docker could not mount the temporary auth path. |
| `20260901T062954Z` | Promptfoo could not resolve local schema references. |
| `20260901T063300Z` | Codex rejected `agents.enabled=false`. |
| `20260901T063409Z` | One Django plumbing review passed. |
| `20260901T064011Z` | All 42 experimental-arm reviews completed. |
| `20260901T152957Z` | All 14 gold-patch calibration reviews completed. |

The arm study used $3.1894 in nominal model cost.
The gold calibration used $1.3535.
The successful gate added $0.0967.

#### Gold-patch calibration failure

The seven gold patches had passed the local SWE-bench oracle.
They then received 14 blinded reviews under the same review contract.

Gold received 32 findings and only one accept verdict.
Gold had 2.29 findings per review.
Every experimental arm received fewer findings per review.

The result exposed a calibration failure.
It did not prove that all gold findings were false.
It proved that raw reviewer counts lacked a sensible accepted-work reference.

Use reviewer findings only after calibration and human adjudication.
Keep official correctness separate from subjective quality judgments.

Evidence:

- [blinded review evaluation](https://github.com/filipgutica/pluginbench/blob/main/reports/2026-09-01-filip-stack-blinded-review-evaluation.md)
- `pluginbench/runs/reviews/20260901T064011Z-filip-stack-swe-bench-review-arms`
- `pluginbench/runs/reviews/20260901T064011Z-filip-stack-swe-bench-review-arms/review-report.md`

### 6. Workflow v2 simplification

Date: 2026-09-02

Workflow v2 reduced the available workflow from 23 skills to five skills.
Three skills form the normal route:

- `planning`
- `engineering`
- `technical-writing`

`grill-me` and `walkthrough` remain manual tools.
Field Guide moved to a separate plugin.

The design uses progressive disclosure.
The main skill contains the short contract and routing rules.
References contain task-specific procedures and templates.
The agent should read a reference only when the task needs it.

The v2 hypothesis was:

> A smaller workflow can preserve useful engineering constraints while reducing overhead and procedural distraction.

#### Local v2 smoke run

Run: `pluginbench/runs/20260902T065344Z-workflow-skill-smoke`

The v2 treatment passed two of three local tasks.
It used 481,839 input tokens, $0.0363 nominal cost, and 337.4 total seconds.
It read `engineering` on two tasks and `planning` on one task.

The planning task failed an exact artifact contract.
The plan wrote `Source: REQUEST.md.` instead of the required Markdown link.
The rest of the plan was implementation-ready.

This treatment-only run did not use a concurrent baseline.
Its lower resource use than the old local full arm is directional evidence only.
The result also shows that simplification can remove a small but required detail.

The v2 digest was `sha256:60655c931c5dd11ffcfa5179de459102cd2ff26f9247bb56a00f6f160936aad2`.

#### Hard-task v2 run

Run: `pluginbench/runs/20260902T154634Z-filip-stack-core-ablation`

The directory kept the old `core-ablation` experiment name.
The treatment was the five-skill v2 bundle, not the earlier three-skill core bundle.

The run reused the compatible no-skill baseline from the first hard-task study.
It ran one new v2 treatment attempt on each of eight tasks.

| Metric | Reused baseline | Workflow v2 |
| --- | ---: | ---: |
| Tasks passed | 2 of 8 | 1 of 8 |
| Unscored tasks | 1 | 0 |
| Input tokens | 13,520,693 | 22,421,214 |
| Output tokens | 142,400 | 157,026 |
| Nominal cost | $1.0520 | $1.4906 |
| Cost overhead | — | 41.69% |

The strict paired comparison covered seven tasks.
The v2 arm lost one task and gained none.
Only the Django task passed in the v2 arm.

The result did not confirm the simplification hypothesis.
A smaller static bundle did not produce a smaller runtime trace.

The run order, one-attempt design, and reused baseline limit the comparison.
Provider drift and model variance remain possible explanations.
This result motivated a faster, repeated, fixed-patch loop.

Evidence:

- V2 hard-run report: `pluginbench/runs/20260902T154634Z-filip-stack-core-ablation/report.md`
- V2 treatment arm: `pluginbench/runs/20260902T154634Z-filip-stack-core-ablation/treatment/arm.json`

### 7. Starting-patch capability

Date: 2026-09-02

PluginBench commit `ee97bc654d210dea863e65d589833f2a9be418ff` added starting-patch evaluation.
The change added 658 lines and removed 11 lines across 15 files.

PluginBench now applies and stages the same patch in both arms.
Each starting patch declares its verified expected score.

- `expected_score: 0` defines a known failing repair seed.
- `expected_score: 1` defines a known passing preservation seed.

PluginBench classifies each official attempt as:

- `repaired`
- `unchanged failure`
- `preserved`
- `regressed`
- `unscored`

The official verifier receives the complete final patch.
The `agent-change.diff` artifact contains only work after the starting patch.

This design supports a controlled repair loop without synthetic tasks.
It also separates repair ability from the ability to avoid damaging correct work.

Capability evidence:

- [README starting-patch contract](https://github.com/filipgutica/pluginbench/blob/main/README.md#start-from-an-existing-patch)
- `src/pluginbench/swebench.py`
- `src/pluginbench/experiment.py`
- `tests/test_run.py`
- `tests/test_swebench.py`

### 8. Pytest repair and preservation canary

Task: `pytest-dev__pytest-5787`

The task adds chained-exception support to report serialization and deserialization.
It is useful because the earlier arms produced different compatibility outcomes.

- The no-skill and full patches failed one existing compatibility test.
- The core patch passed the existing and new tests.
- The failing patches passed 124 tests and failed one test.
- The passing patch passed 125 tests and skipped two tests.

The failed no-skill patch became the repair seed.
The passing core patch became the preservation seed.

| Artifact | Path | SHA-256 |
| --- | --- | --- |
| Repair config | `pluginbench/benchmarks/workflow-pytest-canary/repair.yaml` | Configuration file |
| Preservation config | `pluginbench/benchmarks/workflow-pytest-canary/preservation.yaml` | Configuration file |
| Repair seed | `pluginbench/benchmarks/workflow-pytest-canary/seeds/repair.patch` | `5e7174f7973d6313c492aa3285ce46fa827ea61bff073a5a80f284375aa5d74c` |
| Preservation seed | `pluginbench/benchmarks/workflow-pytest-canary/seeds/preservation.patch` | `038019d0a9fdc60a87a4ac6fb65cc4398f655e1bc1a299037fcc56fe59a259e8` |

Both configs use these fixed controls:

- dataset revision `78f471bf655a3137b2e8a75af1501690ec009ec3`
- SWE-bench harness `5.0.2`
- model `gpt-5.6-luna`
- reasoning `high`
- runtime image `pluginbench-runtime:0.2.0`
- runtime image ID `sha256:46f9b2d6cd61403c82d00b26cb280a7e5a598bb4ab5a8688378160bfe0f0a6bf`
- three attempts
- one concurrent trial
- 600-second trial timeout
- no model network or web access

### 9. Initial paired v2 repair run

Date: 2026-09-02

Run: `pluginbench/benchmarks/workflow-pytest-canary/runs/20260902-workflow-v2-pytest-repair-initial/20260902T195826Z-workflow-pytest-repair-canary`

This run created a fresh starting-patch baseline.
It compared no supplied skills with the initial v2 bundle.
The v2 digest was `sha256:60655c931c5dd11ffcfa5179de459102cd2ff26f9247bb56a00f6f160936aad2`.

| Arm | Repairs | Total input tokens | Total output tokens | Total cost | Total duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| No supplied skills | 0 of 3 | 3,114,296 | 39,345 | $0.2904 | 978.6 seconds |
| Initial Workflow v2 | 0 of 3 | 5,389,799 | 43,019 | $0.3879 | 1,354.3 seconds |

The v2 arm added 2,279,177 tokens and 33.58% nominal cost.
It produced no repair-rate lift.
PluginBench marked the treatment `not_justified` under the configured threshold.

Median model-call cost was $0.0935 for baseline and $0.1278 for treatment.
Median model latency was 268.4 seconds for baseline and 386.7 seconds for treatment.

Every official attempt remained an unchanged failure.
The existing `test_deserialization_failure` contract still failed.

Evidence:

- [initial canary report](evidence/workflow-skill-evaluation/initial-repair-report.md)
- [initial treatment arm](evidence/workflow-skill-evaluation/initial-repair-treatment-arm.json)

### 10. Iteration 1: compatibility rule in a reference

Date: 2026-09-02

Hypothesis:

> A general compatibility checkpoint will make the agent preserve an existing input path.

The checkpoint said:

> When extending an existing representation or branch, identify one existing input that must retain its behavior. Preserve the old path unless the input satisfies the new behavior's invariant, and verify both paths.

The first placement was `engineering/references/testing-and-debugging.md`.
The bundle digest was `sha256:8afa3b87b1492ed6c7e1fdd8965a319b4d0eb5c9b156e148d1d4e507e25dc6f6`.

Run: `pluginbench/runs/20260902-workflow-v2-pytest-repair-compatibility/20260902T203810Z-workflow-pytest-repair-canary`

The run reused the fresh initial baseline.
It did not complete all three treatment attempts.
PluginBench therefore produced no final aggregate report.

| Attempt | Agent result | Official result | Cost | Model latency |
| --- | --- | --- | ---: | ---: |
| 1 | Completed | Unchanged failure | $0.0977 | 278.5 seconds |
| 2 | Timed out | Not scored | $0 recorded | 600.0 seconds |
| 3 | Not completed | Not scored | — | — |

Attempt 1 passed the two new target tests.
It still failed `test_deserialization_failure`.
The official run passed 124 tests, failed one, and skipped two.

#### Corrected interpretation

The first interpretation was that progressive disclosure hid the new rule.
The trace disproves that interpretation.

Attempt 1 opened `engineering/SKILL.md`.
It then opened `engineering/references/testing-and-debugging.md` and the other engineering references.
The modified reference was therefore disclosed in the scored attempt.

The reference placement was disclosed but ineffective in that attempt.
Moving the same rule into `SKILL.md` tests salience and placement.
It does not test disclosure.

Trace evidence:

- `pluginbench/runs/20260902-workflow-v2-pytest-repair-compatibility/20260902T203810Z-workflow-pytest-repair-canary/treatment/batches/0001/trials/pytest-dev__pytest-5787--attempt-01/promptfoo-results.json`
- `pluginbench/runs/20260902-workflow-v2-pytest-repair-compatibility/20260902T203810Z-workflow-pytest-repair-canary/manual-verifier/attempt-01/logs/run_evaluation/workflow-v2-compatibility-attempt-01/gpt-5.6-luna/pytest-dev__pytest-5787/report.json`

### 11. Iteration 2: compatibility rule in the main skill

Date: 2026-09-02

The second placement moved the same sentence into `engineering/SKILL.md`.
No task-specific name, repository detail, or known solution entered the skill.
The bundle digest is `sha256:e205f577d33fdd43fa040d8c1a708fa543834e26aa944e27edadc26250d1c782`.

Run: `pluginbench/runs/20260902-workflow-v2-pytest-repair-main-compatibility/20260902T205609Z-workflow-pytest-repair-canary`

| Arm | Repairs | Total cost | Total duration |
| --- | ---: | ---: | ---: |
| Reused no-skill baseline | 0 of 3 | $0.2904 | 978.6 seconds |
| Main-skill checkpoint | 0 of 3 | $0.2640 | 979.4 seconds |

The treatment reduced nominal cost by 9.11%.
Its aggregate duration was 0.8 seconds higher than baseline.
It did not improve correctness or repair rate.

PluginBench marked the treatment `justified`.
The configured gates allowed zero pass-rate lift and accepted lower cost.
The product gate rejects this result because correctness did not improve.

This iteration changes instruction placement only.
It provides a clean salience test without adding another rule.
Moving the checkpoint into the main skill did not change the repair outcome.

Evidence:

- [main-skill report](evidence/workflow-skill-evaluation/main-compatibility-report.md)
- [main-skill treatment arm](evidence/workflow-skill-evaluation/main-compatibility-treatment-arm.json)

### 12. Iteration 3: require a real compatibility boundary

Date: 2026-09-02

This was the second predeclared generic hypothesis.
The hypothesis addressed the unavailable local test suite.

The added rule said:

> If the intended suite cannot run, inspect existing constructors, fixtures, and consumers, then exercise the smallest real boundary available. Do not treat a hand-built stub of the new representation as compatibility proof.

The rule remains repository-neutral.
It names no task, test, representation, or known solution.
The bundle digest was `sha256:446167e39c10f8545476f0da8c28840fa57f66a8c5c2c828436558ccce5dabb0`.

Run: `pluginbench/runs/20260902-workflow-v2-pytest-repair-real-boundary/20260902T211309Z-workflow-pytest-repair-canary`

| Arm | Repairs | Total cost | Total duration |
| --- | ---: | ---: | ---: |
| Reused no-skill baseline | 0 of 3 | $0.2904 | 978.6 seconds |
| Real-boundary treatment | 2 of 3 | $0.3526 | 1,159.2 seconds |

The treatment produced a 66.67 percentage-point repair-rate lift.
It repaired two attempts and left one attempt as an unchanged failure.

The treatment added 21.42% nominal cost.
It added 18.46% aggregate duration and 1,122,844 tokens.
Its incremental nominal cost per additional successful task was $0.0622.

PluginBench marked the treatment `not_justified`.
The repair-rate gate passed.
The cost gate failed because the overhead exceeded 20% by 1.42 percentage points.

This result supports the generic boundary hypothesis on the canary.
It does not pass the provisional efficiency threshold.
It also needs the passing-patch preservation control and an untouched holdout.

Evidence:

- [real-boundary report](evidence/workflow-skill-evaluation/real-boundary-repair-report.md)
- [real-boundary treatment arm](evidence/workflow-skill-evaluation/real-boundary-repair-treatment-arm.json)

### 13. Real-boundary preservation control

Date: 2026-09-02

Run root: `pluginbench/runs/20260902-workflow-v2-pytest-preservation-real-boundary`

Observed run child: `20260902T213301Z-workflow-pytest-preservation-control`

The run used the verified passing seed with `expected_score: 1`.

| Arm | Preservations | Regressions | Total cost | Total duration |
| --- | ---: | ---: | ---: | ---: |
| No supplied skills | 3 of 3 | 0 | $0.2501 | 944.7 seconds |
| Real-boundary treatment | 3 of 3 | 0 | $0.4111 | 1,272.7 seconds |

Both arms preserved all three attempts.
Neither arm regressed the known-correct patch.

The treatment added 64.36% nominal cost and 3,145,792 tokens.
It added 34.72% aggregate duration.
PluginBench marked the treatment `not_justified` because the cost gate failed.

This is the key overprocessing result on already-correct work.
The treatment did not improve the preservation outcome.
It still spent much more time and model resources to reach that same outcome.

The repair lift therefore has a material operating cost.
A useful workflow must retain the compatibility signal while bounding its work.

Evidence:

- [preservation report](evidence/workflow-skill-evaluation/real-boundary-preservation-report.md)
- [preservation treatment arm](evidence/workflow-skill-evaluation/real-boundary-preservation-treatment-arm.json)

### 14. Iteration 4: bounded real boundary

Date: 2026-09-02

Iteration 4 replaces the two earlier compatibility paragraphs with one bounded rule.
The new rule says:

> If the intended suite cannot run, verify one real existing producer-to-consumer path that must remain compatible. Do not treat a hand-built stub of the new behavior as proof.

The rule keeps the real-boundary requirement.
It limits the fallback to one existing producer-to-consumer path.
It also removes the broader instruction to inspect constructors, fixtures, and consumers.

The hypothesis is that this wording retains repair value with less overprocessing.
The snapshotted bundle digest is `sha256:16f30a5554a0d209b314c87d1e6c0fb56967f8b3d455e9f8e492ddf0b06f55cd`.

Run root: `pluginbench/runs/20260902-workflow-v2-pytest-repair-bounded-boundary`

Observed run child: `20260902T221044Z-workflow-pytest-repair-canary`

| Arm | Repairs | Total cost | Total duration |
| --- | ---: | ---: | ---: |
| Reused no-skill baseline | 0 of 3 | $0.2904 | 978.6 seconds |
| Bounded-boundary treatment | 0 of 3 | $0.3202 | 1,114.6 seconds |

The treatment added 10.25% nominal cost and 722,982 tokens.
It added 13.90% aggregate duration.
It stayed within the 20% cost ceiling but produced no repair-rate lift.

PluginBench marked the treatment `justified`.
The generic configured gates accepted zero correctness lift and the bounded cost.
The product correctness gate rejects this result.

The bounded wording removed the earlier repair signal.
This one-task result cannot prove why.
It shows that shortening a useful-looking rule can change its observed effect.

Evidence:

- [bounded-boundary report](evidence/workflow-skill-evaluation/bounded-boundary-repair-report.md)
- [bounded-boundary treatment arm](evidence/workflow-skill-evaluation/bounded-boundary-repair-treatment-arm.json)

### 15. Loop decision and rollback

Date: 2026-09-02

No experimental rule met the complete promotion contract.

- The main-skill compatibility checkpoint repaired zero of three attempts.
- The real-boundary rule repaired two of three attempts but failed the cost ceiling.
- The same rule added 64.36% cost when both arms preserved all correct patches.
- The bounded replacement stayed within the cost ceiling but repaired zero of three attempts.

The experiment therefore promoted no candidate.
The holdout did not run because the promotion gate failed.
This avoided tuning another task against a candidate that had already failed its gate.

The experimental sentence was removed entirely.
The current Workflow skill tree is byte-identical to the initial run snapshot.
`diff -rq` produced no output for those two trees.

The restored digest is `sha256:60655c931c5dd11ffcfa5179de459102cd2ff26f9247bb56a00f6f160936aad2`.
`node tests/workflow/validate-contracts.mjs` passed after the rollback.

### 16. Post-loop evaluation corrections

The independent review found that the exploratory repair config allowed zero
pass-rate lift. This made PluginBench label two cheaper but ineffective
treatments `justified`.

The repair config now requires a strictly positive pass-rate lift of 0.01
percentage points. Historical reports retain their snapshotted configuration,
so their original machine decisions remain reproducible. The product decisions
in this notebook do not change.

The checked-in configs are three-attempt pilots. They support fast iteration,
but they cannot satisfy the final rule of four repairs in five attempts. A
candidate that passes the pilot needs a frozen five-attempt promotion config.

PluginBench's machine decision uses task-level pass-rate lift. It does not
enforce per-attempt repair rate or the zero-regression preservation gate. Treat
the machine decision as a pilot filter. Apply the 4-of-5 repair and 3-of-3
preservation product gates separately until PluginBench supports those decision
inputs directly.

The config's skill path is only a local fallback. Every recorded study must pass
the exact treatment with `--skill` and verify the resolved digest before the
paid run. See the [canary runbook](https://github.com/filipgutica/pluginbench/blob/main/benchmarks/workflow-pytest-canary/README.md).

### 17. Iteration 5: adaptive v2.1 and a task-capable runtime

Date: 2026-09-02 to 2026-09-03

Run root: `pluginbench/runs/20260902-workflow-v2-1-task-runtime-repair`

Observed run child: `20260903T055005Z-workflow-pytest-repair-canary`

The earlier agent runtime did not include the Pytest task dependencies.
This prevented the agent from running the focused test before the official verifier.

The new native runtime used image ID
`sha256:a2ac9c1f0e1076698ebff9249f28d886c6c3c885545bbd02e35ad10db86ef65d`.
The local tag was `pluginbench-pytest-5787-native:0.1.1`.
PluginBench temporarily used that image through the configured `pluginbench-runtime:0.2.0` tag.

The image used Python 3.9 and the pinned task dependencies from the official task image.
It also included the existing native Codex and Promptfoo runtime.
A startup helper exposed the mounted workspace source and generated Pytest version metadata.
The [runtime recipe](evidence/workflow-skill-evaluation/pytest-5787-runtime/README.md) preserves the build inputs.

The agent runtime passed this focused environment check:

```text
python -m pytest testing/test_reports.py::TestReportSerialization::test_xdist_report_longrepr_reprcrash_130 -q
1 passed in 0.03s
```

The official verifier still used the pinned SWE-bench task image.
This kept final correctness separate from the custom agent runtime.

#### Candidate

The v2.1 candidate added these rules:

- use a short fast path before workflow escalation
- prefer the nearest existing test before a new test
- name the new invariant and one preserved behavior
- load only one task reference before escalation
- stop repeated commands and unbounded tool searches
- delay delegation and review until deterministic evidence passes
- use a bounded fallback when the focused suite cannot run

The candidate digest was
`sha256:5fbbba4d619231af11baa81678c69d9de9f05e8bd6ab68ac7a352df92b829ecd`.

This canary changes a serialized compatibility boundary.
The task was designed to trigger the candidate's escalation path.
This run targets the high-risk path, not the ordinary fast path.

#### Result

The run used five fresh attempts in each arm.
It kept the task, seed, model, reasoning, timeout, runtime, and verifier fixed.

| Metric | No supplied skills | Adaptive v2.1 | Change |
| --- | ---: | ---: | ---: |
| Repairs | 5 of 5 | 4 of 5 | -20 points |
| Total cost | $0.4494 | $0.7064 | +57.18% |
| Cost per repair | $0.0899 | $0.1766 | +96.48% |
| Total duration | 1,746.9 seconds | 2,328.4 seconds | +33.28% |
| Median cost | $0.0924 | $0.1535 | +66.04% |
| Median latency | 313.6 seconds | 452.7 seconds | +44.39% |
| Median reported tokens | 1,082,722 | 2,459,017 | +127.11% |
| Median commands | 22 | 29 | +31.82% |
| Median failed commands | 6 | 5 | -16.67% |
| Median file-change events | 3 | 2 | -33.33% |
| Attempts that spawned a reviewer | 0 of 5 | 4 of 5 | +4 attempts |

The candidate produced four confirmed repairs.
The fifth attempt did not have a determinate verifier result.
This study does not treat the run as a clean four-of-five gate.
It also did not match the baseline repair rate.
PluginBench classified the third treatment attempt as an unchanged failure.
The verifier recorded the reason as ambiguous `no_tests_collected`.

The trajectory also showed incomplete progressive disclosure.
All five treatment attempts read the delegation and review reference.
Three attempts also read the testing and debugging reference.
No attempt read the verification tools reference.

Four treatment attempts spawned an independent reviewer.
Three reviewers completed and reported no action-required findings.
The fourth reviewer did not return a result before the agent closed it.
No baseline attempt spawned a reviewer.

The candidate reduced median failed commands and file-change events.
It increased median commands, tokens, latency, and cost by larger amounts.
The added stop rules did not create a smaller high-risk trajectory.

PluginBench marked the treatment `not_justified`.
The candidate failed the 20% efficiency ceiling.
The study did not run preservation or the holdout.

The candidate changes were removed after the run.
The restored skill tree matches the initial v2 snapshot.
`node tests/workflow/validate-contracts.mjs` passed after the rollback.

Evidence:

- [adaptive v2.1 report](evidence/workflow-skill-evaluation/adaptive-v2-1-repair-report.md)
- [adaptive v2.1 baseline arm](evidence/workflow-skill-evaluation/adaptive-v2-1-repair-baseline-arm.json)
- [adaptive v2.1 treatment arm](evidence/workflow-skill-evaluation/adaptive-v2-1-repair-treatment-arm.json)

#### Interpretation

The result does not show that an adaptive workflow cannot work.
It shows that this candidate added instruction weight without controlling the high-risk path.

The automatic review route was active during the observed overhead.
The agent loaded the review procedure in every treatment attempt.
It also started a reviewer in four attempts without a recorded correction.
The trace contains three completed reviewer outputs.
The study did not isolate the review cost from other treatment work.

A next candidate should remove workflow branches from the repair path.
It should use one short loop and one explicit stop condition.
Another task must test the true fast path before any general claim.

### 18. Iteration 6 protocol: subtractive v2.2

Date: 2026-09-03

This iteration tests whether a smaller engineering skill can keep task correctness
without the v2.1 review and reference overhead.

The study reuses the compatible five-attempt baseline from iteration 5.
It keeps the task, seed, prompt, model, reasoning, timeout, runtime, and verifier fixed.
Only the supplied Workflow skill bundle changes.

The first treatment is a minimal activation control.
Its engineering skill contains only the outcome, smallest-change rule, focused-test rule,
and final-diff rule.
It is a diagnostic treatment and cannot become the released skill.

Run the micro-skill treatment only if the activation control meets all these gates:

- at least four confirmed repairs in five attempts
- no indeterminate verifier result
- no unexplained unrelated file change
- no more than 20% median cost overhead against the reused baseline
- no more than 20% median duration overhead against the reused baseline

The second treatment is one short existing-change loop.
It tests the nearest existing check first, changes the production owner, reruns that check,
inspects the final diff, and stops.
It adds a new test only when new behavior has no suitable coverage.
It loads another procedure only for a blocked check or a material unresolved contract.
It requests independent review only for residual judgment or an explicit user request.

Promote the micro-skill to the preservation control only if it meets all these gates:

- it meets every activation-control gate
- it does not reduce the confirmed repair count from the activation control
- it does not change a correct existing test without proof that the test is wrong

Promote the micro-skill to Workflow only if it then preserves three of three passing seeds.
Otherwise, restore the initial v2 bundle with digest `sha256:60655c...`.

This task is an efficiency and regression canary because the compatible baseline repaired five of five attempts.
It cannot show a correctness lift above that ceiling.
An untouched mid-difficulty task must test correctness lift before a general effectiveness claim.

#### Activation-control result

Run root: `pluginbench/runs/20260903-workflow-v2-2-minimal-control`

Observed run child: `20260903T135847Z-workflow-pytest-repair-canary`

The activation-control digest was
`sha256:d15a02760dbe8fe4ff53b3e197e827b78f7cac0ef751636227036014ed43651a`.

| Metric | No supplied skills | Minimal control | Adaptive v2.1 |
| --- | ---: | ---: | ---: |
| Confirmed repairs | 5 of 5 | 4 of 5 | 4 of 5 |
| Total cost | $0.4494 | $0.4759 | $0.7064 |
| Total duration | 1,746.9 seconds | 1,725.7 seconds | 2,328.4 seconds |
| Median cost | $0.0924 | $0.1001 | $0.1535 |
| Median latency | 313.6 seconds | 295.0 seconds | 452.7 seconds |
| Median reported tokens | 1,082,722 | 1,307,070 | 2,459,017 |
| Median commands | 22 | 25 | 29 |
| Median failed commands | 6 | 6 | 5 |
| Median file-change events | 3 | 2 | 2 |
| Attempts that spawned a reviewer | 0 of 5 | 0 of 5 | 4 of 5 |

The minimal control added 5.90% total cost and reduced total duration by 1.21%.
Its median cost increased 8.28%, and its median latency decreased 5.91%.
Both measures met the 20% efficiency ceiling.

Median reported tokens increased 20.72%.
Median commands increased 13.64%.
Median file-change events decreased 33.33%.
The median first test command moved from the fourth command to the seventh.

All five attempts loaded only the engineering skill.
No attempt loaded a reference or started an independent reviewer.
The control therefore removed the reference and review activity observed in v2.1.
It does not attribute all v2.1 cost to review.

The fifth outcome requirement did not pass.
The verifier recorded four repairs and one ambiguous `no_tests_collected` result.
The ambiguous attempt passed all `FAIL_TO_PASS` tests.
It failed one `PASS_TO_PASS` test: `TestReportSerialization::test_deserialization_failure`.
The verifier recorded no infrastructure error.
The ambiguous attempt changed only `testing/test_reports.py` after the supplied patch.
It made no additional change to the production owner in `src/_pytest/reports.py`.
Do not relabel this ambiguous official result as a confirmed repair or failure.

PluginBench marked the treatment `not_justified`.
The product gate also failed because the verifier result was indeterminate.
The micro-skill, preservation control, and holdout did not run.

The minimal control was removed after the run.
The restored skill tree matches the initial v2 snapshot.
The shared `pluginbench-runtime:0.2.0` tag also matches its pre-run image.
`node tests/workflow/validate-contracts.mjs` passed after the rollback.

Evidence:

- [subtractive v2.2 report](evidence/workflow-skill-evaluation/subtractive-v2-2-activation-control-report.md)
- [subtractive v2.2 trace metrics](evidence/workflow-skill-evaluation/subtractive-v2-2-activation-control-trace-metrics.json)
- [subtractive v2.2 treatment arm](evidence/workflow-skill-evaluation/subtractive-v2-2-activation-control-treatment-arm.json)

#### Interpretation

Instruction subtraction removed the expensive review and reference route.
It kept cost and latency near the no-skill baseline.
It did not make the agent consistently repair the production contract.

The ambiguous trajectory accepted the supplied implementation and changed an existing test.
This is the exact behavior that the preregistered micro-skill rule targets.
The control gate still failed, so this iteration cannot promote or test that rule.

A new preregistered iteration can test the already-defined micro-skill directly.
It must keep the production-owner rule and the correct-existing-test rule together.
An untouched task must test whether those general rules transfer.

### 19. Iteration 7 protocol: micro engineering loop

Date: 2026-09-03

This iteration tests the micro-skill that iteration 6 defined before its control result.
The candidate adds no task, repository, language, or known solution detail.

The study reuses the compatible five-attempt baseline from iteration 5.
It keeps the task, seed, prompt, model, reasoning, timeout, runtime, and verifier fixed.
Only `engineering/SKILL.md` changes in the supplied Workflow bundle.

The candidate uses this loop:

1. Inspect the requested contract, supplied change, production owner, and nearest existing test.
2. Run the nearest existing test before changing code.
3. Fix the production owner before changing a correct existing test.
4. Change a test only when repository evidence proves that its contract is wrong.
5. Add one focused test only when new behavior lacks suitable coverage.
6. Make the smallest causal change without adjacent cleanup or speculative abstraction.
7. Rerun the same test and only the affected existing checks.
8. Inspect the final diff and stop when the contract passes.

The candidate can load another procedure only when a check cannot run or the contract remains materially ambiguous.
It can request independent review only when deterministic checks leave residual public-contract, security, concurrency, or ownership risk.
An explicit user request can also require review.

The repair treatment advances only when all these gates pass:

- five confirmed repairs in five attempts
- no ambiguous, unscored, or infrastructure result
- no unjustified change to a correct existing test
- no unexplained unrelated file change
- no more than 20% median reported-token overhead against the reused baseline
- no more than 20% median cost overhead against the reused baseline
- no more than 20% median duration overhead against the reused baseline

If the repair treatment passes, run three fresh paired attempts against the passing preservation seed.
The preservation treatment must preserve three of three attempts.
It must also meet the same scope and 20% median efficiency gates against its paired baseline.

If either stage fails, restore the initial v2 bundle with digest `sha256:60655c...`.
Do not run the holdout until a compatible runtime exists for that task.

#### Iteration 7 result

The candidate passed both preregistered stages and remains in the Workflow source.
Its skill digest is
`sha256:fee5909ce4068ca04e4b02a8f783f6b47b1986f2e0e90ad17459c8ff0c6fff7a`.

| Gate | Baseline | Candidate | Result |
| --- | ---: | ---: | --- |
| Repair | 5 of 5 | 5 of 5 | Pass |
| Preservation | 3 of 3 | 3 of 3 | Pass |
| Unscored or infrastructure outcomes | 0 | 0 | Pass |
| Candidate repair scope | — | Production owner only in 5 of 5 | Pass |
| Candidate preservation scope | — | Two unchanged; one bounded owner-and-test change | Pass |

The repair stage reused the compatible five-attempt baseline from iteration 5.
The candidate changed only `src/_pytest/reports.py` in every repair attempt.
It did not change an existing test or an unrelated file.

| Repair median | Baseline | Candidate | Change |
| --- | ---: | ---: | ---: |
| Reported tokens | 1,082,722 | 710,306 | -34.40% |
| Nominal cost | $0.09245 | $0.07029 | -23.97% |
| Latency | 313,564 ms | 252,570 ms | -19.45% |
| Commands | 22 | 27 | +22.73% |
| Failed commands | 6 | 3 | -50.00% |
| File-change events | 3 | 2 | -33.33% |
| First actual test command | 4th | 9th | Later |

The repair candidate used 30.32% fewer total reported tokens, cost 28.42% less,
and finished 15.86% faster than the reused baseline.
PluginBench still labeled this stage `not_justified` because its generic rule
requires a positive pass-rate lift above the saturated 5-of-5 baseline.
The preregistered product rule allowed an equally correct and more efficient
treatment to continue to preservation.

The preservation stage used three fresh paired attempts.
Both arms preserved the passing seed in all attempts.
The baseline changed the seed in two of three attempts.
The candidate changed it in one of three attempts.
That candidate attempt fixed a same-owner `reprcrash=None` edge case and added
one focused regression test. The official verifier passed it. No candidate
attempt weakened an existing test or changed an unrelated file.

| Preservation median | Baseline | Candidate | Change |
| --- | ---: | ---: | ---: |
| Reported tokens | 902,194 | 1,061,698 | +17.68% |
| Nominal cost | $0.07640 | $0.08611 | +12.71% |
| Latency | 372,884 ms | 297,081 ms | -20.33% |
| Commands | 30 | 23 | -23.33% |
| Failed commands | 3 | 4 | +33.33% |
| File-change events | 1 | 0 | -100.00% |
| First actual test command | 7th | 10th | Later |

The preservation medians stayed within every 20% efficiency ceiling.
Across all three attempts, the candidate used 9.15% more reported tokens and
cost 3.54% more, but finished 16.52% faster.

All candidate attempts loaded only `engineering`.
Repair attempts 4 and 5 read `delegation-and-review.md` for the public
serialization boundary. No attempt started an independent reviewer.
No preservation attempt loaded a reference.

The shared `pluginbench-runtime:0.2.0` tag was restored after the experiment to
its pre-run image:
`sha256:46f9b2d6cd61403c82d00b26cb280a7e5a598bb4ab5a8688378160bfe0f0a6bf`.
The holdout still did not run because no compatible runtime exists for that task.

Evidence:

- [repair report](evidence/workflow-skill-evaluation/micro-v2-3-repair-report.md)
- [reused repair baseline arm](evidence/workflow-skill-evaluation/adaptive-v2-1-repair-baseline-arm.json)
- [repair treatment arm](evidence/workflow-skill-evaluation/micro-v2-3-repair-treatment-arm.json)
- [preservation report](evidence/workflow-skill-evaluation/micro-v2-3-preservation-report.md)
- [preservation baseline arm](evidence/workflow-skill-evaluation/micro-v2-3-preservation-baseline-arm.json)
- [preservation treatment arm](evidence/workflow-skill-evaluation/micro-v2-3-preservation-treatment-arm.json)
- [trace metrics and scope adjudication](evidence/workflow-skill-evaluation/micro-v2-3-trace-metrics.json)

An independent read-only review found no action-required issue.
It reproduced the repair and preservation gates, median deltas, scope findings,
artifact identity, checksums, and Workflow contract result from the raw runs.
It retained the single-task, saturated-baseline, fixed-order, three-attempt
preservation, proxy-metric, and manual scope-adjudication limits below.

#### Interpretation

This experiment supports promotion of the smaller engineering loop for this
canary. It preserved saturated task correctness, reduced repair cost, tokens,
latency, failures, and edit churn, and passed the separate preservation guard.

It does not demonstrate a correctness lift because the compatible baseline was
already 5 of 5. It also exposes a remaining procedure gap: the candidate reached
its first actual test later than baseline in both stages. The next iteration
should improve early test selection without adding more default ceremony.

This remains directional single-task evidence. General effectiveness requires
untouched tasks, compatible runtimes, randomized arm order, and repeated paired
attempts across task families.

### 20. Iteration 8 protocol: successful-patch quality

Date: 2026-09-03

This experiment asks whether Workflow produces simpler accepted solutions when
correctness is equal. It reuses the five resolved no-skill repairs from
`20260903T055005Z-workflow-pytest-repair-canary` and the five resolved v2.3
repairs from `20260903T153142Z-workflow-pytest-repair-canary`.
No new model generation is required for the first analysis.

The unit of analysis is one official-verifier-resolved `agent-change.diff`.
That artifact contains only the agent's change after the identical failing
starting patch. The starting implementation is excluded from patch-size and
structure comparisons.

Correctness is a hard inclusion gate.
An unscored, unresolved, or infrastructure-failed attempt is not a quality
observation. Compare quality only when both arms have resolved attempts for the
same task. Do not let a smaller incorrect patch outrank a larger correct patch.

The analyzer reports these measures separately:

- files changed and changed paths
- total, production, and test lines added and removed
- changed tests versus production-only changes
- added imports and dependency-manifest changes
- added functions, classes, and single-use local helpers
- Python AST decision-point change as a transparent complexity proxy
- added calls to local symbols that existed before the agent change as a reuse proxy
- new helpers called at least twice
- duplicate bodies among new helper functions

The evaluator does not know the task owner. A manual review must classify changed
paths as required, allowed, or unrelated. The evaluator also does not detect
general repeated code or produce deterministic review flags.

The first pilot has these hypotheses:

1. The v2.3 arm keeps the same 5-of-5 official result.
2. Its median production churn is no greater than baseline.
3. Its median decision-point increase is no greater than baseline.
4. It adds no more dependency, public surface, or single-use-helper churn.
5. It has no more task-scope violations or deterministic review flags.
6. Reuse signals are reported, but no generic reuse claim is made when the task
   has no annotated reuse opportunity.

Do not combine these measures into one weighted quality score.
Fewer lines are not automatically better, and an added focused test or necessary
branch can improve a patch. Report the distribution, inspect outliers, and keep
the official verifier result beside every quality observation.

Attempt numbers identify artifacts. They do not share a model seed or another
randomization block across arms. Do not interpret equal attempt numbers as a
statistical pair.

Raw generation tokens are descriptive, not a promotion ceiling for this study.
The product metric is total effort to an accepted patch:

```text
initial implementation
  + review or acceptance checks
  + correction attempts
  + re-verification
```

The reused runs measure only the initial implementation and deterministic patch
quality. They cannot measure actual human review time or correction turns.
A later correction-loop experiment can feed deterministic acceptance failures
back to each arm and compare total turns, tokens, cost, and elapsed time until
acceptance. Automated reviewer opinions remain an uncalibrated proxy and cannot
substitute for a small human-adjudicated sample.

#### Iteration 8 result

Date: 2026-09-03

The evaluator found five complete attempt artifacts in each arm. Both arms
passed all five official verifier attempts. The quality population therefore
included all five attempt alignments.

| Measure | Baseline | v2.3 | Result |
| --- | ---: | ---: | --- |
| Official repairs | 5 of 5 | 5 of 5 | Equal correctness |
| Median total churn | 10 | 7 | Lower candidate median |
| Median production churn | 8 | 7 | Lower candidate median |
| Total churn range | 7 to 22 | 4 to 27 | Overlapping distributions |
| Median decision-point change | 1 | 1 | Equal |
| Attempts that changed a test file | 2 of 5 | 0 of 5 | Candidate was narrower |
| New dependencies | 0 | 0 | Equal |
| New top-level public symbols | 0 | 0 | Equal |
| New single-use helpers | 0 | 0 | Equal |
| New helpers called at least twice | 0 of 5 | 1 of 5 | One candidate reuse signal |

The candidate passed the fixed no-greater median churn and complexity hypotheses.
It also added no dependency, public surface, or single-use helper churn.
Manual scope review found no unrelated paths in either arm. Two baseline attempts
added assertions to the existing task test. Those assertions were in scope and
were not automatically classified as slop.

The evaluator did not test hypothesis 5 automatically. It has no owner classifier
or deterministic review flags. The manual path review supplied only the scope
result for this pilot.

The result does not show a consistent simplicity improvement. One candidate
attempt had 27 churn lines, which exceeded the baseline range. That attempt added
no decision point and introduced one helper that it called twice. This example
shows why line count cannot replace structural review.

The evaluator does not read AST data unless the saved patch matches the workspace.
It excludes test files from production structure metrics. A parse failure makes
AST metrics unavailable instead of producing a favorable zero. The evaluator
also keeps resource metrics in the existing PluginBench report.

This is directional evidence for narrower median patches. It is not evidence of
less human review or fewer correction turns. A correction-loop study must measure
all tokens and time from the initial attempt through accepted re-verification.

Evidence:

- `docs/evidence/workflow-skill-evaluation/micro-v2-3-successful-patch-quality/quality-report.json`
- `docs/evidence/workflow-skill-evaluation/micro-v2-3-successful-patch-quality/quality-report.md`
- `docs/evidence/workflow-skill-evaluation/micro-v2-3-repair-report.md`

### 21. Design language guidance probe

Date: 2026-11-04

This study asks whether the design-language change that adds Forms, Data views,
and two named breakpoints makes agents build those pages more consistently.
The design language is host config, not a Workflow skill, so `pnpm eval:routing`
does not apply.

The protocol compares base and head `host-config/design-language/` on three fixed
briefs: a settings form, a data table, and a docs landing page. Each probe is
built standalone and on the library stack, with 3 attempts per arm. Objective
browser scores come first; blind screenshot judges are diagnostics only.

No dry run started. PluginBench at `c6a6909` measures only the four reviewed
DeepSWE verifier contracts, has no browser collector, and delivers guidance as
one `AGENTS.md`, not as a host directory with sibling examples. A dry run would
admit tasks that cannot produce one objective score.

The paid run needs 36 coding attempts, or 54 with PluginBench's automatic
vanilla arm, plus about 54 judge calls. The nominal estimate is at most about $12
and is an assumption until a dated price table exists.

The study plan, the gap evidence, the smallest PluginBench additions, and the
cost estimate are in `docs/evidence/design-language-probe/study-plan.md`.

#### First run: one-off probe without PluginBench (2026-11-04)

Filip approved a one-off run outside PluginBench in place of the dry run. It
built the standalone probes only: 3 probes x 2 arms x 3 attempts = 18 pages,
with Codex `gpt-6.1-sol` at high reasoning through `delegate_task`. Each build
read its arm from a randomly named folder. Base was `754754a` and head was
`c68ccd0`. A Playwright script scored every page against rules written before
the first build. Then 27 blind judge calls (Astra, Sol 6.1, Opus 5.5) compared
the 9 base and head pairs from screenshots. All 45 member calls succeeded, with
no retries and no unread judge files.

Result: **not supported.** Head was worse on the data table: 1 page overflow
against 0, and 5 border colors against 4. Judges preferred base in all 3
probes (head won 2, 1, and 0 of 9 overall votes). Head did follow its breakpoint
rule, with only 640 and 800 px in all 9 builds; base used 420 and 760 px in 4
builds. The two arms tied on undefined variables, contrast, forced-colors focus,
and form and table probe checks. Neither arm marked the current docs section.
After the judges, a check found that all 3 head docs builds set body prose in
`--text-muted`, which explains most docs votes.

Validity limits: 3 attempts per cell, judges without reference docs, two base
builds that also read the host design-language guidance, and no
library-stack build.

Report and per-build tables:
`docs/evidence/design-language-probe/probe-run-2026-11-04.md`. Screenshots,
pages, scorer, and the arm ledger:
an external study archive (not retained in this repository).

#### Second run: larger sample without leakage (2026-11-04)

Filip approved a second one-off run that fixed run 1's flaws: 8 attempts per
probe and arm (48 builds) with the same builder, base, head and briefs. Each
build read one bundle file holding its arm's `DESIGN.md`, `tokens.css` and
example pages, and the prompt said to use only that file for design rules.
Inline delivery was dropped because `delegate_task` takes only a task string.
No build read any other guidance path or skill, so none was replaced. Judges got
the `DESIGN.md` sections that are identical in both arms, and 72 blind calls
(Astra, Sol 6.1, Opus 5.5) compared the 24 pairs. Two measures were added
before the first build: phone table clipping at 390 px (a decision measure)
and the muted share of body text (a diagnostic).

Result: **not supported.** Head was worse on the data table (page overflow 1
vs 0, phone table columns 6 vs 0) and on the docs page (failed probe checks 5
vs 4). Judges preferred base in all 3 probes, and Opus alone did too. Head
used only 640 and 800 px in all 24 builds, against 11 of 24 base builds with
other widths. The breakpoint change alone holds on the widths but fails the
pre-registered test, because the table regressions count against it. The
breakpoint table's Tablet row also tells side navigation to become a scrolling
strip, and all 8 head docs rails then clipped at phone width. A smaller PR
would ship the widths without that line and needs its own run.

Diagnostics measured after the judges: all 8 head tables put their state
messages in a row across a wide table, as head's Data views section asks, and
at 390 px those messages run past the scroll wrapper. All 8 head docs rails
scroll sideways at 800 px, where base rails wrap. Muted prose appeared in 7 of
8 docs builds in both arms, copied from the shared `docs.html`, so run 1's
head-only pattern did not repeat.

Report and per-build tables:
`docs/evidence/design-language-probe/probe-run-2-2026-11-04.md`. Pages,
screenshots, scorer, ledgers and votes:
an external study archive (not retained in this repository).

On 2026-11-05 PR #96 was narrowed to the two widths, the container query, and
the example-page changes. It drops the Forms and Data views sections and the
Tablet row's scrolling-strip line, and keeps base's optional navigation
wording. The narrowed change has not had its own run.

### 22. Reader pages writing probe: dry runs, paid result, and B3 rerun

Date: 2026-11-04

Both studies were **not supported**. [PR #99](https://github.com/filipgutica/filip-stack/pull/99) closed unmerged. The tested guidance is not on `main`. Only the study record is retained here. Raw per-call files remain at [its head commit](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/).

This study asks whether new writing guidance makes agents write reader pages
that a first-time reader understands better, with no loss of facts. The
guidance is a technical-writing [reader-pages.md reference](https://github.com/filipgutica/filip-stack/blob/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/plugins/workflow/skills/technical-writing/references/reader-pages.md), its pointer, the
technical-prose edits, and matching host-config and cli-tool-template lines. It
comes from a writing audit of Filip's project pages.

The probe runs outside PluginBench. It hands each builder its arm's guidance as
one randomly named file, so it measures what the guidance says, not whether a
host routes to it. `pnpm eval:routing` covers routing separately.

Arms are vanilla (no guidance), base (`origin/main`), and head (the guidance
commit). Briefs are four fictional subjects, so the head examples cannot leak
answers. The decision rule was fixed before any build: no harm to fact recall
or invented facts, an objective gain on at least 2 of 5 reader measures on 3 of
4 briefs, and a judge majority for head on 3 of 4 briefs, against base and
against vanilla.

The dry run used 1 attempt per arm on one brief, a tool landing page: 3 builds,
3 extractor calls, 3 comprehension calls, and 6 judge calls. All 15 returned
usable output with no retries. Each builder trace shows one read: its own arm
file.

The pipeline works. The single brief gives no verdict, but it gives one strong
diagnostic. The head build kept all four agent-only facts in a "Good to know"
section. Base kept two and vanilla one. All six judges preferred the other arm
over head, and every judge's reason named those internals. Fact recall,
invented facts, the opening job statement, and comprehension were equal across
arms.

Hypothesis: the reader-pages check that every source fact stays on the page
worked against its own rule to write for the reader.

Dry run 2 tested that hypothesis at n=1. The revision rescoped the check to
facts the reader needs, and R7 now leaves maintainer and agent facts off the
page, notes sections included. The same 15 calls ran on the same brief, with
judge A/B order balanced and `role: general` on every call. The head page
leaked no agent-only facts and kept every reader fact. No judge cited internals
on the head page. Judges preferred base over head 2 of 3, and head over
vanilla 2 of 3. The head page was shorter, and two judges preferred base's
worked example and separate Keys section.

The extractor marked a base leak in a Good to know section as a sources note,
so M3 undercounts leaks in notes sections. Fixing that definition changes a
measure after a result, so it waits for Filip's decision.

One attempt per arm is a smoke test, not evidence. Filip approved the paid run on 2026-11-05.

#### Dry run 3 and paid run (2026-11-05)

Main `0fc048d4` was merged into the PR as `f6997da1`, preserving studies 21
and 22, main's breakpoint and visualization content, and G1–G7. Dry run 3
rebuilt both arms and completed 15 calls without retries. Every build read
only its own arm, and the scorer succeeded.

The paid run completed all 312 calls: 60 builds, 60 primary extractions,
60 comprehension calls, 12 second extractions, and 120 blind judges. It used
four briefs, three arms, and five attempts. Maximum concurrency was eight,
and there were no retries. All 60 build traces read only their assigned arm
file. Scorer and arm hashes stayed fixed. Double-coding agreed on every
measured fact and opening field; one sentence-count difference left M6 unchanged.

Result: **not supported**. No harm passes against both controls on all four
briefs. Objective gain passes against base on all four, with no M3/M4
regression. Judges prefer head on three briefs against each control, but B3
has opposing majorities, so part 3 fails against both.

| Brief | No harm, base / vanilla | Better measures vs base | Head–base votes | Head–vanilla votes |
| --- | --- | --- | --- | --- |
| B1 | pass / pass | M3, M9 | 9–6 | 11–4 |
| B2 | pass / pass | M3, M4, M5, M6 | 11–4 | 14–1 |
| B3 | pass / pass | M5, M6 | 7–8 | 5–10 |
| B4 | pass / pass | M3, M4 | 12–3 | 11–4 |

Votes are overall head–control counts, 15 per pairing. Twenty-two of B3's
30 judge reasons mention Node.js, often preferring the fail-open caveat beside
the opening claim rather than under Codex. This is a diagnostic, not a proven
cause. Routing evaluation was not run, and at the time of this run the PR remained a draft. No guidance
was revised after the result. A revision to one guidance rule and a B3 rerun are separate work.

The existing clarifications remain: balanced judge order, Yes/No formatting,
and no M5 on B4. Neither proposed change to notes-section leakage or the B1
fragment count was applied. Global host guidance remains a shared confound.
The orchestrator automatically delivered replies into the parent; the runner
did not print them. Actual token usage and billed cost remain unverified.

#### One-rule B3 rerun (2026-11-05)

Filip approved the preregistered selective rerun. R4 alone now keeps a caveat
beside its qualifying claim and places a caveat spanning subsections in their
shared introduction. The revision is local commit `982af5e0`; the reference is
1,096 words. The first normal push was blocked by session execution policy,
so the rerun built that local commit. Publication remains incomplete.

Only five new head pages were built. B3's ten paid-run control pages and their
scores were reused. The unchanged 20% sampling added one head second
extraction, and all 30 B3 judge calls ran anew in balanced A/B order. All 46
new calls completed without retries, with at most eight concurrent calls.
All build reads stayed within their assigned arm; all 41 scoring traces had
no commands. Frozen hashes, effective settings, and prompt text match.

Result: **not supported**. B3 head loses 4–11 to base and beats vanilla 12–3.
No harm passes against both controls. B3 improves only M5, while its fragment
rate worsens from base's 0.222 to 0.643. The new head preserves every reader
fact, invents none, and scores 15 of 15 on comprehension. Every new page puts
the shared caveat in the opening. Judge reasons now often discuss whether
the trust instruction belongs before or after installation and whether labels
are consistent; those reasons do not establish causation.

Combining new B3 with saved B1, B2, and B4 passes objective gain on three of
four briefs, with no M3/M4 regression. Part 3 still fails against base because
B3 has an opposing majority. The required vanilla comparison now passes.
B1, B2, and B4 were not rerun under the revised rule, so regression there is
untested. No second revision, routing evaluation, merge, or ready action ran.
Actual tokens and billed cost remain unverified. At the time of this run the PR remained a draft.

Evidence:

- [docs/evidence/reader-pages-probe/b3-rerun-report.md](evidence/reader-pages-probe/b3-rerun-report.md)
- [docs/evidence/reader-pages-probe/b3-rerun/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/b3-rerun/)
- [docs/evidence/reader-pages-probe/prereg.md](evidence/reader-pages-probe/prereg.md)
- [docs/evidence/reader-pages-probe/dry-run-3-report.md](evidence/reader-pages-probe/dry-run-3-report.md)
- [docs/evidence/reader-pages-probe/paid-run-report.md](evidence/reader-pages-probe/paid-run-report.md)
- [docs/evidence/reader-pages-probe/paid-run/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/paid-run/)
- [docs/evidence/reader-pages-probe/dry-run-report.md](evidence/reader-pages-probe/dry-run-report.md)
- [docs/evidence/reader-pages-probe/dry-run-2-report.md](evidence/reader-pages-probe/dry-run-2-report.md)
- [docs/evidence/reader-pages-probe/dry-run-2/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/dry-run-2/)
- [docs/evidence/reader-pages-probe/dry-run/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/dry-run/)
- [docs/evidence/reader-pages-probe/scorer/](evidence/reader-pages-probe/scorer/)

### 23. Reader pages writing probe: narrowed scope

Date: 2026-11-05. Filip approved a narrowed probe of at most 250 calls.

Both studies were **not supported**. [PR #99](https://github.com/filipgutica/filip-stack/pull/99) closed unmerged. The tested guidance is not on `main`. Only the study record is retained here. Raw per-call files remain at [its head commit](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/).

Commit `c926026b` narrows reader pages to tool and product landing pages,
skill pages, and the opening of a guide or lesson. Procedure and reference
sections follow technical prose instead. It also reverts the B3 rerun's R4
caveat sentences. The `SKILL.md` pointer is unchanged. The reference is 1,093
words.

The pre-registration fixed three new briefs, all fictional: N1 is a tool
landing page, N2 a skill page, and N3 a lesson opening. A fresh read-only Sol
6.1 call wrote them. The design was 5 attempts per arm, and the rule needed
2 of 3 briefs for parts 2 and 3. A dry run on N1 found one pipeline fault,
and the fix was amended into the pre-registration before any paid build. The
paid run made all 234 registered calls with no retries.

Five Sol 6.1 scoring calls on N2 failed: their file reads stalled, and they
replied that they could not read the file. The pre-registration says the run
stops on a failure, but the runner checked only that a reply existed, so
dispatch went on through the judges. No call was retried, because the
ceiling left 2 calls and completing N2 needed 5. The frozen scorer cannot
parse the failed replies. `partial.py` reused its functions and bounded the
rule over the missing cells.

Result: **not supported**. Against base, head passes no harm and judge
agreement on all three briefs (10–5, 11–4, 10–5). Objective gain is
undetermined, because it depends on the missing N2 cells. Against vanilla,
vanilla wins N1 14–1, so part 3 fails. That part uses only judge votes, so
the missing cells cannot change it. On N1, head beats vanilla on the opening
statement (5 vs 1) and comprehension (15 vs 10), but the judges still
preferred vanilla. All five vanilla N1 pages have an install heading; no head
page does. This is a diagnostic, not a cause. Calls total 248 of 250; the
pre-registration amendment's 249 was off by one.

Evidence:

- [docs/evidence/reader-pages-probe/narrow-report.md](evidence/reader-pages-probe/narrow-report.md)
- [docs/evidence/reader-pages-probe/narrow/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/narrow/)

### 24. Guide-body probe

Date: 2026-11-05 to 2026-11-06. [PR #110](https://github.com/filipgutica/filip-stack/pull/110) proposed rules for the bodies of guides and lessons in `technical-prose.md`. It closed unmerged, so the tested guidance is not on `main`; it remains at [`ad12297a`](https://github.com/filipgutica/filip-stack/blob/ad12297a1f81c1388568c206f5b0de10e1cd05b0/plugins/workflow/skills/technical-writing/references/technical-prose.md). Only the study record is retained here. They are written per Diátaxis page type: tutorial, how-to guide, and explanation. The guidance was frozen at `5ba65a18` before any build.

The probe measured reader success instead of judge preference. Each page went to a `gpt-5.6-sol` reader with two frozen tasks. R1 counted tasks passed. R2 counted the words read through the block that states the last fact a task needs. The design had 3 fictional briefs (one per page type) × 3 arms (vanilla, base, head) × 5 attempts. Builds used `gpt-6.1-sol`. Before any build, Sol 6.1, Astra, and Opus 5.5 were calibrated as judges on planted defects in well-regarded docs. A judge counts on a question only where it caught the planted defects without too many false alarms.

Result: **not supported**.

- **Part 1 fails:** against base, head won 2 pairs, lost 8, and tied 5 (sign test p = 0.989).
- **Part 2 fails:** against vanilla, head won 2, lost 6, and tied 7.
- **Part 3 passes:** no harm on every brief.
- **Part 4 fails:** D3 was saturated. Every judge flagged every head and base page for restatement, so the judges could not tell the pages apart.

Task success was near ceiling: head 29/30, base and vanilla 30/30. The pair outcome therefore rested on R2, and head pages put the needed fact later:

- **How-to (G1):** the Kestrel-04 check is the last step of the procedure, at 0.64 of the page. Base puts it at 0.31.
- **Explanation (G2):** head pages state the problem before the defining facts.

The dry run predicted both. Some diagnostics favor head, but none changes the verdict:

- M3 agent-only leaks: head 0, base 27.
- P5 noun strings: 7–0, with all three judges.
- Tutorial endings on what the reader can now do: 5 of 5.

One diagnostic runs against head: M7 near-duplicates were 53 for head and 42 for base.

Two protocol deviations, neither touching parts 1–3:

- From the extractor stage on, the runner sent 10 calls at once, above the cap of 8.
- One judge call had a mistyped path. It was retried without approval, and Amendment 2 is ambiguous on whether it covers that case. The run made 325 calls in all, against an upper limit of 340.

Filip closed the PR. The guidance is not revised or rerun without his approval.

Evidence:

- [docs/evidence/guide-body-probe/prereg.md](evidence/guide-body-probe/prereg.md)
- [docs/evidence/guide-body-probe/calibration.md](evidence/guide-body-probe/calibration.md)
- [docs/evidence/guide-body-probe/results.md](evidence/guide-body-probe/results.md)

### 25. Writing-guidance climb and probe

Date: 2026-11-06. This study followed the addenda: vanilla error analysis first, reader-task success as the main measure, rules per Diátaxis type, and no judging of rule text on its own. A guidance climb under the `score` rule changed `technical-prose.md`. Each version was scored by the pages agents wrote on four fixed briefs with answer keys. Each task scored 0 on a wrong answer; a pass scored 1 − 0.4 × min(depth ÷ word limit, 1). The climb chose its final version on its own briefs, so a pre-registered probe on four fresh briefs decided shipping.

- **Climb:** baseline 78.55, `main` 79.51, round 1 84.88 (accepted), round 2 85.56 (rejected, below the 1.0 bar). Round 1 added a section, "Place answers in documentation pages", with one rule per page type.
- **Final-check scorecard:** two of three judges preferred `main` overall. All three preferred `main` on fit to the page type, because recovery-first tutorials and how-to guides break the reader's working order. The probe's ship rule was tightened before its first build.

Result: **not supported**. The probe made 121 of 135 calls with no retries.

- **Part 1 fails:** head beat base in 11 of 20 pairs (+2.12, sign p = 0.41).
- **Part 2 fails:** head beat vanilla in 14 of 20 pairs (+1.33, p = 0.058).
- **Part 3 fails:** head passed 21 reference tasks against base's 25.

Several head failures were key literalism ("same retained cursor" against a key that needs "same cursor"). A post hoc depth-only check still gives head only 13 of 20 pairs against base. The climb's depth gain did not hold on fresh briefs. `main` keeps its `technical-prose.md`.

Lesson: a reader scored on depth rewards answer-first order, which works against tutorial and how-to sequence. A future placement climb should use the `both` rule.

Evidence:

- [docs/evidence/writing-guidance-climb/card.md](evidence/writing-guidance-climb/card.md)
- [docs/evidence/writing-guidance-climb/prereg.md](evidence/writing-guidance-climb/prereg.md)
- [docs/evidence/writing-guidance-climb/results.md](evidence/writing-guidance-climb/results.md)

### 26. UX guidance probe: pre-registration and dry run

Date: 2026-11-06. Plan and free dry run only; no paid call has run.

The probe asks whether `interface-design` (merged in v4.0.0) improves the UI work agents produce. It compares three arms:

- **vanilla:** no guidance.
- **base:** the guidance it replaced, `ux-laws` before PR #112 plus Anthropic's `frontend-design` at its baseline commit.
- **head:** `interface-design` at `origin/main`.

Claude Opus 5.5 at high effort makes every attempt. There are two tasks:

- **Review:** three static screens with 9 planted defects and some decoys. The score is defects found minus false findings, under a frozen tally rule.
- **Build:** an API keys screen in a fixture app. The gates are `interface-design`'s own `ui-check.mjs` and `ui-modes.mjs`. Astra, Sol 6.1, and Opus 5.5 then judge blind pairs with the hill-climb judge brief and scorecard lines.

Isolation is stricter than in the earlier probes, which recorded host guidance as a shared confound:

- Attempts and Opus judges run `claude -p --safe-mode --restricted` with no setting sources and a clean environment.
- Codex judges run with a scratch `HOME` and `CODEX_HOME`.

The dry run sent each exact command to a local stand-in instead of a model. Results:

- For each task, the first request was identical across the three arms, with no user guidance.
- `--restricted` refused reads of `~/design-language` and `~/.claude`.
- The scorer self-test passed 24 of 24, including Markdown-formatted replies.
- Two reference builds passed both gates, and the bare stub failed `ui-modes.mjs`.

The dry run also changed the design before it was frozen:

- It tightened the tally patterns and made both parsers remove Markdown first.
- It made the validator separate reads that `--restricted` refused from reads that succeeded.
- It moved judge bundles out of the run folder.
- It loosened gate tasks that would fail correct markup.
- It raised the fixture's control borders to 3:1.
- It made three plants less literal.

The planted pages and the answer key stay in local calibration files. Only their sha256 hashes are committed.

The paid run is 72 calls: 60 on Opus 5.5, 6 on Astra, and 6 on Sol 6.1. It waits on Filip's approval and a Codex sign-in to a scratch Codex home.

Evidence:

- [docs/evidence/ux-guidance-probe/prereg.md](evidence/ux-guidance-probe/prereg.md)
- [docs/evidence/ux-guidance-probe/dry-run-report.md](evidence/ux-guidance-probe/dry-run-report.md)

### 27. Two writing rules: preparation and judge-led paid probe

Date: 2026-11-06. This study tested two additions to `technical-prose.md`: start requirements at the entry point, and a complete how-to task path before optional reference. A fresh writer supplied two how-to and two tutorial briefs for fictional CLIs. The head remained an evidence snapshot; no live guidance changed.

Preparation used 23 calls. Base passed 4/4 execution tasks on the original scenarios and again on the single harder rerun. Two instrument repairs preceded paid data: exact citation copying became diagnostic rather than task completion, and truncated `.plan` renewal keys were restored from the original source/checklist. The original diagnostic scores, 1/4 and 0/4, remain in the external run record. Preparation dispatch text exposed the arm label.

Filip then approved a judge-led primary measure, a word-choice/tone control C, and readers only as a no-harm floor. The dated amendment and scorer were frozen at `ba7537e627916feaec1b2aa14b51eab463d7b817` before any paid call. Paid execution built/read 4 briefs × 3 arms × 5 attempts, followed by 24 judge calls: each judge saw one brief's five matched pairs against base or vanilla. Every pair randomized A/B separately. Paid builder/reader dispatches used neutral labels.

Astra, Sol 6.1 and Opus 5.5 each caught 2/2 planted defects with 0/2 clean false alarms on both target items; all were eligible. C had no separate calibration. Pair outcomes use strict judge majorities, with ties contributing half a win.

Result: **neither rule supported**.

- R1: five majority wins, zero losses and fifteen ties against each comparison: **12.5/20 weighted wins** against base and vanilla, below 15. Its margin over C against base was **2.5**, below four.
- R2: twenty majority ties against each comparison: **10/20** against base and vanilla, with a zero margin over C.
- C: twenty majority ties against each comparison: **10/20**. It did not reach the 15/20 blocking threshold.
- Reader no harm passed: head, base and vanilla each completed **20/20** tasks, five per brief. The reader measure remained at ceiling.
- No length flag: mean words were head 395.85, base 396.60 and vanilla 394.05.

Calls: **167/171**, comprising 23 preparation and 144 paid calls; no retries. All 136 new Codex calls used default as explicitly required by the approval, in addition to 21 earlier priority calls. Ten Opus calls served only judge seats. The recorded paid dispatch/completion window was 20:42–21:55 UTC. Peak paid concurrency was three; a separate raw-vote decoding reproduced every aggregate.

Ambient host guidance was not isolated. The four workflows share a strong template; calibration was small and did not directly validate fine-grained ranking or C. The bundled treatment and closed CLI reader rubric limit causal and usability claims. Raw per-call artifacts remain external. No writing rule was shipped or pushed.

Evidence:

- [Pre-registration and approved amendment](evidence/writing-rules-probe/prereg.md)
- [Judge-led results and implementation ledger](evidence/writing-rules-probe/results.md)
- [Aggregate results](evidence/writing-rules-probe/results.json)

### 28. Field Guide evals: preparation and retrieval baseline

Date: 2026-11-06. This study checks whether Field Guide does what it is meant to do. Four layers are planned: first-prompt retrieval, the capture/ask/skip decision, an end-to-end agent check, and an optional PluginBench overhead check. Retrieval goes first. A live first prompt about designing evals injected nothing, although the local store held two evaluation-design records. The prompt shared no terms with them.

- **Retrieval scorer:** a synthetic 36-record store built through the real `init` and `submit` commands. 64 labeled prompts came from a fresh, read-only Codex `gpt-6.1-sol` call that saw the records but no Field Guide code. They split into 32 climb and 32 held-out prompts. The climb set also holds a reworded copy of the live miss, for 33. The scorer reports micro precision, recall, and F1 of `promptInjection`.
- **Retrieval baseline on the climb set** (identical over two runs): precision **22.22**, recall **57.14**, F1 **32.00**. There were 56 false injections across 33 prompts, 19 of them on prompts that need no record. Precision, not recall, is the larger problem.
- **Decision eval:** 44 labeled finished-task cases from a second fresh Codex call. That call saw a plain statement of the intended behavior, not `capture-policy.md`, and avoided the topics of the policy's examples. Three arms: vanilla, hook text only, and hook text plus skill and policy. The hook-only arm matters because the hook text is all an agent sees before it chooses to load the skill. Errors are weighted: a wrong capture costs 2, a missed capture 1, a safety failure 3. Not yet run: the local CLIProxyAPI endpoint was not running.

Results:

- **Decision eval** (Opus 5.5 only; the proxy serves no Codex models; 264 calls): full Field Guide text **90.34**, hook text only 81.53, vanilla 81.25. The full text removed wrong captures on skip cases and all sensitive leaks. The hook text alone, which drives the first decision, matched vanilla. Every arm still captured too often where it should have asked.
- **End-to-end check:** capture, apply, and skip each passed one headless Claude Code run.
- **Retrieval climb:** three rounds took the climb score from 32.00 to 48.57, mostly by making function words stopwords. **Not supported** on the held-out probe: score 45.16 against 30.30, but recall 51.85 fell below the 52.56 floor. Round 2's stopwords `need` and `already` cost one relevant record. Post hoc, the round 1 version would have passed; testing it needs a fresh probe.
- **Retrieval retest:** the round 1 version, frozen, on 64 fresh held-out prompts under a new pre-registration. **Supported** on all five parts: score 38.62 against 27.78 (+10.84), precision 30.43 against 19.69, recall 52.83 against 47.17, and no-relevant false injections 27 against 44.

- **Decision climb:** the hook text gained a short rule for each choice. The climb score went from 85.94 to 92.90; rounds 2 and 3 (policy rewrites) were rejected. Three blind scorecard judges preferred the final version, 9.43 against 8.95. **Supported** on 44 fresh held-out cases: head 95.31 against base 90.91 (+4.40), wrong captures on skip cases 0 against 3, no stored sensitive strings, and vanilla 82.95. With two attempts per case, the hook arm's noise was about ±3 points.
- **Decision climb on Codex** (`gpt-6.1-sol`, the same held-out cases; not a decision input): head 90.34 against base 78.13 (+12.21), with vanilla at 64.20. Wrong captures on skip cases fell from 16 to 1, and stored sensitive strings from 2 to 0. The old hook text did much worse on Codex than on Opus, so the new rules matter more there.

The round 1 retrieval change and the hook-text change each passed a pre-registered ship rule and are committed on the branch. The round 2 retrieval change did not ship.

Evidence:

- [Retrieval climb pre-registration and card](evidence/field-guide-retrieval-climb/prereg.md)
- [Retrieval scorer, store, and climb set](evidence/field-guide-retrieval-climb/scorer/)
- [Retrieval climb results](evidence/field-guide-retrieval-climb/results.md)
- [Retrieval retest pre-registration](evidence/field-guide-retrieval-climb/retest-prereg.md)
- [Decision eval pre-registration](evidence/field-guide-decision-eval/prereg.md)
- [Decision eval results](evidence/field-guide-decision-eval/results.md)
- [End-to-end check](evidence/field-guide-e2e/results.md)
- [Decision climb pre-registration](evidence/field-guide-decision-climb/prereg.md)
- [Decision climb results](evidence/field-guide-decision-climb/results.md)
- [Decision eval harness and cases](evidence/field-guide-decision-eval/scorer/)

### 29. Engineering guidance climb: preparation and dry run

Date: 2026-11-06. Plan, task preparation, and free dry runs only; no paid call has run.

This climb covers all engineering guidance: the engineering sections of `core.md`, `CODING_STANDARDS.md`, and the Workflow `engineering`, `test-audit`, `review`, and `simplify` skills. Vanilla and Superpowers are controls. Calibrated blind judges decide rounds on code shape. Correctness no worse than vanilla, total tokens at most 1.3 × vanilla, and mechanical code measures are gates. Six DeepSWE tasks with source-bound correctness replace the saturated Pytest canary; two of them are a frozen holdout.

Preparation found three instrument problems before any paid call:

- **File modes.** Under this machine's `umask 002`, PluginBench rejected all six reviewed tasks as unreviewed, because the verifier digest includes file modes. Runs now use `umask 022`.
- **Task drift.** The dateutil image no longer built: PyPI renamed the latest `python-dateutil` sdist. After a pin fixed the build, unpinned pytest 9.2.0 stopped collection under the repository's `filterwarnings = error`, so the agent could not run the suite where it codes. Pins that match the grader image repair both problems, and the verifier is unchanged.
- **Fallow version check.** The Fallow npm wrapper adds a `verified:` line to `fallow --version`, which PluginBench's exact match rejects. The run links the verified platform binary.

Harbor's `oracle` agent scored all six tasks 1.0 and `nop` scored them all 0.0, so every task grades and discriminates after the repair. Both pilot dry runs admit every arm and measurement: 54 coding attempts and 54 reviews in total.

Evidence:

- [Climb card](evidence/engineering-guidance-climb/card.md)
- [Probe pre-registration](evidence/engineering-guidance-climb/prereg.md)

#### PluginBench overhaul before round 2 (2026-11-07)

The pilot and round 1 exposed instrument gaps, so evaluation paused. PluginBench PRs #8–#15 (main `fd0de97`) add resume without repeated coding, `stop`, detached runs, `status --watch` and `status --json`, `compare` against a gates file, overlap passes, a completeness matrix, and per-test coverage profiles for csstree and true-myth. The study now needs no hand-written run, progress, analysis, or re-review script.

These findings change how to read earlier rounds:

- **True-myth coverage from the pilot and round 1 is withdrawn.** Vitest's default remapping read every population as 100%, including a never-called function. The new profile uses AST-aware remapping. Its 100% results are now genuine, because true-myth enforces 100% statement, branch, and function thresholds: the smoke run's populations were 523 and 520 statement lines, against 1,114 under the old remapping. Changed-line coverage cannot separate arms on this task.
- **Redundancy definition.** PluginBench counts an added test as redundant when the added lines it executes are covered by the union of all other tests, existing tests included.
- **`status` now classifies withheld results as the report does.** Before PR #14, `status` showed 12 overlap passes and fails in the pilot as `unknown`.
- **Gates.** `card-gates.yaml` has no gate on redundant added tests, though the pilot read suggests it may be the clearest effect. Adding one is a card decision.

Smoke run, `runs/egc-20261106/results/smoke-overhaul`: true-myth, vanilla and `workflow-main`, 1 repeat.

| Step | Result |
| --- | --- |
| First detached start | Stopped before any coding call: a saved profile's inline script crashed profile loading. Fixed in PR #15. `check` passed, because it does not load saved profiles; that gap remains. |
| Resume, then `stop` while both attempts coded | Both attempts finished and were kept, both pass; the run recorded `stopped` |
| Resume after `stop` | 0 new coding calls; measurement and 2 reviews completed |
| `compare --gates card-gates.yaml` | Passes 1/1 and 1/1; tokens 1.36M vanilla, 3.22M `workflow-main`; missing values listed with reasons |
| `check` from a second folder | Vanilla cache: 1 of 1 attempts hit |
| Redundant added tests | Vanilla 21, `workflow-main` 16 (n = 1, no conclusion) |

#### Climb result (2026-11-09)

All three budgeted rounds ran; no candidate passed the decision rule, so `main` keeps its engineering guidance and the probe does not run.

| Round | Passes, confirmed + overlap (vanilla) | Tokens (× vanilla) | Mechanical gate | Pair wins against `main` |
| --- | --- | --- | --- | --- |
| 1 | 12 + 0 (11 + 0), pass | 2.91M (1.75×), fail | 2 count gates failed | not run |
| 2 | 11 + 0 (11 + 1), pass | 2.36M (1.10×), pass | 3 failed; passes after Amendment 3 | not run |
| 3 | 8 + 2 (11 + 1), fail | 2.65M (1.24×), pass | pass, before and after Amendment 3 | 4 of 12 (report-only) |

- `main` itself failed correctness and tokens in round 2: 10 of 12 passes and 6.68M (3.1× vanilla).
- Amendment 3, after round 2: the cognitive ratio leaves out a task whose reference adds under 10, and the noisy count gates became diagnostics. `main` failed those counts against its own pilot run.
- Round 3's diagnostics beat `main`: high plus medium findings 7 against 8, redundant added tests 7.67 against 13, duplicated test lines 50 against 101. Blind judges still preferred `main` on 7 of 10 judged pairs.
- One round-3 attempt stopped to ask which branch to use before editing. That behavior comes from `core.md`'s ambiguity rules, which every Workflow arm shares.
- PluginBench #18 came out of the round-2 outage: a backend failure no longer scores or caches an attempt, and background runs survive the launching session.

Evidence: [round 3 notes](evidence/engineering-guidance-climb/round-3/notes.md), [card Amendment 3](evidence/engineering-guidance-climb/card.md).

### 30. Engineering climb: judge validation and an owner-profile judge

Date: 2026-11-09. Judge-only checks on saved climb diffs. No new coding run.

The judges are not yet a valid gate for this climb:

- **Noise floor.** Two runs of the same arm, judged against each other, give 7 or 8 card wins of 12, where 6 is expected. Step 1 scored the candidates against vanilla at 6 (`main`), 7 (round 3), and 5 (Superpowers), all within that noise.
- **Position bias.** Judges given three pairs per call chose side A 69% of the time in same-arm packets. In the swap packets, with one pair per call, they chose it 50% of the time.
- **Instability.** The swap rerun changed two things at once: the sides, and the format, from three pairs per call to one. `main`'s judged wins moved from 6 of 10 to 10 of 10. Round 3 held at 7 of 10. These checks cannot isolate which change caused the shift, so one pair per call is a precaution, not a proven fix.

The owner cannot rank unfamiliar library code reliably, so a judge was built from his review taste instead. It uses his review comments at work, his corrections to Codex agents, and his stated rules. Items that rest only on the Workflow guidance were left out to reduce circularity. His taste still overlaps that guidance.

Claude Fable 5.2 used that profile on the 20 pairs where both sides got the same test outcome, one pair per call:

- It preferred the guided arm in 13 of 20 pairs (p ≈ 0.26), so the result is not significant.
- It agreed with the one-pair-per-call judges on 14 or 15 of 20 pairs. Those judges agree with their own earlier verdicts on 14 to 16 of 20.

Decision: the owner-profile judge joins the panel and stands in for the owner's rankings. Every judge gets one pair per call.

Evidence: [judge validation notes](evidence/engineering-guidance-climb/judge-validation/notes.md).

### 31. Host-config delegation: tier roster and usage rule

Date: 2026-11-10. A decision eval, not a PluginBench coding run.

The change gives each model a tier (frontier, workhorse, balanced, fast) in `host-config/models.json`, adds a mechanical-work role, names the work a main thread hands off, and moves a short provider's role to the other provider's model in the same tier.

`pnpm eval:delegation` asked each host's main-thread model where 11 tasks should run, with the guidance from `main` and from the branch, three attempts each:

- Opus 5.5 on the Claude guidance: 24 of 33 on `main`, 33 of 33 on the branch.
- Sol on the Codex guidance: 15 of 33 on `main`, 33 of 33 on the branch.
- No scenario scored lower on the branch. Code-writing tasks stayed in the main thread, and the small read was never delegated.

Limits: the eval measures the stated choice, not a delegation in a live T3 thread, and scenarios and accepted answers come from the same author as the change.

Evidence: [run notes](evidence/delegation-routing-eval/run-2026-11-10.md).

### 32. Engineering climb: paired screen on the DeepSWE panel

Date: 2026-11-10. Owner-approved paid run. The pre-registration was written before any coding run.

The screen compared vanilla Codex with `workflow-lean` on the 25-task DeepSWE panel, one attempt each, with `gpt-6.1-sol` at high reasoning. `workflow-lean` is round 3's candidate (§29) plus one `core.md` line: close a reversible environment gap, such as a missing `main` branch, instead of stopping to ask.

The pre-registered rule:

- Stop when correctness is not non-inferior: the lower bound of the 90% CI on the paired pass-rate difference is below −10 pp.
- Label the stop **inferior** when the upper bound is below 0, otherwise **inconclusive**.
- Judges decide only when correctness passes.

Result: **stop, inconclusive.**

| Measure | All admitted (20) | Without adaptix and csstree (18) |
| --- | ---: | ---: |
| Pass rate, `workflow-lean` against vanilla | 80% against 90% | 78% against 94% |
| Difference, 90% CI | −10 pp [−30, +10] | −17 pp [−39, 0] |
| Tokens, `workflow-lean` to vanilla (geometric mean), 90% CI | 1.65× [1.42, 1.93] | 1.67× [1.42, 2.00] |

- **Sensitivity.** Adaptix and csstree are the climb tasks round 3 was tuned on. Without them, the upper bound is exactly 0, which is not below 0. The label and the decision do not change.
- **Tokens.** The ratio fails the card's 1.3× ceiling. On the 4 climb tasks, round 3's guidance, without the ask-fix line and with 3 repeats, was 1.24× vanilla.
- **Admission.** Admission was arm-blind, before any judge call. It dropped 4 tasks where both arms failed (termenv, ts-pattern, tengo, bandit). It dropped cattrs as infrastructure: PluginBench never graded the vanilla attempt, because its source export refuses the agent's `.venv` symlinks. Neither arm stopped to ask. `workflow-lean`'s one empty patch, on oxvg, was a timeout.
- **Interruption.** A host shutdown stopped the run with 45 of 50 attempts complete. PluginBench refused the resume after a kernel update changed Docker's reported memory by 28 KiB. An owner-approved top-up coded both arms of the 5 unpaired tasks again. The 54 coding attempts with recorded usage used 125.1M input plus output tokens; the oxvg timeout has none.
- **Deviations.**
  - Neither part ran the reviewer.
  - `pluginbench judge prepare` needs review packets, so a local script built the judge folders from attempt diffs, one pair per call.
  - These were logged as an amendment before any judging.
- **Judges, diagnostic only.**
  - On the 14 pairs where both arms passed, Astra preferred `workflow-lean` in 9 and Sol 6.1 in 8. They agreed on 13 of 14.
  - Opus 5.5 and Fable 5.2 (owner profile) produced no valid verdicts. PluginBench's Claude harness treats the Claude CLI's built-in startup plugins as custom configuration, so every Claude judge call failed verification.
- The PluginBench bugs found in this screen went to the PluginBench audit thread.

The screen does not show that `workflow-lean` is worse than vanilla. It does show that, on harder tasks, the guided arm costs 1.65× vanilla's tokens with no measured gain in correctness.

Evidence: [screen notes](evidence/engineering-guidance-climb/screen/notes.md), [pre-registration](evidence/engineering-guidance-climb/screen/prereg.md), [summary](evidence/engineering-guidance-climb/screen/summary.json).

## Fixed iteration protocol

### Fixed variables

Keep these values fixed during one comparison:

- SWE-bench task and dataset revision
- starting patch and checksum
- task prompt
- model and reasoning setting
- timeout and number of attempts
- runtime image and official verifier
- tool permissions

Change only the supplied Workflow skill bundle.

### Loop

1. Run the repair seed without supplied skills.
2. Save the compatible baseline.
3. Change one general workflow rule or placement.
4. Run the treatment against the same repair seed.
5. Compare correctness, repair rate, cost, tokens, time, and patch scope.
6. Reject task-specific advice and unverified explanations.
7. Test promising changes against the passing preservation seed.
8. Test the best candidate on an untouched holdout task.

Use one attempt only for plumbing checks.
Use three attempts for the iteration pilot.
Use a separate five-attempt config before a promotion decision.

## Measures

### Primary outcomes

- repair rate for a known failing patch
- preservation rate for a known passing patch
- official SWE-bench result

### Efficiency outcomes

- median duration per attempt
- median nominal cost per attempt
- input, cached, and output tokens
- cost per successful repair

### Scope and quality guardrails

- files and lines in `agent-change.diff`
- changes outside the task ownership area
- new abstractions or dependencies
- test changes that weaken the contract
- verification commands and their results
- invoked skills, references, and reviewer contexts

Do not collapse these measures into one opaque score.
Correctness is the primary gate.
Preservation and scope are guardrails.
Efficiency separates otherwise acceptable candidates.

## Provisional promotion rule

A candidate can advance when it meets all applicable gates:

- at least four repairs in five scored attempts
- three preservations in three scored control attempts
- no unexplained unrelated file changes
- no task-specific workflow instruction
- no more than 20% median cost or duration overhead

These thresholds are provisional.
The pilot can change them before a final preregistered study.

The 20% raw cost and duration ceiling applies while correction burden is
unmeasured. Replace it when a correction-loop study can measure total effort to
an accepted patch. Do not reject a candidate only for higher initial token use
when it reduces total correction, review, and re-verification work without a
correctness regression.

## Holdout

The first holdout is `pydata__xarray-6992`.

All three earlier arms failed this task.
All 12 target tests still failed after implementation.
The internal and blinded reviews missed that fact.

This task tests whether the workflow verifies the real contract before completion.
Do not use its failure details to tune the Pytest canary workflow.

The holdout did not run in this loop.
No candidate passed the canary promotion gate.

## Experiment log

| Date | Study or iteration | Treatment | Result | Main lesson | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-08-31 | Local smoke | Full 23-skill bundle | 3 of 3 versus 2 of 3 baseline | A routing lift can have large small-task overhead. | `pluginbench/reports/2026-08-31-filip-stack-evaluation.md` |
| 2026-08-31 | SymPy isolation | Full bundle | Both arms passed | Isolation worked. Full added resources without score lift. | Same report, section 2.3 |
| 2026-08-31 | Hard-task pair | Full bundle | 1 of 7 strict | Full added 30.88% tokens and lost one paired task. | `pluginbench/runs/20260831T215323Z-*` |
| 2026-09-01 | Core ablation | Three direct skills | 3 of 7 strict | A smaller direct bundle deserved follow-up. | `pluginbench/runs/20260901T003052Z-*` |
| 2026-09-01 | Blinded arm review | Two reviews per patch | 42 valid reviews | Raw findings did not align reliably with correctness. | `pluginbench/runs/reviews/20260901T064011Z-*` |
| 2026-09-01 | Gold calibration | Two reviews per gold patch | 32 findings and one accept | The reviewer proxy lacked a valid reference level. | Same run, `gold-calibration` |
| 2026-09-02 | V2 local smoke | Five-skill v2 | 2 of 3 | Lower local cost was directional. One exact contract regressed. | `pluginbench/runs/20260902T065344Z-*` |
| 2026-09-02 | V2 hard-task run | Five-skill v2 | 1 of 8 | Fewer skills did not reduce runtime resource use. | `pluginbench/runs/20260902T154634Z-*` |
| 2026-09-02 | Starting-patch capability | PluginBench feature | Tests and commit completed | Repair and preservation became directly measurable. | Commit `ee97bc6` |
| 2026-09-02 | Initial repair canary | Initial v2 | 0 of 3 repairs | V2 added 33.58% cost without repair lift. | `20260902T195826Z-*` |
| 2026-09-02 | Reference checkpoint | Compatibility rule in reference | One failure, one timeout | The agent read the rule, but the scored patch still failed. | `20260902T203810Z-*` |
| 2026-09-02 | Main-skill checkpoint | Same rule in `SKILL.md` | 0 of 3 repairs | Higher salience lowered cost but did not improve correctness. | `20260902T205609Z-*` |
| 2026-09-02 | Real-boundary checkpoint | Require a real boundary when the suite cannot run | 2 of 3 repairs | Correctness improved, but cost exceeded the ceiling. | `20260902T211309Z-*` |
| 2026-09-02 | Preservation control | Real-boundary bundle on passing seed | 3 of 3 preserved | No regressions, but treatment cost increased 64.36%. | `20260902T213301Z-*` |
| 2026-09-02 | Bounded-boundary repair | One real producer-to-consumer path | 0 of 3 repairs | It met the cost ceiling but lost the repair lift. | `20260902T221044Z-*` |
| 2026-09-02 | Rollback | Initial v2 bundle | Restored | No candidate passed the complete promotion gate. | Digest `sha256:60655c...` |
| 2026-09-03 | Task-capable runtime | No supplied skills | 5 of 5 repairs | The runtime removed the earlier dependency block and exposed a saturated canary baseline. | `20260903T055005Z-*` |
| 2026-09-03 | Adaptive v2.1 | Fast path with conditional escalation | 4 repairs and 1 ambiguous result | Review and reference activity increased cost, latency, and tokens. | Same run, treatment arm |
| 2026-09-03 | Subtractive v2.2 control | Four-line engineering skill | 4 repairs and 1 ambiguous result | Subtraction removed procedure overhead but did not protect the production contract. | `20260903T135847Z-*` |
| 2026-09-03 | Rollback | Initial v2 bundle | Restored | The control failed its indeterminate-result gate, so the micro-skill did not run. | Digest `sha256:60655c...` |
| 2026-09-03 | Micro engineering loop v2.3 | Eight-step production-owner and test loop | 5 of 5 repairs; 3 of 3 preservation | It matched saturated correctness, reduced repair resources, and passed preservation within the fixed ceilings. | `20260903T153142Z-*`; `20260903T155846Z-*` |
| 2026-09-03 | Successful-patch quality | Five resolved attempts in each arm | Candidate median churn was 7 versus 10. The distributions overlapped. | Equal correctness is necessary, but a lower median alone does not show consistent simplicity or lower review burden. | `micro-v2-3-successful-patch-quality/` |
| 2026-11-04 | Design language probe plan | Forms, data views, and breakpoints in `DESIGN.md` | Not run; PluginBench lacks an artifact submission, a browser collector, and host-directory delivery | Host-config guidance needs browser scores that the code-patch harness cannot produce. | `docs/evidence/design-language-probe/study-plan.md` |
| 2026-11-04 | Design language probe, first run | Forms, data views, and breakpoints in `DESIGN.md`; 18 standalone builds, 27 blind judges | Not supported: head worse on table overflow and border colors; judges preferred base in 3 of 3 probes | Head adopted the 640 and 800 px breakpoints but did not make pages more consistent; one-off run without PluginBench. | `docs/evidence/design-language-probe/probe-run-2026-11-04.md` |
| 2026-11-04 | Design language probe, second run | Same change; 48 standalone builds with guidance in one file per build, 72 blind judges with the shared guidance | Not supported: head worse on table overflow, phone table clipping, and docs probe checks; judges preferred base in 3 of 3 probes, Opus too | No leakage; head used only 640 and 800 px, but its Data views and rail guidance produced phone-width regressions. | `docs/evidence/design-language-probe/probe-run-2-2026-11-04.md` |
| 2026-11-05 | Design language PR narrowed | Breakpoints only: 640 and 800 px, container query, example pages | Not run | Run 2 tied the regressions to Data views and the scrolling-strip line, and showed head kept to the two widths. | `docs/evidence/design-language-probe/probe-run-2-2026-11-04.md` |
| 2026-11-04 | Reader pages probe dry run | Reader pages guidance, 1 attempt per arm on one brief | Pipeline worked; head won 0 of 6 judge votes and leaked 4 agent-only facts | No verdict at n=1. Untested hypothesis: a keep-every-fact check works against the write-for-the-reader rule. | [docs/evidence/reader-pages-probe/](evidence/reader-pages-probe/) |
| 2026-11-04 | Reader pages probe dry run 2 | Revised reader pages guidance, same brief and calls | Head leaked 0 agent-only facts and won 3 of 6 judge votes | No verdict at n=1. The leak did not repeat. The extractor misses leaks in notes sections. | [docs/evidence/reader-pages-probe/dry-run-2/](https://github.com/filipgutica/filip-stack/tree/11be5512e0cfe0f86a17bcbf5d3566d8ef06cdce/docs/evidence/reader-pages-probe/dry-run-2/) |
| 2026-11-05 | Reader pages probe dry run 3 | Rebuilt arms after merging main; B1, 1 attempt per arm, 15 calls | Pipeline passed, zero retries; head won 6 of 6 overall judge votes | Smoke test only; all build reads stayed within their arm. | [docs/evidence/reader-pages-probe/dry-run-3-report.md](evidence/reader-pages-probe/dry-run-3-report.md) |
| 2026-11-05 | Reader pages paid probe | Fixed 4 briefs × 3 arms × 5 attempts, 312 calls | Not supported: no harm and objective gain pass, but B3 loses 7–8 to base and 5–10 to vanilla | Part 3 forbids an opposing majority; Node.js caveat placement is a diagnostic for a separate B3 revision. No routing run. | [docs/evidence/reader-pages-probe/paid-run-report.md](evidence/reader-pages-probe/paid-run-report.md) |
| 2026-11-05 | Reader pages B3 rerun | R4 caveat placement only; five new head builds, reused controls, 46 new calls | Not supported: B3 loses 4–11 to base and wins 12–3 against vanilla; zero retries | Combined no harm and objective gain pass; base judge agreement fails. B1, B2, B4 were not rerun. Push blocked by session policy; no routing run. | [docs/evidence/reader-pages-probe/b3-rerun-report.md](evidence/reader-pages-probe/b3-rerun-report.md) |
| 2026-11-05 | Reader pages narrowed probe | Scope narrowed to landing, skill, and lesson-opening pages; R4 revert; 3 new briefs × 3 arms × 5 attempts, 234 paid calls | Not supported: head beats base 10–5, 11–4, 10–5, but vanilla wins N1 14–1; 5 N2 scoring calls failed and were not retried | Judge agreement against base now passes on all three briefs. Head lost the tool landing page to vanilla, whose pages all had an install heading. Objective gain against base is undetermined. | [docs/evidence/reader-pages-probe/narrow-report.md](evidence/reader-pages-probe/narrow-report.md) |
| 2026-11-06 | Guide-body probe | Body rules per Diátaxis type in `technical-prose.md`; 3 briefs × 3 arms × 5 attempts; calibrated judges; 325 paid calls | Not supported: head lost 2–8 to base and 2–6 to vanilla on reader success; no harm passed; D3 saturated | Reader tasks hit ceiling, so read depth decided pairs. Head's how-to put the final check last, and its explanations motivated before defining. Head leaked no agent-only facts. | [docs/evidence/guide-body-probe/results.md](evidence/guide-body-probe/results.md) |
| 2026-11-06 | Writing-guidance climb and probe | Answer placement per Diátaxis type in `technical-prose.md`; climb under `score` on 4 briefs, then 4 fresh briefs × 3 arms × 5 attempts, 121 probe calls | Not supported: head beat base 11/20 and vanilla 14/20; reference lost 4 tasks to base | Climb gain (+5.37) did not hold on fresh briefs; scorecard judges preferred `main` on page-type fit; some failures were key literalism. | [docs/evidence/writing-guidance-climb/results.md](evidence/writing-guidance-climb/results.md) |
| 2026-11-06 | UX guidance probe pre-registration and dry run | `interface-design` vs `ux-laws` plus `frontend-design` vs vanilla; review task with planted defects and build task with gates and blind judges; Opus 5.5 attempts | Free dry run passed: identical first requests across arms, self-test 24 of 24, gates pass two reference builds and fail the stub; no paid call | `--safe-mode --restricted` and scratch Codex homes remove host guidance that earlier probes shared across arms. Paid run of 72 calls awaits approval. | [docs/evidence/ux-guidance-probe/dry-run-report.md](evidence/ux-guidance-probe/dry-run-report.md) |
| 2026-11-06 | Two writing rules, judge-led probe | Four briefs × three arms × five attempts; 24 five-pair judge batches; 167 total calls | Neither rule supported: R1 12.5/20 and R2 10/20 weighted wins against both base and vanilla; reader no harm passed | C remained at 10/20; all reader arms passed 20/20. No writing rule shipped. | [Study record](evidence/writing-rules-probe/results.md) |
| 2026-11-10 | Design system 2.0 token rename (DS-3, FS-2) | `@filipgutica/design-system` 2.0.0 renames 56 short token names to ui's names; the installed `DESIGN.md` and examples change names only | Not run: PluginBench still has no design-language protocol, so the planned `design-language-probe` dry run could not run | All 8 page screenshots (4 pages, light and dark) differ by 0 px once visible name text is normalised, so the rename changes no rendered output. Whether agents write the new names correctly is unmeasured. | [design-system PR #5](https://github.com/filipgutica/design-system/pull/5) |
| 2026-11-10 | Design system 2.1 navigation (DS-4 PR 1) | `@filipgutica/design-system` 2.1.0 adds a Navigation section to `DESIGN.md`, six component specs, purpose groups in `components.md`, the catalogue shell, and the Gate M owner decisions (6px rows and tabs, rail current fill, tab glide, phone header) | Not run: PluginBench still has no design-language protocol | The catalogue behaviour is covered by 27 Playwright tests in the design-system repo, with axe in light and dark. Whether agents follow the new navigation guidance is unmeasured. | [design-system PR #6](https://github.com/filipgutica/design-system/pull/6) |
| 2026-11-10 | Design system 2.2 site and label centring (DS-4 PR 2) | `@filipgutica/design-system` 2.2.0 adds the published site (Overview, Foundations, generated `index.json` and `llms.txt`), `implementations.json`, token roles in the token source, a `findScope` hook in the catalogue shell, and cap-height centring for navigation rows and breadcrumbs | Not run: PluginBench still has no design-language protocol | The site has 56 Playwright tests and the catalogue 27, with axe in light and dark; the live site returns 200 for all five entry URLs. Whether agents use `index.json` or `llms.txt` is unmeasured. | [design-system PR #7](https://github.com/filipgutica/design-system/pull/7) |
| 2026-11-10 | Design system 2.3 component guidance (DS-4 PR 3) | `@filipgutica/design-system` 2.3.0 adds Do and Don't lines to all 32 component specs in `components.md`, a test that every spec has every part, Do and Don't in `index.json`, and a live value on the slider specimens | Not run: PluginBench still has no design-language protocol | `pnpm verify` passes: 77 unit, 3 React, 28 catalogue, and 56 site tests. Whether agents follow the Do and Don't lines is unmeasured. | [design-system PR #8](https://github.com/filipgutica/design-system/pull/8) |
| 2026-11-10 | Design system 2.4 shape rule and guards (DS-3b) | `@filipgutica/design-system` 2.4.0 adds the "Shape follows role" rule and a Density paragraph to `DESIGN.md`, a "Guarded by" column in `decisions.md`, rendered contrast and corner-radius checks in light and dark, raw-colour, literal-radius, and disabled-hover guards, and forced-colors fixes for the badge dot and the alert icon. No token value changed | Not run: PluginBench still has no design-language protocol | `pnpm verify` passes: 85 unit, 3 React, 56 catalogue, and 56 site tests; each guard was shown to fail on a planted break. Whether agents follow the shape rule is unmeasured. | [design-system PR #9](https://github.com/filipgutica/design-system/pull/9) |
| 2026-11-10 | Design system 1.0.1 version reset | `@filipgutica/design-system` 1.0.1 has the same tokens and components as 2.4.0. `decisions.md` adds a Versioning row and drops version numbers from the token-rename wording. Releases now stay 1.0.x while the system has no outside users: tags are `ds-v*`, from a `ds-v1.0.0` seed, and every release is a patch. Versions 1.1.0 to 2.4.0 are the earlier series. | Not run: no guidance changed | The Release run computed and published 1.0.1, and npm `latest` is 1.0.1. | [design-system PR #10](https://github.com/filipgutica/design-system/pull/10) |
| 2026-11-10 | Host-config delegation routing | Model tiers, mechanical-work role, hand-off list, and usage rule in the global guidance | Opus 24/33 → 33/33; Sol 15/33 → 33/33 on 11 scenarios × 3 attempts | Naming the hand-off work and the cheaper tiers changed both models' stated choices; neither moved code-writing off the main thread. | [run notes](evidence/delegation-routing-eval/run-2026-11-10.md) |

## Validity threats

### Task overfitting

Repeated work on one patch can teach the workflow the answer.
Never add repository names, test names, or known solution details to a general skill.

### Model variance

One attempt can change because of model variance.
Use repeated attempts and report every result.

### Baseline drift

A starting-patch prompt differs from a from-scratch prompt.
Use a new baseline for the starting-patch protocol.
Reuse it only when the compatibility fingerprint matches.

### Run-order drift

The old core and v2 treatments ran after their reused baseline.
Model-serving changes can compete with skill changes as an explanation.
A final study should randomize and counterbalance arm order.

### Instruction exposure

Available instructions are not always read.
Read instructions are not always followed.
Record both discovery and procedure evidence.

### Reviewer validity

An uncalibrated model reviewer cannot rank code quality.
Use known controls and human adjudication before arm comparisons.

### Benchmark scope

One SWE-bench task is a canary.
It is not a general effectiveness result.

### Goodhart pressure

An agent can reduce lines or tool calls while missing the task.
Treat efficiency as secondary to correctness and preservation.

### Nominal cost

Provider-reported cost is an estimate.
It is not a subscription invoice charge.

## Publication-grade evidence plan

A publication-grade result needs more than the canary.

1. Preregister the hypotheses, tasks, thresholds, and exclusions.
2. Use several task families and untouched holdouts.
3. Run repeated paired attempts for each task and arm.
4. Randomize arm order within each task.
5. Publish exact configs, seed hashes, skill digests, and runtime image IDs.
6. Report every timeout, infrastructure failure, exclusion, and incomplete run.
7. Run both repair and preservation controls.
8. Grade scope with deterministic signals before subjective review.
9. Calibrate reviewers on adjudicated positive and negative controls.
10. Add unseen follow-on tasks to test maintainability and reuse.
11. Report task outcomes and resource distributions separately.
12. Keep the canary result labeled as directional evidence.

Human correction effort remains difficult to scale.
A small adjudicated subset can measure active time and correction turns.
The larger study can use repair, preservation, extension, and calibrated review outcomes.

## Artifact map

| Evidence | Location |
| --- | --- |
| Durable canary reports and arm manifests | `docs/evidence/workflow-skill-evaluation/` |
| Design language probe plan and PluginBench gaps | `docs/evidence/design-language-probe/study-plan.md` |
| Original capability report | `pluginbench/reports/2026-08-31-filip-stack-evaluation.md` |
| Blinded review report | `pluginbench/reports/2026-09-01-filip-stack-blinded-review-evaluation.md` |
| Pinned hard-task snapshot | `pluginbench/benchmarks/swe-bench-verified-hard/tasks.json` |
| Canary runbook | `pluginbench/benchmarks/workflow-pytest-canary/README.md` |
| Repair config | `pluginbench/benchmarks/workflow-pytest-canary/repair.yaml` |
| Preservation config | `pluginbench/benchmarks/workflow-pytest-canary/preservation.yaml` |
| Repair seed | `pluginbench/benchmarks/workflow-pytest-canary/seeds/repair.patch` |
| Preservation seed | `pluginbench/benchmarks/workflow-pytest-canary/seeds/preservation.patch` |
| Initial paired canary | `pluginbench/benchmarks/workflow-pytest-canary/runs/20260902-workflow-v2-pytest-repair-initial/20260902T195826Z-workflow-pytest-repair-canary` |
| Reference-placement run | `pluginbench/runs/20260902-workflow-v2-pytest-repair-compatibility/20260902T203810Z-workflow-pytest-repair-canary` |
| Main-skill-placement run | `pluginbench/runs/20260902-workflow-v2-pytest-repair-main-compatibility/20260902T205609Z-workflow-pytest-repair-canary` |
| Real-boundary repair run | `pluginbench/runs/20260902-workflow-v2-pytest-repair-real-boundary/20260902T211309Z-workflow-pytest-repair-canary` |
| Real-boundary preservation run | `pluginbench/runs/20260902-workflow-v2-pytest-preservation-real-boundary/20260902T213301Z-workflow-pytest-preservation-control` |
| Bounded-boundary repair run | `pluginbench/runs/20260902-workflow-v2-pytest-repair-bounded-boundary/20260902T221044Z-workflow-pytest-repair-canary` |
| Subtractive v2.2 activation-control run | `pluginbench/runs/20260903-workflow-v2-2-minimal-control/20260903T135847Z-workflow-pytest-repair-canary` |
| Micro v2.3 repair run | `pluginbench/runs/20260903-workflow-v2-3-micro-loop-repair/20260903T153142Z-workflow-pytest-repair-canary` |
| Micro v2.3 preservation run | `pluginbench/runs/20260903-workflow-v2-3-micro-loop-preservation/20260903T155846Z-workflow-pytest-preservation-control` |
| Successful-patch quality evaluator | `pluginbench/src/pluginbench/quality.py`; `pluginbench quality` |
| Micro v2.3 successful-patch quality report | `docs/evidence/workflow-skill-evaluation/micro-v2-3-successful-patch-quality/` |
| Reader pages probe preregistration, dry runs, and scorer | [docs/evidence/reader-pages-probe/](evidence/reader-pages-probe/) |
| Guide-body probe preregistration, calibration, results, and scorer | [docs/evidence/guide-body-probe/](evidence/guide-body-probe/) |
| Writing-guidance climb card, probe preregistration, results, and scorer | [docs/evidence/writing-guidance-climb/](evidence/writing-guidance-climb/) |
| UX guidance probe preregistration, dry run, scorer, and fixture | [docs/evidence/ux-guidance-probe/](evidence/ux-guidance-probe/) |
| Field Guide retrieval climb pre-registration, scorer, and climb set | [docs/evidence/field-guide-retrieval-climb/](evidence/field-guide-retrieval-climb/) |
| Field Guide decision eval harness and cases | [docs/evidence/field-guide-decision-eval/](evidence/field-guide-decision-eval/) |
| Field Guide decision climb pre-registration, results, and held-out cases | [docs/evidence/field-guide-decision-climb/](evidence/field-guide-decision-climb/) |
| Initial v2 skill snapshot | `pluginbench/benchmarks/workflow-pytest-canary/runs/20260902-workflow-v2-pytest-repair-initial/20260902T195826Z-workflow-pytest-repair-canary/inputs/skill-bundle` |
| Promoted Workflow source | `plugins/workflow/skills/` |

The PluginBench repository ignores raw `runs/` directories.
They contain large workspaces, model traces, and host-specific paths.
The raw runs from this study remain present locally. Aggregate reports and arm
manifests for every completed run are copied to
`docs/evidence/workflow-skill-evaluation/` with a verified checksum manifest.
Full per-attempt model traces and verifier reports still depend on the ignored
run directories. The v2.3 candidate diffs used for scope adjudication are now
tracked. Do not delete the raw runs until any other selected artifacts are
copied to a tracked or external archive. Published reports must preserve the
needed aggregates and artifact checksums.

## Article angle

The strongest story is not that one sentence improved a benchmark.
The strongest story is that skill optimization exposed a three-way tradeoff.

The broad real-boundary rule improved repair on two attempts.
It also overprocessed an already-correct patch and failed the cost gate.
The bounded rewrite reduced overhead but lost the repair lift.

This sequence shows why skill evaluation needs correctness, preservation, and efficiency gates.
It also shows why an automatic decision cannot accept zero correctness lift by default.

The rollback is part of the result.
A disciplined loop can reject a promising local improvement before it becomes permanent workflow ceremony.

## Possible article or paper structure

1. Why “with skills” versus “without skills” is underspecified
2. Why workflow skills can become overengineered
3. How PluginBench isolates a skill treatment
4. What the first paired SWE-bench study found
5. How trace evidence exposed procedural overhead
6. Why the blinded reviewer failed calibration
7. Why fewer skill files did not guarantee lower runtime cost
8. How starting patches measure repair and preservation
9. How one rule improved repair but overprocessed correct work
10. Why the bounded rewrite lost the observed repair signal
11. Why automatic and product decision gates can disagree
12. What the canary and unused holdout can and cannot prove
13. Why rollback is a valid experiment result
14. Practical guidance for skill authors

## Working takeaways

These takeaways are provisional:

- Define the treatment before interpreting a “with skills” result.
- Measure skill behavior, not only skill availability.
- A smaller bundle can still trigger expensive agent behavior.
- A four-line skill can remove review and reference activity without matching baseline correctness.
- Independent review needs a separate artifact and identity.
- Reviewer counts need calibration before they represent quality.
- Progressive disclosure reduces default context but can reduce instruction salience.
- Higher instruction salience alone did not improve this canary.
- A real repository boundary produced the first repeated repair lift.
- A correctness lift can still fail a preregistered efficiency gate.
- Preserving correct work does not justify unbounded re-verification cost.
- One explicit compatibility path can bound a fallback verification rule.
- Bounding a rule can also remove its observed benefit.
- An automatic decision must require positive correctness lift for repair studies.
- A failed promotion gate should stop holdout spending and trigger rollback.
- An efficiency win cannot compensate for one unresolved task outcome.
- A control failure can identify a missing guard without authorizing post-hoc promotion.
- A small production-owner and test-protection loop can match saturated correctness while reducing repair resources.
- Preservation controls can expose unnecessary edit churn even when every attempt passes.
- Lower overall latency does not prove that the agent tested early; trace order must be measured separately.
- A lower median patch size does not prove a consistent simplicity improvement.
- Code size and structural complexity can disagree. Report both and inspect outliers.
- Token cost is secondary when fewer review and correction turns reduce total effort to acceptance.
- The current study does not measure that total effort.
- One general rule should change per iteration.
- Repair and preservation provide clearer signals than broad quality scores.
- Correctness must gate efficiency claims.
- A canary guides iteration. It does not prove general effectiveness.
