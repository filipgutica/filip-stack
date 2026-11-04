---
related: [council, sol-loop, merge-council]
---

## What it does

Hill climb polishes a change that already works. It runs a few rounds of
improvement. In each round, a blind council compares the current version with
a candidate. The skill keeps the candidate only when most judges prefer it and
every gate still passes.

## When to use it

Use it at the end of a thread when you are satisfied with a change and want a
little more quality before merge, such as tighter spacing or simpler code.
Add that focus to the invocation.

It runs only when you call it by name, with `/hill-climb` or `$hill-climb`.
It requires [council](../council/) and stops if council is missing. Council
gives one round of advice and changes nothing. [sol-loop](../sol-loop/) reviews
for correctness. Hill climb judges quality, taste, and design, and it is not
for fixing a broken change. [merge-council](../merge-council/) gives a merge
verdict on a pull request.

## How it works

1. Builds and freezes a climb card: goal, three to five criteria, scope, exact
   gate commands, evidence, a round budget of three (five at most), and a size
   limit of 30% of the original change or 20 lines, whichever is larger.
2. Runs every gate on the current version and stops if one fails or cannot
   run. It saves a snapshot outside the repository and refuses to start when a
   scoped file has staged changes.
3. Asks each council member for up to three ranked improvements, then applies
   the best supported ones as the smallest change within the size limit.
4. Gates the candidate, then gives each judge a fresh context and a bundle with
   the two versions labeled A and B in random order. For code, judges see each
   version's diff from the base. For UI, they see screenshots.
5. Keeps the candidate when a strict majority of at least two completed judges
   prefers it. Otherwise it restores the snapshot path by path, without the
   stash stack or `git clean`.
6. Stops when proposals run out, after two rejected or void rounds in a row,
   when most judges see no meaningful difference, or when the budget or size
   limit is used up.

The blinding, random order, fresh contexts, and gates reduce judge noise but do
not remove it. Treat the result as a polish aid, not as proof of quality. A
five-round climb with three members makes up to 18 member calls.

## What you get

- The final version in the working tree, uncommitted unless the thread already
  authorized commits.
- The climb card, a round ledger with each judge's preference and reasons, and
  the decision for each round.
- Before and after evidence, including paired screenshots for UI.
- The climb's diff stat, follow-ups declined for size or scope, and lessons the
  original work missed.
