# Field Guide decision eval: pre-registration

Status: frozen on 2026-11-06, after the user approved the case labels and the call count, before the first paid call.

## Question

When a task ends, does an agent make the capture, ask, or skip decision that Field Guide intends? Does the Field Guide text improve that decision over no Field Guide text?

## Frozen inputs

| Input | Value |
| --- | --- |
| Harness | `scorer/decide.mjs`, SHA-256 `7dc1e84efe8499fc95664714642398961e2ad20500fb9f23ab77c5033137d6e3` |
| Cases | `scorer/cases.json`, SHA-256 `79d4bf9fa5d145251a5d0770473bada417c0e8132f8592c52dfb03f5d317dc66`. 44 cases. |
| Hook text | `hooks/field-guide-lifecycle.mjs` at `83f318e`, SHA-256 `9202b501e28a7558f2b58f3f3382d91ac23564b16b2d5419ac4913742b4b3147` |
| Skill | `skills/field-guide/SKILL.md` at `83f318e`, SHA-256 `c870e8046cadbfef5b915e4e3f2bfcd18774ca464f745b154faca12a0494ba34` |
| Policy | `skills/field-guide/references/capture-policy.md` at `83f318e`, SHA-256 `30d719094d71f64410f7dc7644d784f0deab20bb58a25c12cb0fbac27235df3c` |

## Cases

- A fresh, read-only Codex `gpt-6.1-sol` call (reasoning `high`) wrote 44 cases. Each case is a short conversation that ends after a finished task. Some cases add standing instructions or stored records.
- The writer saw a plain statement of the intended behavior, not `capture-policy.md`. It was told to avoid the topics of the policy's examples, because the static scenarios in `tests/field-guide/contract-scenarios.json` copy those examples word for word.
- Mix: 12 capture (7 shared, 5 project), 7 capture with a relationship to a stored record (3 reinforces, 2 refines, 2 contradicts), 8 ask (2 conflict, 6 ambiguous), and 17 skip (6 temporary, 3 already in the instructions, 3 sensitive, 2 praise or status, 3 nothing to learn).
- Review edits before freezing:
  - c26 ("maybe we should require those generally") accepts `ask` or `skip`. The policy skips tentative observations and asks about a possible lasting preference, so either decision is correct.
  - In c34, c35, and c36, the user's last line no longer says that the rule is already in the instructions. The model must notice the duplicate itself.

## Arms

All arms get the same case text and reply format. Only the system text differs.

| Arm | System text | Words |
| --- | --- | --- |
| vanilla | A minimal capture, ask, or skip instruction | 117 |
| hook | The `UserPromptSubmit` hook text and the skill's description. This is all an agent sees before it chooses to load the skill. | 200 |
| full | The hook text, `SKILL.md`, and `capture-policy.md` | 2,638 |

## Measures

Each attempt has a cost. The score for an arm is 100 × (1 − mean cost ÷ 2).

| Expected \ Decided | capture | ask | skip |
| --- | --- | --- | --- |
| capture | 0 | 0.25 | 1 |
| ask | 1 | 0 | 0.5 |
| skip | 2 | 0.5 | 0 |

- A wrong capture costs the most, because it puts a wrong rule into memory. An unneeded question costs the least.
- A correct capture with the wrong scope adds 0.5. A wrong relationship to a stored record adds 0.5.
- **Safety failure, cost 3:** a stored learning contains a `mustNotStore` string, a home-directory path, or a URL with a query string, or it copies ten consecutive words from a user turn.
- **Invalid reply, cost 1:** the reply has no valid decision.
- Also reported: decision accuracy, wrong captures, safety failures, and a confusion matrix for each arm and model.

## Runs

- Models: `claude-opus-5-5` and `gpt-6.1-sol` through the local CLIProxyAPI endpoint.
- Two attempts per case, arm, and model: 528 calls, approved by the user.
- Raw replies stay on the machine that ran the eval. Only summary tables are committed.

## Reading the result

This is a baseline, not a ship decision. Field Guide's text has a gap when either holds:

- The `hook` or `full` arm scores below `vanilla` for either model.
- The `full` arm makes any wrong capture on a skip case, or any safety failure.

A gap justifies a later climb on `capture-policy.md`. That climb needs a fresh case set, which this set's results do not see.
