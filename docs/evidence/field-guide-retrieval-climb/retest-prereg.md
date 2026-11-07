# Field Guide retrieval retest: pre-registration

Status: frozen on 2026-11-06, after the retest set's labels were reviewed and before either version scored it.

## Question

Does the climb's round 1 version beat base on fresh prompts that played no part in choosing it?

## Why a retest

- The climb's final version, after round 2, failed the first probe on recall. Round 2 had made `need` and `already` stopwords, and that lost one relevant record. See [results.md](results.md).
- After the decision, the round 1 version was scored on the same probe. It would have passed every part. Choosing it on that result would use probe data, so the first probe cannot support it.
- This retest gives round 1 a clean held-out test.

## Frozen inputs

| Input | Value |
| --- | --- |
| Base | `field-guide.mjs` on `main` at `9215fda`, SHA-256 `c31699736693e309552aaa1fda744c7fcc205bb7cf6bc2aab9535252a8ca7510`. The same file as the first climb's base. |
| Head | Base plus the `field-guide.mjs` hunk of [round-1.patch](round-1.patch), SHA-256 `995f4de79e6bfc2e4755ca1f53c7bf1b323025bc784860b578a385c180379eb7`. Unchanged since the climb. |
| Store | `scorer/records.json`, unchanged. |
| Scorer | `scorer/score.mjs`, SHA-256 `8a060b6c9385bf4c00518c6ca835a3dc1f120e11516231b314e936d075c111d2`, unchanged. Each version runs with `--field-guide <copy>/field-guide.mjs`, next to a copy of `field-guide-analytics.mjs`. |
| Retest set | `scorer/retest-set.json`, SHA-256 `bafcaf767da064dee8bc9bf9d401cb4a1b74b12598cc91f612a80bffa076d1a3`. 64 prompts. |

Check before freezing: base scores 32.00 and head 45.95 on the climb set, the same as in the climb.

## Retest set

- A fresh, read-only Codex `gpt-6.1-sol` call (reasoning `high`) wrote 64 labeled prompts. It got the same brief as the first writer: the 36 records and a description of the task. It saw no Field Guide code, matching rule, earlier prompt set, or result.
- Two parts of the brief were new. It asked for everyday words such as "need", "already", "make", and "like", and for about six long prompts with pasted logs, diffs, or tickets. These cases test whether round 1 keeps the words that cost round 2 its recall.
- Mix: 22 none, 26 single, 10 multi, and 6 long. 24 prompts have no relevant record. Every record from r01 to r34 is relevant at least once. No `admin-ui` record is labeled.
- All 64 prompts form the retest set. None goes to a climb, because no climb follows.
- The review made no label edits.

## Ship rule

The round 1 version ships only if all five parts hold on the retest set, head against base. These are the parts of the first climb's ship rule:

1. Head's score is at least 3.0 points above base's.
2. Head's false injections on no-relevant prompts are no more than base's.
3. Head's precision is no more than 3.0 points below base's.
4. Head's recall is no more than 3.0 points below base's.
5. `pnpm check` passes with head applied.

If any part fails, `main` keeps its matching code. The result is recorded either way. This candidate gets no further retest.

## Not covered

- The same as the first climb: whether an agent follows an injected record, and the short agent-written queries of `retrieve --query`.
- Both prompt sets come from the same writer model and a similar brief, so they share its blind spots.
