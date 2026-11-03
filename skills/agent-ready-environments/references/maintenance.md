# Maintaining this skill

This skill goes out of date in two ways:

- **Drift**: a source changes, so a cited claim is no longer what the vendor says.
- **Decay**: a new model follows some guidance by default, so a line becomes a no-op, or it does more harm than good.

Vendors retire their own advice as models catch up. Anthropic keeps a "What
you can stop doing" table and says that advice which starts to feel like
busywork probably belongs there too [A1]. This skill is guidance, so [pillar 8](pillar-8-guidance-evaluated.md)
applies to it: test it against the models it targets [A4], and add
instructions only where you have seen a failure [A2, O3].

## Triggers

Review this skill when any of these happens:

1. A frontier model that agents in scope use is released. For Claude, read its migration guide; the [migration guide index](https://platform.claude.com/docs/en/about-claude/models/migration-guide) lists them. For other vendors, read their release notes and prompting guide for that model.
2. A watched source changes. The watch list is the Sources list in [SKILL.md](../SKILL.md), plus the [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), the [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview), and the matching pages for each other vendor in scope.
3. An audit gives a result that a reviewer disputes, or a score that does not match how agents actually perform in that repository.
4. No review has happened for a quarter.

## Procedure

1. **Re-verify sources.** Fetch every source again. For each cited claim, mark it confirmed, changed, or removed. Read the vendor's "stop doing" or migration lists first; they list decay directly.
   Then run the **generation check**: mark each source published before the current model generation. A claim that only such a source supports is unconfirmed. Find a current source that restates it, cover it with the decay test in step 4, or delete it.
2. **Collect new guidance.** Record each new recommendation and each new harness mechanism, such as a new hook event or a new verification skill. Decide for each one: new pillar content, a change to an existing line, or nothing.
3. **Reclassify.** Go through the durable and decaying table and the placement rules again. Move items that the new guidance retires. Keep a line only if it still tells, checks, or bounds.
4. **Test for decay.** Fix the protocol before running it: the two reference repositories (one strong, one weak), a task set, the number of attempts per arm, a pass criterion for each task, and a cost budget the user approves. Run the whole guidance against no guidance on matched tasks, model, harness, and attempts. Then ablate one section at a time; a whole-guidance comparison cannot show which line is a no-op. Delete a section only when its ablation shows no difference. Strengthen or move a line that the model now ignores (see Placement in [SKILL.md](../SKILL.md)).
5. **Calibrate the rubric.** Scores for the reference repositories should stay stable from one model to the next unless the repositories changed. If a check now passes everywhere, it no longer separates strong from weak; make it harder or remove it.
6. **Resolve conflicts.** If vendors disagree, record both positions and how this skill reconciles them, as [pillar 4](pillar-4-documentation.md) does for documentation. Prefer the current vendor documentation over dated engineering posts, and dated posts over secondary summaries. A secondary summary is never the only source for a claim.
7. **Update.** Edit the claims. Update `Verified` for each source you re-fetched. Commit with a message that names the trigger and the claims that changed. Git history is the review log.
   In the filip-stack repository, also update the lesson for people, `docs/site/src/components/pages/AgentReadyEnvironmentsPage.vue`, wherever it repeats a claim you changed.

The review is complete when every cited claim has a current `Verified` date,
every line has passed the decay test or has been deleted, and the reference
scores are recorded in the commit message.

## Automation

A scheduled agent can run steps 1 and 2 each month and open a pull request or
an issue with the differences it found. Steps 3 to 7 need judgment and a
person's approval. The decay test costs money, because it runs paid evaluations.
