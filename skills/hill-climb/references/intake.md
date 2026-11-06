# Intake

Use intake when the request gives no change to polish, or leaves the scope,
the criteria, the decision rule, or the budget unclear. Ask only the
questions the thread does not already answer, at most four, in one message.
Number them and give each a recommended default, so the user can reply
"defaults". Wait for the answers, then build and freeze the card.

## Before you ask

Read what the defaults need, so each question carries a concrete proposal:

- The paths the user named, and the repository's design system or
  `~/design-language/DESIGN.md`.
- `ux-laws` when it is installed, for interaction and flow criteria.
- The repository's gate and check commands, from its package scripts, CI,
  and contributor guidance.

## Questions

1. **Scope.** Which paths may the climb change? Propose the smallest set of
   paths that holds the goal. For UI, also the routes, states, widths, and
   themes to capture.
2. **What better means.** Propose three to five criteria from the design
   system or `DESIGN.md`, plus `ux-laws` for interaction work, and the
   user's focus. The user confirms or edits them.
3. **How a candidate wins.** Propose one decision rule:
   - `judges`: blind council judges. The default. Name the lineup, which
     `council` sets, with at least two members.
   - `score`: a command that prints one number, such as an accessibility
     checker's violation count, with its direction and the smallest gain
     that counts. Propose it only when such a command already exists.
   - `both`: the score must improve and most judges must prefer the
     candidate.

   Ask whether the climb may change behavior, and if it may, which
   interactions. The default is no behavior change.
4. **Budget.** Propose rounds (3 by default, 10 at most), a size limit in
   changed lines, and a member-call limit when the user wants one. A fresh
   start has no original change, so always propose a size limit that fits
   the goal, and record its reason on the card.

## After the answers

Fill the card from the answers and the thread, then show it and continue as
`SKILL.md` describes.
