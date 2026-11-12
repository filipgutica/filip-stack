# Scores

Use this under the `score` and `both` decision rules. A score stands in for
the goal, so check that it can see the goal before the climb trusts it.

## Pick the measure

Count the work behind the goal when you can: requests, queries, bytes,
renders, or checker violations. A count repeats exactly, and a time moves
with the machine's load. Use a time only when no count fits, and mark the
score as timed on the card.

## Check it at baseline

Run these checks after you create the work directory, so Restore can undo
the deliberate edits. Make each deliberate edit in an existing scoped file,
since Restore removes no files outside a round. Record each result in
`ledger.md`. A failed check blocks the climb.

1. **Steady.** Run the command three times on the incumbent. When the three
   numbers agree, measure each version once. Otherwise set the card's runs
   to at least three, and take the median of the runs as the score. The
   smallest gain that counts must be larger than the spread of the runs,
   the largest number minus the smallest. When it is not, propose a larger
   gain or a count in place of a time.
2. **Sensitive.** Make one deliberate edit in the scope that should hurt the
   goal, such as removing a cache or adding a violation the checker knows.
   Measure, then Restore. The score must get worse by at least the smallest
   gain that counts.
3. **Hard to game.** Make one deliberate cheat in the scope, such as
   hard-coding the output for one scored input. Measure, run the gates, then
   Restore. A gate must fail, or the score must not improve. When neither
   happens, add a gate that catches the cheat and record it on the card, or
   name the gap under Not covered.

## Measure each version

- The score is the median of the card's runs.
- Under a timed score, measure the incumbent again in each round's Save
  evidence step, and compare the candidate with that number, not with the
  incumbent's recorded score. Both versions are then measured under similar
  load.

## Gaming fails the gate

Before you score a candidate, read its diff. It fails the gate when it
raises the score without improving the goal, for example when it:

- treats the scored inputs differently from other inputs;
- hard-codes or caches the expected outputs;
- skips, weakens, or removes a test, or hides an error;
- makes the measured work smaller instead of faster or better.
