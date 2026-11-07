# Field Guide retrieval climb: pre-registration

Status: frozen on 2026-11-06, after the user approved the labels and before climb round 1.

## Question

Does a change to Field Guide's first-prompt matching inject more of the stored records a request needs and fewer misleading ones, on prompts the climb never saw?

## Why retrieval first

- A live first prompt about designing evals injected nothing, although the store held two records about evaluation design. The prompt shared no terms with either record.
- On the climb set, the current code injects 56 records outside the labels across 33 prompts. 19 of them land on prompts that need no record.

## Frozen inputs

| Input | Value |
| --- | --- |
| Base | `field-guide.mjs` at `83f318e`, SHA-256 `c31699736693e309552aaa1fda744c7fcc205bb7cf6bc2aab9535252a8ca7510` |
| Store | `scorer/records.json`, SHA-256 `dcff1488a64702267c029e31151024a27819960c282e253dd3700ba4ee1e76b2`. 36 synthetic records: 30 shared, 4 for `shop-api`, 2 for `admin-ui`. Learnings run 22 to 53 words, median 40. The local store's counts guided the shape; none of its content is used. |
| Climb set | `scorer/climb-set.json`, SHA-256 `d7dfd1e3391c8ae481feb8c541f990db7606568d0602d42f2c6ec19a21be05ab`. 33 prompts. |
| Probe set | 32 prompts, kept on the machine that runs the probe until the probe finishes, SHA-256 `a18fe7c3b5c006a28654a633be9d906dc24614f6f879e6d3ff9b354f7e20d4da`. |
| Scorer | `scorer/score.mjs`, SHA-256 `8a060b6c9385bf4c00518c6ca835a3dc1f120e11516231b314e936d075c111d2` |

## Prompt sets

- A fresh, read-only Codex `gpt-6.1-sol` call (reasoning `high`) wrote 64 labeled prompts. It saw the 36 records and a description of the task. It saw no Field Guide code, policy, or matching rule.
- The split is by category: none, single, multi, and long. Within each category, prompts are sorted by the SHA-256 of their ID and alternate between climb and probe.
- The climb set also holds p65, a rewording of the live miss. It never enters the probe.
- Review edits before freezing. These records became `acceptable` (harmless to show, not needed): p06 r16, p07 r15, p12 r31, p14 r34, p15 r32, p16 r19, p17 r30, p18 r17, p59 r12 and r19. No `relevant` label changed.

## Measures

- The scorer builds the store through the real `init` and `submit` commands, then calls `promptInjection` once per prompt in `shop-api`, with nothing already injected.
- An injected record counts as a hit if the labels mark it `relevant`, as neutral if they mark it `acceptable`, and as a false injection otherwise. A `relevant` record that is not injected counts as missed.
- Micro precision, recall, and F1 cover all prompts. The score is 100 × F1, printed on the last line.
- False injections on prompts with no relevant record are counted separately.
- `retrieve --query` is not scored. Agents write their own queries for it, and raw prompts are not a fair stand-in.

## Baseline

The climb set at base gave the same output on two runs:

| Measure | Value |
| --- | --- |
| Hits / false / missed | 16 / 56 / 12 |
| Precision | 22.22 |
| Recall | 57.14 |
| False injections on no-relevant prompts | 19 |
| Score | 32.00 |

The probe set is not scored until the climb ends.

## Climb card

- **Goal:** inject the stored records a first prompt needs, without misleading ones.
- **Scope:** `retrievalStopwords`, `relevanceTerms`, `applicabilityScore`, and query building in `promptInjection`, all in `field-guide.mjs`, plus their tests in `tests/field-guide/field-guide.test.mjs`. `normalizeLearning` is out of scope: it feeds record fingerprints and the shared-versus-project dedup.
- **Decision rule:** `score`. Command: `node docs/evidence/field-guide-retrieval-climb/scorer/score.mjs docs/evidence/field-guide-retrieval-climb/scorer/climb-set.json`. Higher is better. The smallest gain that counts is 2.0.
- **Gates:** `pnpm check` passes. False injections on no-relevant prompts do not rise above the incumbent's. Precision and recall each stay no more than 3.0 points below the incumbent's. F1 alone could reward cutting injections until recall collapses, and the live miss that started this climb was a recall failure.
- **Weighting:** an extra injected line costs little context, but a misleading record can steer the work. So the gates target false injections, not line count.
- **Budget:** 3 rounds. Size limit: 30 added lines.
- **Not covered:** whether an agent follows an injected record; the decision eval covers that. Also not covered: `relevanceTerms` and `applicabilityScore` serve the agent-written queries of `retrieve --query` as well, and the scorer does not measure those short queries. `field-guide.test.mjs` is their only guard.

## Ship rule

The change ships only if all five hold on the probe set, head against base:

1. Head's score is at least 3.0 points above base's.
2. Head's false injections on no-relevant prompts are no more than base's.
3. Head's precision is no more than 3.0 points below base's.
4. Head's recall is no more than 3.0 points below base's.
5. `pnpm check` passes on head.

If any part fails, `main` keeps its matching code. The result is recorded either way.
