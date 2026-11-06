# Guidance climbs

Use this when the scope is guidance: a skill, an instruction file, or a
prompt. Guidance is judged by what agents produce while they follow it, so
each version's evidence is a set of attempts, not its own text.

## Add to the card

- **Task set:** two to five tasks with fixed inputs, frozen with the card.
  Give a task an answer key when it has one, such as planted defects to find
  or facts a page must state. Keep task files outside the scope.
- **Attempts:** one model and effort for every attempt, and the number of
  attempts per version, at least two.
- **Baseline:** a version with no guidance. The final check also compares
  the final version with it.

## Run the attempts

1. For each version, copy the scoped guidance into its own folder under the
   work directory, with a random name. Record which folder holds which
   version only in `ledger.md`. The baseline folder is empty.
2. Run each attempt as a fresh subagent, convened the way `council` convenes
   members: in T3 Code, `delegate_task` with the card's model and effort.
   Every version gets the same prompt apart from its folder: read every file
   in the folder and follow it, skipping this when the folder is empty; then
   do the task. Attempts read the task inputs, change no repository files,
   and start no subagents.
3. Save each attempt's output under a name that shows neither the version
   nor the round.

Attempts count as member calls. A round's cost adds one call per attempt to
the judge calls.

## Score and bundle

- Score: tally each output against its task's answer key in `ledger.md`, for
  example planted defects found minus false findings. The version's score is
  the mean across its attempts. Recount any tally that decides a round.
  This tally stands in for the score command wherever `SKILL.md` runs one,
  and the two-run stability check does not apply.
- Bundle: for each task, `A/` and `B/` hold one version's attempt outputs
  each, with matching names. Never include the guidance or its diff, so a
  judge rates the work, not the instructions.
- Gates: the guidance's own checks, such as the repository's validators.
