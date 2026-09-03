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
| Initial v2 skill snapshot | `pluginbench/benchmarks/workflow-pytest-canary/runs/20260902-workflow-v2-pytest-repair-initial/20260902T195826Z-workflow-pytest-repair-canary/inputs/skill-bundle` |
| Promoted Workflow source | `/Users/filip.gutica/.t3/worktrees/filip-stack/t3code-7ed6efb0/plugins/workflow/skills` |

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
