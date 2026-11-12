# Guidance climbs

Use this when the scope is guidance: a skill, an instruction file, or a
prompt. Guidance is judged by what agents produce while they follow it, so
each version's evidence is a set of attempts, not its own text.

## Add to the card

- **Task set:** two to five tasks with fixed inputs, kept outside the scope.
  Under `score` or `both`, every task needs an answer key, such as planted
  defects to find or facts a page must state, and the card freezes the tally
  rule: what earns or loses a point. A version's score is the mean tally
  across all its attempts. Without answer keys, use `judges`.
- **Attempts:** one attempt is one task done under one version. Every task
  gets the same number of attempts under every version, at least two. Fix
  one model and effort for all attempts.
- **Holdout:** one or two more tasks, built like the task set, that no
  propose brief, round bundle, or Prune copy ever includes. They show
  whether a gain carries beyond the tasks the climb learned from.
- **Baseline:** a version with no guidance, compared with the final version
  as the last section below describes.

## Isolate the attempts

An attempt must see the scoped guidance only through its folder. Put each
task's inputs in the prompt or in a copied folder, and tell the attempt to
read only those and its guidance folder. When the host loads the scoped
guidance on its own, as it loads a repository's `AGENTS.md` or a global
instruction file, an empty folder does not remove it, so the baseline is not
clean. Then run attempts from a place that does not load it, or stop before
round 1 and report that the baseline cannot be isolated.

## Run the attempts

1. For each version, copy the scoped guidance into its own folder under the
   work directory, with a random name. Record which folder holds which
   version only in `ledger.md`. The baseline folder is empty.
2. Run each attempt as a fresh subagent, convened the way `council` convenes
   members: in T3 Code, `delegate_task` with the card's model and effort.
   Every version gets the same prompt apart from its folder: read every file
   in the folder and follow it, skipping this when the folder is empty; then
   do the task. Attempts change no repository files and start no subagents.
3. Save each output as `<task>-<n>`, with the task's neutral name and the
   attempt number, in a folder per version. No name shows the version or the
   round.

Run the baseline's attempts once, before round 1, and keep their outputs for
the final comparison.

## Score and bundle

- Score: tally each output against its task's answer key with the frozen
  rule, in `ledger.md`. Recount any tally that decides a round. The tally
  stands in for the score command wherever `SKILL.md` runs one, and the
  baseline checks in `references/score.md` do not apply.
- Bundle: `tasks/` holds each task's inputs, the same for both versions.
  `A/` and `B/` hold each version's outputs under the same `<task>-<n>`
  names. Never include the guidance, its diff, or the ledger, so a judge
  rates the work against the task, not the instructions.
- Gates: the guidance's own checks, such as the repository's validators.

## Prune

A guidance climb looks for the shortest guidance that still improves the
work. Measure length as `wc -w` over the scoped files.

- Propose: give each member copies of the baseline's outputs and the
  incumbent's, labelled as such, and add this line to the brief: `Propose
  cuts as well as additions. Cut a line when the no-guidance outputs already
  do what it asks, when another line says the same, or when no output shows
  its effect. Rewrite a prohibition as the behavior to produce. Include at
  least one cut when one exists.`
- Apply: write each added or rewritten line as the behavior to produce. Keep
  a prohibition only for a hard limit that has no positive form, and put the
  behavior to produce beside it.
- Decide: a candidate with fewer words than the incumbent wins when it is no
  worse. Under `judges`, that means no strict majority of completed judges
  prefers the incumbent; under `score`, a score no worse than the
  incumbent's in the card's direction; under `both`, both. Any other
  candidate wins only by the rule in `SKILL.md`. A shorter candidate accepted
  this way does not trigger the `SAME` stop rule.
- Report the start and final word counts.

## Costs

Attempts count as member calls. Before round 1, the starting version's
attempts and the baseline's attempts are a one-time cost. Each round then
adds one call per attempt for the candidate. Reserve the baseline comparison
and the final version's holdout attempts with the final check. The starting
version's holdout attempts are part of the one-time cost.

## Check the holdout

Run the holdout attempts under the starting version before round 1, and
under the final version in the final check. Add their outputs to the final
check's scorecard bundle, and name their scorecard rows `Holdout: <task>`.
Under `score` and `both`, also tally them, and record both tallies in the
run record's `final.notes`.

Report the holdout apart from the task set. When the task set improved and
the holdout did not, say so first in the report, as a sign that the climb
fit its tasks rather than the work, and add it to the run record's
`attention`. The holdout improved when its mean scorecard score rose, or,
under `score` and `both`, when its tally beat the start by the smallest gain
that counts.

## Compare with the baseline

After the final check, compare the final version with the baseline, even when
no round was accepted, so the report always shows whether the guidance beats
no guidance. Under `judges` and `both`, send one more judge pass, built like
a round's bundle, with the baseline as one version. Under `score` and `both`,
compare the two scores. Report this comparison in its own section, and record
it in the run record's `baseline` field.
