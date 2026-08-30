---
name: agent-walkthrough
description: "Use when the user explicitly requests an automated agent walkthrough of a branch or pull request, or when a named-work-item end-to-end route has branch-level integration risk that requires a staff-level acceptance conversation."
---

# Agent Walkthrough

Run an evidence-based walkthrough between a read-only presenter agent and the main thread acting as staff reviewer.

This is a branch-level integration and comprehension gate. It does not replace the selected independent review tier or `$workflow:review-cycle`.

## Authority

The walkthrough and presenter are read-only. The presenter must not edit files, commit, push, publish, or accept work. This skill does not grant implementation authority.

An explicit invocation grants external-artifact authority for one curated walkthrough log under a confirmed topic. A coordinator-selected walkthrough under named-work-item end-to-end authority may create the same selected agent-walkthrough log. Neither path grants setup or topic-creation authority.

When the walkthrough confirms a required change, route the correction through `$workflow:coordinator`. Use the enclosing end-to-end authority when it covers the correction. Otherwise, require explicit implementation authority.

## Select the route

Run this skill when the user explicitly requests it for a complete branch or pull request.

The coordinator may also select it after branch-level checks in a named-work-item end-to-end route when branch-level integration risk remains. At least one of these conditions must apply:

- reviewed tasks interact in one end-to-end flow
- a public contract crosses producer and consumer boundaries
- migration, compatibility, or rollout behavior spans multiple slices
- final acceptance depends on behavior that no individual task review proves

Do not select it automatically for an isolated change, a mechanical update, or documentation-only work without branch-level integration risk.

## Resolve the source

Use an exact repository, base SHA, head SHA, and comparison range.

- **Branch:** verify the base ref, compute the merge base, and use `<base>...<head>`.
- **Pull request:** Verify the base and head SHAs from the provider. Make both commits locally inspectable. Confirm the checkout is at the verified head. Use the same `<base>...<head>` comparison. Keep the presentation protocol provider-neutral.

Report separate working-tree changes before the walkthrough. They are not part of a committed branch or pull-request range.

## Prepare the presenter

Read [presenter-protocol.md](references/presenter-protocol.md) before delegation.

Spawn one fresh read-only presenter with an explicit registered non-critic profile. Give it the goal, repository, exact range, relevant work-item constraints, verification evidence, and the presenter protocol. Do not use an implementation worker or adversarial critic as the presenter.

The presenter builds an ordered change map that accounts for every changed file. Order slices from public behavior and contracts through implementation, tests, and documentation.

Reuse the same presenter for every clarification, correction recheck, and remaining slice while its responsibility stays unchanged.

## Persist the walkthrough

Use the existing Walkthrough log contract. Confirm the source, topic, and slices. Then run setup `start-walkthrough` with `--source branch`, the base ref, the slices, and `--reviewer agent`.

If no confirmed topic exists and setup authority is absent, continue without a log and state that limitation. Do not create or attach a topic.

After each resolved slice, use `update-walkthrough`. Keep the summary, evidence, reviewer decision, and concrete correction separate. Use `none` when no correction was made. Do not store a raw transcript, prompt, response, hidden reasoning, full diff, or code excerpt.

## Staff-review loop

The main thread acts as staff reviewer and acceptance owner. For one coherent slice at a time:

1. Ask the presenter for the behavior, decision, smallest decisive evidence, verification, failure modes, and one focused question.
2. Inspect the live evidence before accepting or challenging the explanation.
3. Request clarification when the mechanism, boundary, or proof is incomplete.
4. Answer presenter questions only from the approved work item, live contract, or existing authority.
5. Return a material product or architecture decision to the user instead of inventing authority.
6. Classify a concern as valid, invalid, already addressed, out of scope, or blocked by missing evidence.
7. Mark the slice resolved only when the main thread understands and accepts its behavior and evidence.

Do not treat a concise explanation, silence, or test result alone as acceptance.

## Correction loop

For a valid correction:

1. Add a separate `open` correction to the current walkthrough slice.
2. Pause the walkthrough.
3. Route the bounded correction through `$workflow:coordinator` for implementation, verification, independent review, and commit handling.
4. Rerun affected branch checks.
5. Mark the correction `resolved`, or `deferred` only when the user or owning work item explicitly permits deferral.
6. Refresh the log with setup `start-walkthrough --log-file <name> --refresh-range --base-ref <ref>`.
7. Resume the same presenter with the refreshed exact range and evidence.
8. Revisit every affected or superseded slice before continuing.

The presenter never implements its own correction.

## Completion

Complete only when:

- every changed file belongs to a resolved slice
- every slice is covered or changed
- every correction is resolved or explicitly deferred
- no material decision still requires the user
- branch-level verification passes against the current head
- the required independent review tier and `$workflow:review-cycle` still cover the current diff and risk

Report the resolved slices, reviewer decisions, corrections, branch evidence, remaining limits, and whether the enclosing end-to-end route may proceed to final acceptance.
