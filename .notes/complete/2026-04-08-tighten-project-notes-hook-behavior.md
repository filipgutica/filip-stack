---
title: "tighten project notes hook behavior"
status: "complete"
created: "2026-04-08"
started: "2026-04-08"
completed: "2026-04-08"
tags: ["notes"]
---

# tighten project notes hook behavior

## Planning Seed

Created from session prompt.

Original request: tighten project notes hook behavior

## Approved Plan
refine Codex versus Claude gating, clarify prompt-command behavior, and verify stop
  logging only appends for tracked sessions

Not started.

## Completion Criteria

- The shared notes hook should only handle deterministic state, gating, and reminders.
- Planning, approval, work-log writing, and completion transitions should be model-driven instead of script-authored.
- Prompt-time reminders should replace stop-time work-log warnings.
- The hook tests and documentation should match the simplified contract.

## Work Log
- 2026-04-08 Bash: sed -n '1,220p' .notes/todo/2026-04-08-tighten-project-notes-hook-behavior.md; Bash: if [ -f .notes/.runtime/$CODEX_THREAD_ID.json ]; then sed -n '1,220p' .notes/.runtime/$CODEX_THREAD_ID.json; else echo 'missing runtime file'; fi
- 2026-04-08 I simplified the notes hook so the plan workflow is now model-driven instead of script-driven. In [project-notes-hook.mjs](/Users/filip.gutica@konghq.com/code/filip-stack/hooks/shared/project-notes-hook.mjs), the script no longer appends planning seeds, parses planner output, or

- 2026-04-08 Yes. Same conclusion. The script is still carrying too much of the planning lifecycle in code. If you want the hook system to stay simple and durable, the script should not be: - appending planning seed text into the ticket - parsing `<proposed_plan>` blocks - deciding what the a

- 2026-04-08 Yes, it was doing too much. I simplified it so the hook now stays in the narrow lane you described. In [project-notes-hook.mjs](/Users/filip.gutica@konghq.com/code/filip-stack/hooks/shared/project-notes-hook.mjs), `Stop` no longer tries to synthesize or append work-log prose. It

- 2026-04-08 Yes, and that is the cleaner model. Right now the script is doing too much because it is trying to author the work log itself. The better design is: - the hook script manages state and policy It checks whether a ticket is bound, whether a plan exists, and whether a work-log updat

- 2026-04-08 Yes. At this point it is doing too much for one hook script. The strongest signal is just size and responsibility count: [project-notes-hook.mjs](/Users/filip.gutica@konghq.com/code/filip-stack/hooks/shared/project-notes-hook.mjs) is 822 lines and it currently owns: - hook I/O an

- 2026-04-08 The failure was from the Codex `Stop` hook writing plain text when Codex expects stop-hook JSON. I fixed that in [project-notes-hook.mjs](/Users/filip.gutica@konghq.com/code/filip-stack/hooks/shared/project-notes-hook.mjs), so Codex `Stop` now emits JSON on success instead of raw

- 2026-04-08 Bash: sed -n '1,260p' hooks/shared/project-notes-hook.mjs; Bash: sed -n '1,320p' tests/hooks/project-notes-hook.test.mjs; Bash: sed -n '430,610p' hooks/shared/project-notes-hook.mjs; Bash: sed -n '610,760p' hooks/shared/project-notes-hook.mjs; Bash: sed -n '760,860p' hooks/shared/project-notes-hook.mjs

- 2026-04-08 Bash: sed -n '1,260p' tests/hooks/project-notes-hook.test.mjs; Bash: sed -n '1,260p' .notes/in-progress/2026-04-08-tighten-project-notes-hook-behavior.md; Bash: sed -n '1,260p' skills/project-notes-tracker/SKILL.md

- 2026-04-08 Bash: sed -n '1,260p' skills/project-notes-tracker/SKILL.md; Bash: sed -n '1,320p' hooks/shared/project-notes-hook.mjs; Bash: sed -n '320,620p' hooks/shared/project-notes-hook.mjs; Bash: sed -n '1,220p' skills/planner/SKILL.md

- 2026-04-08 Moved the work-log reminder from `Stop` to `UserPromptSubmit` so the model can update this ticket during the active turn instead of surfacing a post-turn warning.

## Completion Summary

Simplified the shared project-notes hook so it only manages deterministic state, gating, and prompt-time reminders. Planning, approval, work-log updates, and completion transitions are now model-driven. Updated the docs and tests to reflect the smaller contract, verified the repo with `pnpm check`, committed the changes, and pushed them to `origin/main`.
