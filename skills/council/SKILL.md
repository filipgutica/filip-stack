---
name: council
description: Gather independent opinions when the user, guidance, or another skill asks for a council on a question, decision, plan, design, document, or code. The request can set members, goal, and criteria; otherwise Sol 6.2, Opus 5.5, and Gemini 4 Neon answer a question an independent designer agent frames, and Fable 5.2 makes the final call when they disagree. A score threshold such as `council 9.5` with full-send or full-stop runs full-send's council gate.
---

# Council

Use independent opinions from several models to help answer the request. You coordinate and synthesize in the current thread. You do not frame a council on your own question or work: a separate designer does, so the criteria do not favor your preferred answer.

## Design the council

The request may set any of these. A user, global guidance, or a calling skill such as `hill-climb` can make the request. When the request runs `full-send` or `full-stop` with a score threshold, such as `council 9.5`, or a bare `council`, full-send's council gate sets the score, rounds, and verdict, and replaces this skill's Arbitrate and Synthesize steps.

- **Goal:** the question to decide or the output to produce.
- **Criteria and constraints:** what makes an answer useful, and limits it must respect.
- **Members:** a model and effort for each, and optionally a lens, such as security, user experience, or maintainability.
- **Rounds:** one by default. A designer sets at most three.

The members are the default lineup in Convene unless the request names others. Use the fields the request sets as given. When the request names the members, frame the remaining fields from the request without a designer.

When the request names no members, start one designer before the members: Opus 5.5 at high effort, read-only, with no further delegation. If it is unavailable, use Sol 6.2. Send it the request in the requester's words, the context and artifacts, the fields already set, and the default lineup. Do not send your preferred answer. Ask it to return:

- The goal, criteria, and constraints.
- An optional lens for any member; a lens adds focus to the full shared brief and does not replace it.
- The number of rounds. Plan two or three when a proposal or artifact gains from revision between rounds, such as a plan you revise. Keep one for an open question.
- Any question about the requester's goal or intent that no source answers and whose answer would change the design. The designer settles lenses and other internal choices itself.

Relay the designer's questions to the user and wait for answers. Then use its design unchanged. If no designer can run, frame the fields from the request and say so. State the design in one line when you launch.

## Frame the question

Give every member the same question, relevant context or artifact, constraints, and criteria for a useful answer. Preserve the user's uncertainty. For an open question with nothing to build, omit your preferred answer.

When the request asks for thoughts on work to do, such as a change, plan, or design, and supplies no proposal, write one after the design is set: draft it yourself, or have the Planner role draft it when host guidance sends that design work there. Members review that proposal. When the requester supplies a proposal, members review theirs. For changing artifacts, identify the version reviewed, such as commit SHAs and any uncommitted diff.

Council members advise read-only. A council request alone does not authorize implementation, publication, or merging.

## Convene

Default lineup:

| Member | Model | Effort |
| --- | --- | --- |
| Sol 6.2 | `gpt-6.2-sol` | high |
| Opus 5.5 | `claude-opus-5-5` | high |
| Gemini 4 Neon | `gemini-4-neon` | high |

Fable 5.2 (`claude-fable-5-2`, high effort) is the arbiter, not a member: it runs only as Arbitrate describes.

In T3 Code, resolve targets with `orchestrator_capabilities`, then use `delegate_task` for each member and the arbiter. Search for an omitted model before declaring it unavailable. Map effort through the model's advertised `target.options`, such as `thinking_level` for Gemini 4 Neon on the Antigravity provider. The default lineup uses three providers: Codex for Sol, Claude for Opus, and Antigravity for Neon.

Elsewhere, use the host's subagent tools only when they can reach the requested models and effort.

Never silently substitute a model. If a member the requester or a calling skill named is unavailable, ask whether to change the lineup or proceed with fewer members. If a default member is unavailable, drop it and report the change. A council needs at least two members. If a member fails after launch, retain the completed opinions and label the council incomplete.

Launch the members in parallel with separate contexts and no access to each other's responses. Each brief includes:

- The shared question, context, constraints, and criteria, plus the member's lens if it has one.
- Read-only responsibility, permitted sources, and any relevant instruction files.
- A request for a recommendation, a score from 0 to 10, supporting evidence or reasoning, the strongest objection or alternative, and material uncertainties. For a proposal or artifact, the score rates it against the criteria, and the recommendation lists the changes that would raise the score. For an open question, the score is confidence that the member's own recommendation is right. A calling skill may replace the score with its own, such as a judge's vote or scorecard.
- A direction to do the work themselves without further delegation.

Follow the host's completion mechanism and collect every member's response before synthesis. Check each response against the evidence as it arrives, and change nothing a running member still reviews. Do not wait for a member the requester marks non-blocking; synthesize without it and name it as pending in the answer and the report. Run the rounds the design sets. When the proposal is your draft, revise it before each later round for the findings you accept. Send each later round the current version, a ledger of earlier findings marked fixed, declined with a reason, or open, and no earlier scores. When you may not change the proposal or artifact, a later round takes up the questions the last one left open. Stop early when a round leaves no finding that would change the recommendation. Run more rounds than the design sets only when the user requests it or a specific unresolved question warrants it within the authorized task.

## Arbitrate

Skip this step when a calling skill sets its own verdict, such as full-send's council gate or `hill-climb`.

After the last round, when members recommend conflicting actions, start Fable 5.2 at high effort in a fresh context, read-only, with no further delegation. Send it the shared question, criteria, and constraints, and each member's recommendation, evidence, and strongest objection, attributed by member. Leave out the scores. Ask it to rule which recommendation stands, or to give its own, with the evidence that decides it. Its ruling is the council's recommendation. Agreement that differs only in detail needs no arbiter.

If Fable 5.2 is unavailable, synthesize without a ruling and leave the disagreement for the requester to decide.

## Synthesize

Check consequential claims against available evidence. Weigh reasoning rather than counting votes; keep material dissent visible.

Return a concise answer with:

- The recommendation and its rationale, and the arbiter's ruling when one ran.
- Each member's position, attributed to the model that actually ran.
- Useful agreement, disagreements, and uncertainties that affect the decision.
- The next action, including any decision the user must make.

Report missing members or unverified model settings beside the conclusion. Council advice remains tied to the question and artifacts supplied. Continue any separately authorized work under its existing constraints.

## Report

Write a report for every council run, including runs a calling skill convenes, and link it in your answer. Use the path the requester gives, otherwise `${TMPDIR:-/tmp}/council/<UTC timestamp>-<subject-slug>/report.md`, a temporary location like the run directories of `hill-climb`. A requester who needs a lasting record names a path. Invoking the skill authorizes this one file.

The report contains:

- The question, criteria, and reviewed version of any artifact.
- The design: who set it (requester or designer), and each member's model as it actually ran, effort, and lens.
- The arbiter's ruling and reason, when one ran.
- One table per round, with one row per member: position, score, and strongest objection. Mark a missing or late member.
- The outcome: the recommendation or the calling skill's verdict, material dissent, and the next action.

When a calling skill keeps its own record, such as a ledger, link it instead of copying its detail. Write summaries only: no transcripts, credentials, or full source.
