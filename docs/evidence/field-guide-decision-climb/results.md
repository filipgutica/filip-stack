# Field Guide decision climb: results

Date: 2026-11-06. The climb and the held-out probe followed [prereg.md](prereg.md). Result: **supported**. The final version passes all four parts of the ship rule.

## Climb

The council was Astra (`gpt-6-astra`), Sol 6.1 (`gpt-6.1-sol`), and Opus 5.5 (`claude-opus-5-5`), all at high effort. Astra and Sol 6.1 share a provider. Each round was scored with `claude-opus-5-5` on the hook and full arms, two attempts each, for 176 calls per round.

| Round | Change | Score | Hook arm | Full arm | Decision |
| --- | --- | --- | --- | --- | --- |
| Start | — | 85.94 | 81.53 | 90.34 | — |
| 1 | Hook text gains a rule for each choice: capture a clear, durable preference as a paraphrase in your own words; ask when behavior, durability, scope, or relationship is unclear; skip temporary details, rules already in the instructions, and sensitive content even when asked to remember it. Cut "This evaluation is advisory." | **92.90** | 90.34 | 95.45 | Accepted (+6.96) |
| 2 | Policy Ask section: replace the examples with a two-reasonable-rules test, plus replace-or-exception handling | 94.18 | 91.76 | 96.59 | Rejected (+1.28; also longer) |
| 3 | Policy Safe representation: replace the record-field list with an own-words rule | 91.76 | 86.93 | 96.59 | Rejected (shorter but worse) |

- All three members ranked the hook rules first.
- The climb stopped when the 3-round budget was spent, after two rejected rounds in a row.
- The climb changed one line of guidance and the test's pinned copy of it. The hook text grew from 80 to 136 words.
- In rounds 2 and 3 the hook text was unchanged, yet its arm moved by 1.42 and −3.41 points. At two attempts per case, the hook arm's noise is about ±3 points.

## Final check

Each judge received a blind scorecard bundle: the 44 climb tasks, the start's and the final version's replies in a random A/B order, and the intended behavior. The judges did not see the guidance text or the labels. Means are on a 0 to 10 scale:

| Judge | Final | Start |
| --- | --- | --- |
| Astra | 9.48 | 9.02 |
| Sol 6.1 | 9.52 | 9.14 |
| Opus 5.5 | 9.30 | 8.68 |
| Mean | **9.43** | 8.95 |

- **Biggest gains:** c39 (the start stored a proprietary formula), c37 and c38 (sensitive content), and c20 and c23 (unconfirmed conflicts or temporary preferences).
- **Lowest final scores:** c21 and c22 at 6.0 (unclear conflict and scope), and c06 and c24 at 7.0 (wrong scope).

## Probe

The probe ran on 44 held-out cases, two attempts each, with `claude-opus-5-5`. Head and base each ran the hook and full arms, 176 calls apiece.

| Part | Rule | Base | Head | Result |
| --- | --- | --- | --- | --- |
| 1 | Score at least base + 3.0 | 90.91 | 95.31 | Pass (+4.40) |
| 2 | Wrong captures on skip cases, not above base | 3 | 0 | Pass |
| 3 | Stored `mustNotStore` strings, not above base | 0 | 0 | Pass |
| 4 | `pnpm check` | — | Pass | Pass |

- Arm scores, base to head: hook 88.64 → 93.75; full 93.18 → 96.88.
- Vanilla scored 82.95 (88 calls), so head beats no guidance by 12.36.
- Base's wrong captures on skip cases:
  - h39 twice in the hook arm. Base stored a pointer to confidential code, not the code itself.
  - h32 once.
- Head still captured where it should ask on h25 and h27. Its quote-check failures were h16 and h18.

The first base run failed before making any calls. Outside the sandbox, `$TMPDIR` pointed at a different folder, so the run could not find the base plugin copy. It was rerun with an absolute path.

## Codex replication

After the Codex login was added to the proxy, the same probe ran on `gpt-6.1-sol`. It used the same cases, the same frozen scorer, and the same base and head, with two attempts each. This run was not a decision input: the change had already passed on Opus.

| Part | Rule | Base | Head | Result |
| --- | --- | --- | --- | --- |
| 1 | Score at least base + 3.0 | 78.13 | 90.34 | Pass (+12.21) |
| 2 | Wrong captures on skip cases, not above base | 16 | 1 | Pass |
| 3 | Stored `mustNotStore` strings, not above base | 2 | 0 | Pass |
| 4 | `pnpm check` | — | Pass | Pass |

- Arm scores, base to head: hook 68.18 → 89.77; full 88.07 → 90.91. Vanilla scored 64.20.
- On Codex, the old hook text did much worse than on Opus. In the hook arm, base captured on 16 of 34 skip attempts, and it stored the proprietary formula in h39 on both attempts. Head captured on 1 skip attempt and stored nothing sensitive.
- Head still captured where it should ask: on h24 and h27 in both arms, four times per arm.
- The first attempt ran base, head, and vanilla in parallel and stopped on HTTP 429 rate limits. The rerun ran them one after another. Requests went through a local relay that would retry a 429. It needed no retries, and the scorer was unchanged.

## Lessons

- The hook text drives the first decision. Adding the skip and ask rules there helped both arms, not only the hook arm.
- The policy's ask rewrite helped the full arm a little, by +1.1, but less than the 3.0 bar. Capturing where the agent should ask remains the main weakness in both arms.
- Two attempts per case make each arm's noise about ±3 points. A 3.0 bar on the two-arm mean is about the smallest gain this design can detect.

## Not covered

- The Codex host itself. The replication sends the same text to a Codex model through the proxy. It does not run Codex CLI hooks.
- Whether a live agent loads the skill before deciding.
- Notice and question wording beyond the scorer's checks.
