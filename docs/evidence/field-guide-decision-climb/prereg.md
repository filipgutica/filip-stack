# Field Guide decision climb: pre-registration

Status: frozen on 2026-11-06, after the held-out cases were reviewed and before climb round 1 applied a change.

## Question

Can the hook text and the capture policy be changed so an agent's end-of-task capture, ask, or skip decision better matches Field Guide's intended behavior, on cases the climb never saw?

## Why

The [decision eval](../field-guide-decision-eval/results.md) found two gaps:

- The hook text alone scored 81.53, the same as no Field Guide text (81.25). An agent sees only the hook text when it first decides whether there is anything to learn.
- Every arm captured where it should have asked. The full skill and policy text did so on 8 of 16 attempts.

## Frozen inputs

| Input | Value |
| --- | --- |
| Base | `83c9832`. Hook `field-guide-lifecycle.mjs` SHA-256 `9202b501e28a7558f2b58f3f3382d91ac23564b16b2d5419ac4913742b4b3147`; `capture-policy.md` SHA-256 `30d719094d71f64410f7dc7644d784f0deab20bb58a25c12cb0fbac27235df3c` |
| Scorer | `../field-guide-decision-eval/scorer/decide.mjs`, SHA-256 `051fbd07f7e7c50d9fd604aebb799da047c25fe2264605c975b8952efdd08e36`. Its last line is now the score over all attempts in a run. Output for a single arm is unchanged. |
| Climb set | The 44 cases in `../field-guide-decision-eval/scorer/cases.json`. The baseline eval used them; no change has been tuned on them. |
| Held-out set | 44 fresh cases with the same category mix, kept outside the repository until the probe runs, SHA-256 `8af94b6e729038d8bfeeeec2fbf36730f119a83ed4e7227ec2326a5838416cc3`. A fresh, read-only Codex `gpt-6.1-sol` call wrote them. It saw a plain statement of the intended behavior and a list of topics to avoid: the climb set's topics and the policy's examples. It was told not to signal labels in the user's words. Review edit: h20, h21, h22, h23, and h26 accept `ask` or `skip`, because the user hedges ("maybe", "probably", "on the fence"); this matches c26 in the climb set. |

## Climb card

- **Goal:** make the end-of-task capture, ask, or skip decision match Field Guide's intended behavior, both before the skill loads (hook text) and after (hook text, `SKILL.md`, and `capture-policy.md`).
- **Criteria:**
  - C1: the score.
  - C2: no wrong captures on skip cases, and no stored sensitive content.
  - C3: ask when the behavior, durability, scope, or relationship to a stored record is unclear.
  - C4: short, plain guidance.
- **Scope:**
  - the `promptContext` string in `plugins/field-guide/hooks/field-guide-lifecycle.mjs`;
  - its pinned copy in `tests/field-guide/field-guide-lifecycle.test.mjs`;
  - `plugins/field-guide/skills/field-guide/references/capture-policy.md`.

  The policy phrases that `tests/field-guide/validate-contract.mjs` asserts stay unchanged.
- **Behavior:** the lifecycle instruction text may change. Nothing else.
- **Gates:** `pnpm check`.
- **Decision rule:** `score`, plus the guidance prune rule: a candidate with fewer words that scores no worse also wins.
  - Score command, run outside the sandbox so it can reach the local proxy: `node docs/evidence/field-guide-decision-eval/scorer/decide.mjs docs/evidence/field-guide-decision-eval/scorer/cases.json --model claude-opus-5-5 --arm hook --arm full --attempts 2`.
  - Higher is better. The smallest gain that counts is 3.0.
  - The incumbent scores 85.94: hook 81.53, full 90.34. This comes from the decision eval's run on the same inputs.
- **Baseline:** the vanilla arm, 81.25 on the climb set.
- **Budget:** 3 rounds, each 176 calls. Size limit: 20 added lines across the scope.
- **Not covered:**
  - Codex. The proxy serves only Claude models.
  - Whether a live agent loads the skill before deciding.
  - Effects beyond the decision itself, such as notice wording.
  - With two attempts per case, a difference under about 3 points is within noise.

## Ship rule

The final version ships only if all four hold on the held-out set. Head and base each run `--arm hook --arm full`, 2 attempts, on `claude-opus-5-5`:

1. Head's score is at least 3.0 points above base's.
2. Head makes no more wrong captures on skip cases than base, summed over both arms.
3. Head stores no more `mustNotStore` strings than base, summed over both arms.
4. `pnpm check` passes on head.

Vanilla also runs on the held-out set, so the report can compare the final version with no guidance. That comparison does not gate shipping.

If any part fails, `main` keeps its hook text and policy. The result is recorded either way.
