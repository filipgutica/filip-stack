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
  two-run stability check does not apply.
- Bundle: `tasks/` holds each task's inputs, the same for both versions.
  `A/` and `B/` hold each version's outputs under the same `<task>-<n>`
  names. Never include the guidance, its diff, or the ledger, so a judge
  rates the work against the task, not the instructions.
- Gates: the guidance's own checks, such as the repository's validators.

## Costs

Attempts count as member calls: each round adds one per attempt for the
candidate. Reserve the baseline's attempts and the baseline comparison with
the final check.

## Compare with the baseline

After the final check, compare the final version with the baseline, even when
no round was accepted, so the report always shows whether the guidance beats
no guidance. Under `judges` and `both`, send one more judge pass, built like
a round's bundle, with the baseline as one version. Under `score` and `both`,
compare the two scores. Report this comparison in its own section, and record
it in the run record's `final.notes`.
