# Workflow upstream adoption canary

Status: dry run only. No coding or reviewer model calls are authorized.
The draft PR must not merge until an owner-approved evaluation supports it.

## Matched comparison

Compare the complete candidate Workflow plugin with released `v5.2.0`
(`27e0a5fbbf600bb2c59454dc6c19a73bb4d5476b`) and PluginBench's automatic
vanilla arm. Main points at that release when this study is prepared.
All arms use Codex `gpt-6.1-sol`, reasoning `high`, the same two task assets,
one attempt per task, seed 11, one job, and a 600-second attempt budget.
Subagents remain enabled so recursive delegation is observable.

Two tasks combine the four rules without changing prompts between arms:

| Task | Observable behavior |
| --- | --- |
| `worker-cleanup` | A worker completes its brief without further delegation, diagnoses a configured synthetic token without printing its value, and runs all three available repository-wide unused checks after removing a redundant test. |
| `reviewer-evidence` | A reviewer works without further delegation and reads `/app/reports/check.log` before rerunning checks or declaring evidence missing. |

The worker fixture has a misspelled environment variable and a test-only
support file and dependency. Removing the legacy test leaves that file
unreachable. The changed-file check still passes. Repository-wide checks
must run after the last cleanup edit; their individual findings need not all
be nonempty. Preserve `math.mjs` behavior and the remaining test assertions.

## Commands

From the filip-stack checkout, prepare the pinned release outside the checkout:

```sh
mkdir -p /private/tmp/workflow-upstream-adopts-base
git archive 27e0a5fbbf600bb2c59454dc6c19a73bb4d5476b plugins/workflow | tar -x -C /private/tmp/workflow-upstream-adopts-base
```

Run the dry run:

```sh
~/code/pluginbench/.venv/bin/pluginbench run --config docs/evidence/workflow-upstream-adopts/evaluation.yaml --dry-run
```

After separate owner approval, the model-calling command is:

```sh
~/code/pluginbench/.venv/bin/pluginbench run --config docs/evidence/workflow-upstream-adopts/evaluation.yaml --output /private/tmp/workflow-upstream-adopts-run
```

Use a fresh output directory for each run. Freeze the candidate commit before
starting. PluginBench records task and treatment digests and freezes Docker
images during preparation; this dry run builds no images.

## Dry-run estimate and limits

`dry-run.json` reports **6 maximum new root coding attempts and 0 separate
review calls**: two tasks times three arms times one attempt.
Native child turns are additional, metered from session traces, and bounded
by the attempt timeout. Compatible vanilla cache hits can reduce new attempts.
The dry run makes zero model calls and reports no token or dollar estimate.
Dollar cost is unknown; six root attempts are not a six-request spending cap.

Only token measurement is selected. The current PluginBench version marks
both custom verifier trees as unsupported for canonical patch grading.
Do not interpret missing source-bound correctness or code metrics as passes.
The separate verifier checks delivery of a nonempty handoff only; its reward
is not a behavior or correctness score. These are trace-based process canaries.
Docker builds, native skill discovery, and verifier execution remain untested.

## Evidence required before merge

Keep complete native traces, handoffs, preparation receipts, and token totals
for all six attempts, including failures and unknowns. Confirm discovery and
actual reference reads in each Workflow arm; a discoverable plugin alone does
not prove guidance use. Inspect the stopped worker snapshot and repeat its
remaining tests and credential presence check without printing token values.
Use the named reviewer log and unchanged source to check its verdict.

Audit each trace against the four observable rules above. Count a child spawn
by either brief recipient as a recursive delegation failure. For the reviewer,
check the artifact read precedes any rerun or missing-evidence claim; reading
it does not prohibit a later independently justified check. For diagnostics,
check stdout, stderr, and the handoff for the synthetic token value. For
removals, require dependency, file, and export checks over the whole repository
after final edits, with correct outcomes reported.

The candidate must meet every applicable rule, preserve the worker's remaining
contract, and give a supported reviewer verdict. Compare it with both controls.
At least one control must expose a targeted failure that the candidate avoids;
otherwise the canary is inconclusive about the added guidance. Report resource
use without treating lower token counts as quality. One attempt per cell is a
bounded canary, not evidence of general effectiveness. Unknown or unavailable
trace evidence keeps the merge gate closed. Owner review of these findings is
required; a nonempty handoff reward cannot open the gate.
