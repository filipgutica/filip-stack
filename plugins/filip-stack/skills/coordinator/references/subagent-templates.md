# Subagent Prompt Templates

Use these templates to keep delegation consistent across Codex and Claude. Fill in only the task-specific details that matter.

When filling these templates, write the final prompt as prose rather than reproducing the section headers verbatim. The structure below is a checklist of what to cover, not a format to copy literally.

In Claude Code, pass the filled prompt to the `Agent` tool:
- Explorer → `Agent(subagent_type="Explore", model="haiku", prompt="...")`
- Critic → `Agent(subagent_type="Explore", model="sonnet", prompt="...")`
- Worker → `Agent(subagent_type="general-purpose", prompt="...")` (default model = sonnet)
- Integrator → `Agent(subagent_type="general-purpose", prompt="...")` (default model = sonnet)

In Codex, pass the filled prompt to `spawn_agent` and set the model explicitly:
- Explorer → `spawn_agent(agent_type="explorer", model="gpt-5.4-mini", message="...")`
- Critic → `spawn_agent(agent_type="explorer", model="gpt-5.4-mini", message="...")`
- Worker → `spawn_agent(agent_type="worker", model="gpt-5.4-mini", message="...")`
- Integrator → `spawn_agent(agent_type="worker", model="gpt-5.4-mini", message="...")`

Do not rely on inherited model selection in Codex. If the task needs stronger reasoning, escalate deliberately to `model="gpt-5.4"` and state why.

## Explorer Template

Use for read-only discovery.

```md
Role: explorer

Task:
<state the bounded question or surface to inspect>

Context:
<what the subagent needs to know that it cannot derive from the task alone — repo area, prior findings, relevant constraints, or key files already identified>

Scope:
- Allowed paths or subsystem:
- Explicit exclusions:
- Analysis lens:

Deliverable:
- main findings
- findings by category or hotspot when relevant
- confidence and evidence for each major finding
- likely touchpoints
- risks or unknowns
- areas that are not worth changing
- recommended next step for the main thread

Rules:
- read-only; do not edit files
- keep the scope bounded
- do not speculate beyond the evidence
- call out missing context explicitly
```

When the explorer is being used for simplification work, explicitly inspect for:
- ambiguity or hard-to-follow logic
- duplicated code or repeated logic
- dead or unused code
- overly-complex or unnecessary abstractions
- brittle structure or hard-to-extend organization
- weak separation of concerns
- dead, redundant, or low-value tests
- tests that do not assert meaningful behavior

Also call out when a suspected issue is not worth changing because the current complexity appears justified or the cleanup would mostly be stylistic.

## Worker Template

Use for bounded implementation.

```md
Role: worker

Task:
<state the exact change to implement>

Context:
<what the subagent needs to know that it cannot derive from the task alone — approved plan, prior explorer findings, relevant constraints, or key files already identified>

Ownership:
- files or areas you own:
- files or areas you must not change:

Requirements:
- preserve behavior unless stated otherwise
- follow the approved plan or fix path
- keep the diff minimal
- report any blocker or required deviation before widening scope

Validation:
- run the narrowest relevant checks you can
- report what you ran and what you did not run

Deliverable:
- summary of changes
- files changed
- validation run
- known limitations or blockers
```

## Integrator Template

Use only when multiple accepted worker outputs need reconciliation.

```md
Role: integrator

Task:
<state the integration or reconciliation work needed>

Context:
<summary of accepted worker outputs, the interfaces or conflicts to reconcile, and any constraints the workers were given>

Inputs:
- worker outputs or files to reconcile:
- interfaces or seams to align:

Requirements:
- do not restart exploration
- only make bounded integration edits
- preserve accepted worker intent unless an integration issue forces a correction

Validation:
- run focused validation on the integrated surface

Deliverable:
- summary of integration work
- files changed
- focused validation
- residual risks
```

## Critic Template

Use for bounded adversarial review of worker output before acceptance.

```md
Role: critic

Task:
<state the worker output, diff, or synthesis to challenge>

Context:
<what the critic needs to know that it cannot derive from the task alone — approved plan, worker findings, relevant constraints, or key files already identified>

Scope:
- Allowed paths or subsystem:
- Explicit exclusions:
- Review lens:

Deliverable:
- findings ordered by severity
- whether the result is acceptable or needs another pass
- concrete corrections or missing validation
- risks or unsupported claims

Rules:
- read-only; do not edit files
- keep the scope bounded
- stay adversarial and specific
- do not accept work
- call out missing evidence explicitly
```

## Flow Mapping

- Planning: use explorer templates only
- Review: use explorer templates only when extra evidence is needed; keep acceptance in the main thread
- Investigation: start with explorer, then hand off to worker if the fix path is clear
- Simplification: use explorer templates for analysis; use worker only if the user explicitly asks for edits
- Implementation: start with explorer when the path is not fully clear, then use worker; use critic for adversarial review of meaningful worker output; use integrator only when multiple worker results need stitching
