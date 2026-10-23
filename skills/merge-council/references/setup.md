# Setup

Create or edit the roster at `~/.config/merge-council/roster.json`. Every host shares this file, so change only the current host's entries.

## Roster shape

```json
{
  "version": 1,
  "members": [
    {
      "lens": "contract-and-guidance",
      "targets": {
        "t3": { "providerInstanceId": "codex", "model": "gpt-6-astra", "effort": "high" },
        "claude": { "profile": "critic" },
        "codex": { "model": "gpt-6-astra", "effort": "high" }
      }
    },
    { "lens": "risk", "targets": {} },
    { "lens": "simplicity-and-evidence", "targets": {} }
  ]
}
```

- `members` holds exactly three entries, one per lens: `contract-and-guidance`, `risk`, and `simplicity-and-evidence`.
- `targets` maps a host key to whatever that host's subagent tool accepts:
  - `t3`: `providerInstanceId`, `model`, and `effort`, passed to `delegate_task`. Map `effort` to the option the model advertises, such as `reasoningEffort` or `effort`.
  - `claude` or `codex`: a native agent `profile`, or a `model` and `effort`.
  - any other host: the fields its subagent tool takes.
- The roster has no chair and no fixer. The invoking thread is the chair, and the fixer comes from the user's delegation policy at run time.

## Steps

1. Select the host key: `t3` when the T3 orchestration tools are present, otherwise the current host. If the host cannot launch subagents, stop and say so.
2. Read what the host offers:
   - **T3:** `orchestrator_capabilities`, keeping providers whose child tasks can run.
   - **Claude:** the models and effort levels its subagent tool accepts, and the agent profiles in `~/.claude/agents/` and the project's `.claude/agents/`.
   - **Codex:** the models and reasoning efforts it accepts, and the custom agents in `~/.codex/agents/` and the project's `.codex/agents/`.
3. Propose a default for each lens:
   - If the user's global guidance maps roles to models, use its read-only reviewer roles. Prefer the critic-style role for `risk`.
   - Otherwise, propose the strongest available model at high effort.
   - Spread the three members across providers when more than one is available. Correlated blind spots are the main weakness of a single-provider council.
   - Prefer profiles that run read-only.
4. Ask the user to confirm or change each member, one question per lens, with the proposal first. Offer only models, profiles, and effort values the host listed in step 2.
5. Write the file. Keep every other host's entries unchanged, and create `~/.config/merge-council/` if it is missing.
6. Report the roster as written for this host.

## Validation on every run

Before any review, confirm that each member target for the selected host still exists and that its effort is a value the host accepts. If a target fails, stop before reviewing, name the target, and suggest `merge-council setup`. Never substitute another model or profile.

Record the settings each member actually ran with:

- If the host reports a different model or effort than the roster asked for, stop the run.
- If the host cannot report the settings, record the requested values and mark them `unverified`.
