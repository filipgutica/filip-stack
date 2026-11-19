# Council arbiter

Use this from the [council gate](council-gate.md) when you decline a finding
or the panel cannot settle one.

## Declined findings

When you decline a blocker or should, the next round's brief asks every other
member whether the declined finding is real:

- If any other member agrees, it stands. Fix it.
- If none agrees and it alone holds its author below `N`, it goes to the
  arbiter.

## When the arbiter runs

Fable 5.2 has the final say on findings the panel cannot settle. It runs only
while at least one member scores at least `N` on the current head, and only
for one of these:

- A declined blocker or should that no other member backs holds its author
  below `N`.
- Two members want opposite remedies.
- From round 2, while a member is below `N`, the lowest score did not rise
  and open blockers and shoulds did not shrink.

When every member is below `N`, no arbiter runs; the gate's Stop rules apply.

## Brief

Start Fable 5.2 at high effort in a fresh context, read-only, with no further
delegation. Send it the repository, head SHA and diff command, the frozen
intent and out-of-scope, the findings ledger, and each disputed finding with
its author's evidence and the opposing evidence. A disputed finding is every
open blocker or should that holds a member below `N`, or each side of
opposite remedies. Leave out `N` and every score, so the ruling rests on the
findings alone.

Ask it to rule on each disputed ID, with `file:line` evidence:

- **upheld:** the finding is real at its severity, or at the severity the
  arbiter names, or this remedy is the one to apply. Fix it as the gate's
  Answer findings describes; the new head starts a normal round within the
  round cap.
- **overruled:** the finding is not a blocker or should within the intent.
  Mark it `overruled by arbiter` in the ledger. It cannot reopen, and later
  round briefs show it as overruled.

## Limits

- The arbiter rules on findings, never on scores, and rules on each finding
  once. You never change a member's score.
- A finding the arbiter overrules no longer holds a member below `N`.
- A changed instruction file still goes to the user.
- If Fable 5.2 is unavailable or fails, a declined finding goes to the user
  with both sides in two or three lines, and the other cases fail the gate
  as Stop describes.
- Add an `Arbiter (claude-fable-5-2, high)` row to the gate's report table
  with each ruling, such as `S3 overruled, S4 upheld`.
