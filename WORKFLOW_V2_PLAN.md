# Simplify Workflow into Five Progressive Skills

## Context

Source: Direct request

This is the implementation plan for Workflow v2. It records the direction agreed in the design discussion. It does not authorize implementation, migration, release, or deletion of existing user data.

The current Workflow plugin exposes 24 public skills. Their top-level `SKILL.md` files contain 13,785 words across 1,629 lines. Seventeen skills refer to other Workflow skills, so one activation can cascade into more instructions. The Codex manifest also advertises seven workflow routes in its default prompt. Runtime hooks, a Node launcher, Field Guide, and Engineering Workflow storage add more procedures and state outside the code change itself.

The existing PluginBench studies provide a warning, not a complete product verdict:

- On seven comparable SWE-bench Verified tasks, baseline passed 2, the full Workflow bundle passed 1, and the three-skill core passed 3.
- The full bundle used 30.88% more total implementation tokens than baseline. Core used 4.06% more.
- The blinded reviewer reported fewer findings for core and full, but the gold-patch calibration received 32 findings and only one accept verdict. Reviewer counts are therefore not a calibrated measure of code quality or human review effort.
- The full arm's internal review was self-review, not a separately evidenced independent review.
- The useful signal is narrow: the compact execution core deserves more study, while the full bundle has not justified its process and context cost.

This plan follows the Agent Skills progressive-disclosure model: all skill metadata is discoverable, one selected `SKILL.md` is activated, and supporting resources are read only when the selected route requires them. The [Agent Skills specification](https://agentskills.io/specification) describes those three tiers and recommends keeping references focused and one level deep. Its [authoring guidance](https://agentskills.io/skill-creation/best-practices) also warns that activated instructions compete with the task, conversation, and other skills for context. Current [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) similarly recommends removing repeated instructions and testing leaner prompts on representative workloads.

### Target architecture

Workflow v2 exposes five public skills. Only two are routers.

| Skill | Shape | Responsibility | Conditional resources | Paper trail |
| --- | --- | --- | --- | --- |
| `engineering` | Router and feedback loop | Authorized code changes, debugging, minimality, deterministic verification, bounded delegation, independent review, repair, and final handoff | Testing/debugging, tool selection, delegation/review | `TASKS.md` only for complex, resumable, or delegated work |
| `planning` | Artifact router | Explore a direction or create one requested specification, plan, task breakdown, or ticket set | One artifact template selected from the request | `SPEC.md`, `PLAN.md`, `TASKS.md`, or ticket drafts only when requested |
| `grill-me` | Manual interaction loop | Stress-test an idea, specification, plan, or decision one question at a time | Log format only when a log is being persisted | One concise grill log per explicit session |
| `technical-writing` | Focused transformation | Write or revise finished technical prose using BLUF and STE-style language without changing settled engineering decisions | PR format or other specialized format only when requested | The requested document itself |
| `walkthrough` | Manual presentation loop | Explain and inspect an exact change range one coherent slice at a time. Optionally use a separate presenter. | Presenter protocol only in agent mode. Log format only when persisted. | One concise walkthrough log per explicit session |

The artifact capabilities remain first-class. `writing-specs`, `writing-plans`, `spec-to-tickets`, and `writing-tickets` become modes and references under `planning`. Their outputs are not collapsed into one document. `SPEC.md`, `PLAN.md`, `TASKS.md`, and ticket drafts retain different ownership and purposes.

`grill-me` remains separate because it changes the interaction model. It is manually invoked, adversarial, and multi-turn. It is not an automatic phase of planning.

### Engineering loop

`engineering` owns one small evidence-driven loop:

```text
contract and authority
  -> inspect live ownership and constraints
  -> state the smallest plan
  -> reproduce or establish a failing test when behavior changes
  -> implement one bounded slice
  -> run deterministic verification
  -> run independent review when meaningful
  -> repair a valid finding and re-verify
  -> stop with evidence, or escalate a real blocker or decision
```

Every transition is evidence-backed. A passing verifier, accepted review, or explicit user decision advances the work. A failure returns only to the affected step. The loop stops when the stated success criteria pass, the task crosses its authority or scope, or progress requires a material user decision.

This borrows the useful parts of loop engineering without turning Workflow into an autonomous loop runner. The recent exploratory paper [Loop Engineering: Building Blocks, Adoption, and Impact](https://arxiv.org/abs/2608.21884) describes outer loops that trigger agent runs, persist cross-run state, use verifier agents and budgets, and stop on machine-checkable conditions. Workflow v2 uses verifiers, stop conditions, bounded state, and escalation, but it does not schedule, trigger, or repeatedly launch unattended runs.

### Task graphs without a graph runtime

Graph engineering is an emerging and non-standardized label. One current research framing models tasks, agents, and state as dynamic graphs for system-level coordination in [Graph Engineering in the Era of LLM Agents](https://arxiv.org/abs/2608.21156). A concrete Skills-oriented implementation, [Agent Graph](https://github.com/context4ai/agent-graph), uses facts, routes, actions, gates, and selectively loaded resources to make long workflows testable and resumable.

Workflow v2 adopts the following ideas without adding a graph schema, CLI, scheduler, or state engine:

- A bounded subtask is a node only when it has an observable outcome and its own verification.
- A dependency edge exists only when one subtask needs another's output.
- Independent nodes may fan out to subagents when that reduces context or latency.
- Overlapping files have one writer. Results fan in to the main thread for acceptance.
- Independent review is a separate verifier node, not the implementer's self-review.
- Failure returns to the smallest affected node rather than restarting the whole workflow.
- Simple work stays a list or a short linear loop. It does not become a graph artifact.

This makes the workflow graph-shaped where useful but keeps Markdown and live repository facts as the implementation. A future graph runtime would require separate evidence that long-running recovery or host-enforced routing cannot be achieved with the simpler design.

### Progressive disclosure and context control

Progressive disclosure is explicit and testable:

| Tier | Loaded content | Trigger | Limit |
| --- | --- | --- | --- |
| Catalog | Five names and descriptions | Plugin discovery | Each description at most 80 words. Include positive and negative trigger intent. |
| Skill | One complete `SKILL.md` | User invocation or intent match | Each at most 900 words. All five at most 3,500 words total. |
| Route resource | Only the reference named by the selected mode or condition | A concrete route decision | One level below `SKILL.md`. Each at most 1,200 words. |
| Repository evidence | Relevant files, contracts, tests, and commands | Active bounded question or slice | Search narrowly. Do not preload repository summaries. |
| Work artifact | Relevant section and latest checkpoint | Resume, handoff, or requested audit | Do not load all logs or duplicate Git and test evidence |

Additional controls:

- No public Workflow skill invokes another public Workflow skill. Shared principles are stated once in the owning skill or a conditionally loaded reference.
- Activating `planning` loads no template until the requested artifact is known. It loads exactly one of `spec.md`, `plan.md`, or `tasks-and-tickets.md`.
- `engineering` does not load debugging instructions for straightforward implementation, delegation instructions when no subagent is used, or specialized tool guidance when repository-declared checks are sufficient.
- `grill-me` and `walkthrough` are excluded from implicit activation. Their logs are updated at decisions and slice checkpoints, not after every conversational turn.
- Work artifacts externalize only goal, decisions, current state, evidence, and unresolved items. They do not store transcripts, repeated instructions, full diffs, or hidden reasoning.
- A delegated agent receives its node contract, owned files, required inputs, and verifier. It does not receive the entire parent conversation unless the task genuinely depends on it.
- The main thread keeps only the active slice and compact results from completed nodes. Git, tests, and live tracker data remain the source of truth.

### Simplified Engineering Workflow storage

`~/.engineering-workflow` remains a user-readable filing cabinet rather than a workflow database:

```text
~/.engineering-workflow/
└── <work-item>/
    ├── SPEC.md
    ├── PLAN.md
    ├── TASKS.md
    ├── grills/
    └── walkthroughs/
```

The new skills use plain Markdown and normal file operations. They do not maintain duplicated repository/topic trees, lifecycle directories, manifests, generated links, branch identifiers, pointer files, strict line schemas, or custom update commands. Artifacts are optional and selected by the activity. The agent reads only the current artifact or section.

Existing `~/.engineering-workflow` content remains untouched during implementation and upgrade. After Workflow v2 is verified and released, a separate optional migration may inventory legacy data, copy it into the simplified layout, compare the source and destination, and request explicit approval before removing any legacy file.

## Goal

Replace the current 24-skill Workflow bundle with five progressively disclosed skills that preserve the useful planning, implementation, review, writing, walkthrough, and audit-trail capabilities while reducing instruction overlap, runtime machinery, token overhead, unnecessary scope, and unverifiable ceremony.

## Non-goals

- Do not implement an autonomous scheduler, recurring background loop, task queue, graph engine, or self-modifying workflow.
- Do not make every engineering request create a specification, plan file, task file, log, branch, worktree, commit, or pull request.
- Do not claim that SWE-bench proves long-term maintainability, reduced human review time, or reduced human correction effort.
- Do not use raw automated-reviewer findings as a release score. The gold calibration invalidated that interpretation.
- Do not automatically install ESLint, Fallow, type checkers, coverage tools, security scanners, or other project dependencies.
- Do not automatically migrate, rewrite, archive, or delete `~/.engineering-workflow` or `~/.field-guide` data.
- Do not redesign Field Guide in this slice. Move its skill, utility, schemas, and automatic hooks into a separately installable optional plugin with no Workflow dependency.
- Do not preserve compatibility aliases for removed public skills. Aliases would retain catalog noise and ambiguous routing.
- Do not commit, publish, release, or update installed plugin caches as part of plan creation or implementation without separate authority.

## Success criteria

1. The Workflow runtime contains exactly five public skill directories: `engineering`, `planning`, `grill-me`, `technical-writing`, and `walkthrough`.
2. Only `engineering` and `planning` perform general routing. `grill-me` and `walkthrough` require explicit invocation. `technical-writing` performs a bounded writing transformation.
3. The five top-level `SKILL.md` files contain at most 3,500 words total and at most 900 words individually. Each reference is one level deep and at most 1,200 words.
4. No public Workflow `SKILL.md` invokes or requires another public Workflow skill. Contract tests reject `$workflow:` chains inside the new skill bodies.
5. Contract fixtures define positive and near-miss activation cases. A model-based smoke run confirms that each description selects its intended requests without making manual skills implicit.
6. An authorized meaningful code-change trace shows a plan before edits, test-first or reproduction evidence when behavior changes, the smallest scoped implementation, deterministic verification, a separately identifiable reviewer when independent review is required, and a concise final audit trail.
7. Self-review is never reported as independent review. Independent review evidence identifies a separate agent or context and the exact patch or range inspected.
8. The implementation changes no unrelated application files and adds no speculative runtime framework, schema engine, or dependency.
9. The Workflow manifest contains no hook entry. Its runtime payload contains no lifecycle hook, Node launcher, Engineering Workflow storage script, Field Guide implementation, or automatic external-state mutation. The optional `field-guide` plugin owns those Field Guide surfaces.
10. `~/.engineering-workflow` is documented as optional plain-Markdown storage. Existing legacy data remains usable and untouched until an explicitly authorized migration.
11. Repository-declared tests, types, lint, formatting, and build checks are selected before optional tools. Fallow is used only for JavaScript/TypeScript graph and changed-code signals, with JSON output and preserved exit semantics. Findings are inspected rather than treated as deletion proof.
12. All local Workflow contract, payload, and manifest checks pass.
13. A zero-cost PluginBench smoke dry run passes before any paid evaluation.
14. In a fresh matched SWE-bench comparison, Workflow v2's total implementation-token overhead is at most 10% versus baseline. It does not lose more than one paired task-attempt relative to the compact core arm and does not underperform baseline overall.
15. Historical full-bundle results remain context only. The v2 decision uses fresh baseline, core, and v2 arms with identical tasks, model, reasoning, harness, timeout, and attempt count.
16. Reviewer-proxy output is reported as uncalibrated diagnostic evidence. Official SWE-bench verification remains the primary behavior signal.

## Bounded subtasks

### 1. Add failing Workflow v2 contract tests

**Files:**

- Add `tests/workflow/contract-scenarios.json`.
- Add `tests/workflow/validate-contracts.mjs`.
- Update `tests/workflow/plugin-payload-policy.test.mjs`.
- Update `scripts/validate-plugins.mjs` only where the five-skill contract needs deterministic validation.

**Expected outcome:** Tests initially fail against the 24-skill bundle. They assert the exact inventory, manual-only skills, word and reference budgets, absence of skill-to-skill chains, absence of hooks/storage runtime, required route language, artifact behavior, and activation-fixture coverage. Model behavior remains an evaluation concern.

**Verification:** `node tests/workflow/validate-contracts.mjs` fails for named v1 violations before implementation and passes only after the remaining subtasks satisfy the contract.

### 2. Build the `engineering` skill around one evidence loop

**Files:**

- Add `plugins/workflow/skills/engineering/SKILL.md`.
- Add `plugins/workflow/skills/engineering/agents/openai.yaml` only if the host metadata remains necessary.
- Add focused references under `plugins/workflow/skills/engineering/references/`: `testing-and-debugging.md`, `verification-tools.md`, and `delegation-and-review.md`.

**Expected outcome:** The skill absorbs the necessary behavior from `coordinator`, `implementation`, `minimal-code`, `systematic-debugging`, `receiving-code-review`, `review-cycle`, `simplification-review`, `subagent-driven-development`, and `using-git-worktrees` without reproducing their catalog or cross-invocation graph.

The top-level skill contains only the contract, route conditions, core loop, stop conditions, and audit-trail requirements. Testing/debugging is read only for behavioral changes or failures. Delegation/review is read only when work divides cleanly or requires independence. Verification tools are selected from repository configuration and changed risk, not run as a universal checklist.

**Verification:** Contract scenarios prove plan-before-edit, proportional test-first behavior, reuse-first minimality, bounded scope, deterministic checks, separate review evidence, repair/re-verification, authority stops, and concise handoff.

### 3. Build `planning` as an artifact router

**Files:**

- Add `plugins/workflow/skills/planning/SKILL.md`.
- Add `plugins/workflow/skills/planning/agents/openai.yaml` only if needed.
- Add `plugins/workflow/skills/planning/references/spec.md`.
- Add `plugins/workflow/skills/planning/references/plan.md`.
- Add `plugins/workflow/skills/planning/references/tasks-and-tickets.md`.

**Expected outcome:** A conversational design exploration needs no file. A requested specification, implementation plan, task file, or ticket set loads exactly one matching reference and produces only that artifact. Spec-to-ticket decomposition is a ticket mode, not another skill. Creating or editing Jira/GitHub work still requires explicit external authority.

**Verification:** Scenarios distinguish exploration, specification, implementation plan, local task state, ticket drafting, live ticket mutation, and near-miss writing requests. Static checks prove the skill does not instruct the agent to load unused templates. The model-based smoke confirms actual route selection.

### 4. Simplify `grill-me` while preserving its explicit interaction

**Files:**

- Replace `plugins/workflow/skills/grill-me/SKILL.md`.
- Replace `plugins/workflow/skills/grill-me/agents/openai.yaml`.
- Replace `plugins/workflow/skills/grill-me/references/grill-log.md` with a concise checkpoint format.

**Expected outcome:** `grill-me` activates only when explicitly requested. It inspects discoverable evidence, asks one consequential question at a time, gives a concise recommended answer, challenges weak assumptions, and ends with resolved decisions, remaining risks, and recommended artifact changes. Its log records decision checkpoints rather than every turn and needs no topic setup utility.

**Verification:** Scenarios prove explicit-only activation, one-question sequencing, evidence-before-question behavior, distinction between recommendation and user decision, and bounded log content.

### 5. Build `technical-writing` as a focused transformation

**Files:**

- Add `plugins/workflow/skills/technical-writing/SKILL.md`.
- Add `plugins/workflow/skills/technical-writing/agents/openai.yaml` only if needed.
- Add `plugins/workflow/skills/technical-writing/references/pr-description.md` only if the PR format cannot remain concise in the top-level skill.

**Expected outcome:** The skill absorbs the useful parts of `ste-writing` and `writing-pr-descriptions`. It applies BLUF, STE-style wording, short sentences, consistent terminology, and artifact-specific constraints after the technical content is settled. It does not invent design decisions, re-run planning, or load unrelated templates. Skill-authoring guidance becomes repository-maintainer documentation or uses the host's dedicated skill-creation capability rather than remaining a public Workflow runtime skill.

**Verification:** Scenarios prove concise technical prose, preservation of identifiers/code/commands, no change to settled meaning, and PR-specific loading only for PR requests.

### 6. Merge walkthrough modes without retaining the state machine

**Files:**

- Replace `plugins/workflow/skills/walkthrough/SKILL.md`.
- Replace `plugins/workflow/skills/walkthrough/agents/openai.yaml`.
- Replace `plugins/workflow/skills/walkthrough/references/presentation-patterns.md` with a concise slice protocol.
- Replace `plugins/workflow/skills/walkthrough/references/walkthrough-log.md` with a checkpoint format.
- Add `plugins/workflow/skills/walkthrough/references/presenter.md` only for separate-agent mode.

**Expected outcome:** One explicit skill supports a conversational presenter or a separate read-only presenter. It resolves an exact diff or branch range, accounts for changed files, presents one coherent slice, records decisions and corrections, and stops for user acceptance. It does not maintain correction IDs, generated manifests, duplicated branch state, or automatic implementation routes.

**Verification:** Scenarios prove explicit-only activation, exact range, complete changed-file coverage, one-slice progression, read-only presenter behavior, correction capture, and concise checkpoint logging.

### 7. Remove superseded skills and runtime machinery

**Files:**

- Remove every skill directory under `plugins/workflow/skills/` except the five v2 directories.
- Remove `plugins/workflow/hooks/`.
- Remove `plugins/workflow/scripts/run-node.sh`.
- Remove the Engineering Workflow storage utility. Move the Field Guide skill, utility, schemas, hooks, and Node launcher into `plugins/field-guide`.
- Remove superseded per-skill validators and fixtures under `tests/workflow/skills/` and `tests/workflow/hooks/` after the unified v2 contracts cover their retained behavior.

**Expected outcome:** Workflow contains no hidden lifecycle, custom database, legacy aliases, or nested public workflow. Field Guide is installed independently and existing external user data is not touched.

**Verification:** Inventory commands show exactly five Workflow skill directories and no Workflow hooks or storage scripts. Separate plugin contracts verify Field Guide ownership and marketplace installation.

### 8. Simplify manifests, dependencies, documentation, and checks

**Files:**

- Update `plugins/workflow/.codex-plugin/plugin.json`.
- Update `plugins/workflow/.claude-plugin/plugin.json`.
- Update `README.md`.
- Update `plugins/workflow/THIRD_PARTY_NOTICES.md` only after checking which adapted text remains.
- Keep `ajv` while the standalone Field Guide schema contracts use it.
- Update `scripts/plugin-payload-policy.mjs` and `scripts/validate-plugins.mjs` only as required by the simplified payload.

**Expected outcome:** The manifests describe the five capabilities concisely, remove the hook entry, and avoid a long default prompt that pre-routes every task. README documents the five skills, exact progressive disclosure, paper trails, loop/graph boundary, safe tooling policy, legacy-data preservation, and breaking migration. The check script has one Workflow contract entry rather than a script per removed skill.

**Verification:** `pnpm check`, manifest validation, dependency inspection, and runtime inventory pass. `ajv` remains justified by Field Guide schema tests.

### 9. Run proportional static and independent review

**Files:** No new runtime files unless a verified finding requires a bounded correction.

**Expected outcome:** Repository tests and plugin contract checks run first. Fallow audits changed JavaScript/TypeScript surfaces with `--format json --quiet`. Exit 0 means clean and exit 1 means findings. Every finding is checked against dynamic plugin entry points before any deletion. A separate reviewer inspects the exact final diff and receives the plan, success criteria, verification results, and no coaching toward acceptance.

**Verification:** The handoff records command results, any dismissed false positives with evidence, reviewer identity/context, reviewed range, valid corrections, and re-verification.

### 10. Evaluate Workflow v2 with existing PluginBench SWE-bench support

**Files in the PluginBench repository:**

- Add a small `benchmarks/filip-stack-v2/eval.yaml` only if the existing CLI cannot express the fixed seven-task, repeated-attempt run without a checked-in configuration.
- Reuse the existing SWE-bench task snapshot, official grader, core skill bundle, reporting code, and saved-study conventions.

**Expected outcome:** First run a zero-cost dry run and a three-task smoke. After explicit approval for model usage, run fresh matched baseline, core, and v2 arms on the seven previously comparable tasks with three attempts per task and arm. Keep model, reasoning, dataset revision, harness, timeout, concurrency, and task order identical. V2 exposes the full five-skill catalog. A code-change task should normally activate only `engineering`.

Primary metrics are official tasks passed, paired task-attempt outcomes, total implementation tokens, uncached input, output, duration, and infrastructure failures. Process trace checks record which skill and references loaded, whether planning preceded edits, focused verifier evidence, changed-file scope, and whether review was truly independent. Reviewer-proxy findings remain diagnostic and are never combined into a quality score.

**Verification:** The smoke run must complete without infrastructure errors. The decision run must satisfy success criteria 14–16. If it does not, revise or remove instructions one group at a time and rerun the smallest discriminating subset before another full run.

### 11. Offer a separate legacy storage migration after release verification

**Files:** Existing user-owned files under `~/.engineering-workflow`. No migration code is part of the core v2 runtime.

**Expected outcome:** Only after v2 is installed and verified, an explicitly authorized migration inventories the legacy tree, proposes mappings into the flat work-item layout, copies files, compares byte content or normalized document content where links must change, reports ambiguities, and waits for explicit approval before deleting legacy paths.

**Verification:** Source inventory equals destination inventory after accounted transformations. Ambiguous items remain untouched. A retained backup exists until the user approves cleanup.

## Files touched

**Plan source**

- `WORKFLOW_V2_PLAN.md`

**New or replaced runtime skills**

- `plugins/workflow/skills/engineering/**`
- `plugins/workflow/skills/planning/**`
- `plugins/workflow/skills/grill-me/**`
- `plugins/workflow/skills/technical-writing/**`
- `plugins/workflow/skills/walkthrough/**`

**Separate optional Field Guide plugin**

- `plugins/field-guide/.codex-plugin/plugin.json`
- `plugins/field-guide/.claude-plugin/plugin.json`
- `plugins/field-guide/hooks/**`
- `plugins/field-guide/scripts/run-node.sh`
- `plugins/field-guide/skills/field-guide/**`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`

**Removed runtime surfaces**

- All other directories under `plugins/workflow/skills/`
- `plugins/workflow/hooks/**`
- `plugins/workflow/scripts/run-node.sh`

**Plugin metadata and documentation**

- `plugins/workflow/.codex-plugin/plugin.json`
- `plugins/workflow/.claude-plugin/plugin.json`
- `plugins/workflow/THIRD_PARTY_NOTICES.md`
- `README.md`

**Repository checks and dependencies**

- `tests/workflow/contract-scenarios.json`
- `tests/workflow/validate-contracts.mjs`
- `tests/workflow/plugin-payload-policy.test.mjs`
- `tests/field-guide/**`
- Superseded files under `tests/workflow/skills/**` and `tests/workflow/hooks/**`
- `scripts/plugin-payload-policy.mjs`
- `scripts/validate-plugins.mjs`
- `package.json`
- `pnpm-lock.yaml` only if dependency changes require it

**Evaluation configuration, only if required in PluginBench**

- `benchmarks/filip-stack-v2/eval.yaml`

**Explicitly untouched during core implementation**

- `~/.engineering-workflow/**`
- `~/.field-guide/**`
- Root marketplace versions and release-generated files until publication is separately authorized

## Verification commands

Run from the Filip Stack repository unless noted:

```sh
node tests/workflow/validate-contracts.mjs
node tests/field-guide/validate-plugin-boundary.mjs
node tests/field-guide/validate-contract.mjs
node --test tests/field-guide/field-guide-lifecycle.test.mjs
node --test tests/field-guide/field-guide.test.mjs
node --test tests/workflow/plugin-payload-policy.test.mjs
pnpm validate-plugins
pnpm check
git diff --check
```

Inventory and context budgets:

```sh
find plugins/workflow/skills -mindepth 1 -maxdepth 1 -type d -print | sort
wc -w plugins/workflow/skills/*/SKILL.md
wc -l plugins/workflow/skills/*/SKILL.md
rg -n '\$workflow:' plugins/workflow/skills/*/SKILL.md
rg -n 'engineering-workflow|field-guide|hooks|run-node' plugins/workflow package.json tests/workflow scripts
```

Expected inventory results:

- `find` prints exactly the five v2 skill directories.
- `wc` stays within the individual and total budgets.
- The `$workflow:` search produces no public skill-chain matches.
- Storage/hook searches find only migration or historical documentation that the plan intentionally retains. They find no v2 runtime dependency.

Changed-code audit after implementation, with the actual base ref substituted:

```sh
fallow audit --base <base-ref> --format json --quiet --explain
```

Treat Fallow exit codes 0 and 1 as completed analysis. Inspect every finding. Do not convert an unused-file report into deletion proof without checking plugin manifests and dynamic host entry points.

Zero-cost PluginBench checks from the PluginBench repository:

```sh
PATH=/opt/homebrew/bin:$PATH .venv/bin/pluginbench doctor benchmarks/filip-stack-v2/eval.yaml
PATH=/opt/homebrew/bin:$PATH .venv/bin/pluginbench run benchmarks/filip-stack-v2/eval.yaml --dry-run
```

Any paid smoke or decision run requires separate approval after the dry-run trial count and estimated exposure are reviewed.

## Risks / assumptions / open questions

- **Field Guide boundary:** Field Guide leaves the Workflow v2 runtime but remains available as a separately installable optional plugin with its automatic lifecycle hook. Existing `~/.field-guide` data remains untouched. Users who do not install it incur no Field Guide hook context.
- **Router activation:** A broad `engineering` description could activate for simple questions or read-only reviews. Positive and near-miss routing tests must be treated as product tests, not frontmatter lint.
- **Router size:** Consolidation can recreate the old problem inside two large skills. The word budgets, one-level references, route-specific loading, and no public skill chaining are release gates.
- **Reference loading is agent-mediated:** The Agent Skills model supports lazy resources, but the skill must state exactly when to read each reference. Vague “read all references” language would defeat progressive disclosure.
- **Artifact location:** The flat `~/.engineering-workflow/<work-item>/` convention is intentionally simple. If automatic work-item discovery requires manifests, repository mirrors, or lifecycle synchronization, stop and require an explicit user-selected path instead of rebuilding v1.
- **Paper-trail tradeoff:** Logs reduce context across compaction and handoff only when curated. Per-turn writes, transcripts, duplicated diffs, or repeated test output would increase context and tool cost again.
- **Graph boundary:** Task graphs help only when dependencies, parallelism, handoff, or recovery are real. Do not generate DAG schemas or diagrams for a short linear task.
- **Loop boundary:** The engineering repair loop is interactive and task-scoped. Scheduling, unattended retries, budgets across runs, or host-enforced recurrence belong to a separate loop runner and require their own evaluation.
- **Independent review cost:** Separate review adds tokens. Select it proportionally for meaningful changes, record whether it found a valid issue, and compare its cost and yield. Do not satisfy the rule with self-review or an unevidenced claim.
- **Evaluation power:** Seven tasks with three attempts are still a small sample. Use paired outcomes and confidence intervals where available, avoid general claims, and add more tasks only after the smaller run shows a reason.
- **Maintainability limits:** SWE-bench primarily tests issue resolution. Diff scope, complexity, and reviewer observations are proxies. Follow-on extension tasks would be required to measure long-term reuse and maintainability directly.
- **Human correction limits:** The current plan does not claim to measure real human corrections. A later bounded repair-loop experiment could feed official verifier failures back to each arm and compare successful repair cycles, tokens, and time without presenting that as human effort.
- **Breaking release:** Removing public skills and hooks is a breaking change. Use a major version and explicit migration notes. Publishing remains separately authorized.
