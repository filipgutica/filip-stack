# Council arbiter

Use this from the [council gate](council-gate.md) when you decline a finding
or the panel cannot settle one.

## Declined findings

When you decline a blocker or should, the next round's brief asks every other
member whether the declined finding is real:

- If any other member agrees, it stands. Fix it.
- If none agrees, it goes to the arbiter.

## When the arbiter runs

Fable 5.2 has the final say on findings the panel cannot settle. It runs only
while at least one member scores at least `N` on the current head. Each
trigger sets the findings it may rule on, and only those:

| Trigger | Eligible findings |
| --- | --- |
| A declined blocker or should that no other member backs | That finding |
| Two members want opposite remedies for a finding | That finding and both remedies |
| From round 2, while a member is below `N`, the lowest score did not rise and open blockers and shoulds did not shrink | The open blockers and shoulds of each member below `N` whose score did not rise, except those another member backs |

Send no other finding, even one that also holds a member below `N`. No
arbiter runs when every member is below `N`, or when the request names
Fable 5.2 as a member.

## Brief

Start Fable 5.2 at high effort in a fresh context, read-only, with no further
delegation. Send it the repository, head SHA and diff command, the frozen
intent and out-of-scope, and each eligible finding with its ledger entry,
its author's evidence, and the opposing evidence. Leave out `N` and every
score, so the ruling rests on the findings alone.

Ask it to rule on each eligible ID, with `file:line` evidence:

- **upheld:** the finding is real at its severity, or at the severity the
  arbiter names, or this remedy is the one to apply. In fix mode, fix it as
  the gate's Answer findings describes. In review-only mode, report it as
  open.
- **overruled:** the finding is not a blocker or should within the intent.
  Mark it `overruled by arbiter` in the ledger, and later round briefs show
  it as overruled. It reopens only when a later commit changes the code it
  cites; then it is a new finding.

## After a ruling

1. Apply the rulings: fix upheld findings in fix mode, and mark overruled
   ones.
2. When no fix changed the head, check the gate's pass rule on the current
   head. The arbiter clears a member below `N` only when that member names
   at least one finding and the arbiter overruled each one. A nit or a
   finding without a ruling still holds it below `N`.
3. Then apply the gate's round cap and no-progress check. An upheld finding
   after the third round fails the gate at the cap; the user can allow
   another round.

## Limits

- The arbiter rules on findings, never on scores, and rules on each finding
  once. You never change a member's score.
- A changed instruction file still goes to the user.
- If Fable 5.2 is unavailable or fails, a declined finding goes to the user
  with both sides in two or three lines, and the other cases fail the gate
  as Stop describes.
- Add an `Arbiter (claude-fable-5-2, high)` row to the gate's report table
  with each ruling, such as `S3 overruled, S4 upheld`.
