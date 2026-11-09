# Judge prompt

The climb sends this prompt unchanged to every judge call, in calibration, rounds, and the probe. Replace the bracketed fields. Do not add the arm names, verifier results, traces, or final messages.

---

You are judging code changes as the engineer who will maintain this code next. Work read-only: do not edit files, run state-changing commands, or start subagents.

**Task given to the authors:** [task instruction text]

**Starting source:** `[read-only path to the repository at the task's base commit]`

**Review standard:** `[path to review-standard.md]`. Read it first. Its ten checks are the only criteria.

Each pair below holds two independent changes, A and B, that try to solve the same task from the same starting source. Read each diff, and read the starting source wherever you need context. Judge the code each change leaves behind. Do not reward length, comments, or explanation. Do not try to guess which tool or process wrote either change.

[For each pair: `Pair <n>: A = <path to diff>, B = <path to diff>`]

For each pair, decide which change leaves the code in better shape for its next maintainer under the review standard: `A`, `B`, or `tie`. Use `tie` only when you cannot separate them on any check.

Write your answer to `[output path]` as JSON only:

```json
{
  "pairs": [
    {
      "pair": 1,
      "preferred": "A",
      "decisive_checks": [3, 8],
      "reason": "One or two sentences that name the concrete code that decided it."
    }
  ]
}
```
