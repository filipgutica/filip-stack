# Setup

Create or edit the roster at `~/.config/merge-council/roster.json`. Every host shares this file, so change only the current host's entries.

## Roster shape

```json
{
  "version": 1,
  "chair": {
    "targets": {
      "t3": { "providerInstanceId": "claudeAgent", "model": "claude-opus-5-5", "effort": "high" },
      "claude": { "profile": "worker-high" }
    }
  },
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
- `chair` runs the council. Its target must be able to run shell commands that write (worktrees, refs, and `git show --remerge-diff`) and must have a subagent tool that can reach the member targets. A read-only reviewer profile does not qualify.
- The roster has no fixer. The chair picks it from the user's delegation policy at run time.

## Steps

1. Select the host key: `t3` when the T3 orchestration tools are present, otherwise the current host. If the host cannot launch subagents, stop and say so.
2. Read what the host offers:
   - **T3:** `orchestrator_capabilities`, keeping providers whose child tasks can run.
   - **Claude:** the models and effort levels its subagent tool accepts, and the agent profiles in `~/.claude/agents/` and the project's `.claude/agents/`.
   - **Codex:** the models and reasoning efforts it accepts, and the custom agents in `~/.codex/agents/` and the project's `.codex/agents/`.
3. Propose a chair: the strongest available model at high effort, on a target that meets the chair requirements above. If the host cannot let a subagent launch its own subagents, say so and stop; the council cannot run there.
4. Propose a default for each lens:
   - If the user's global guidance maps roles to models, use its read-only reviewer roles. Prefer the critic-style role for `risk`.
   - Otherwise, propose the strongest available model at high effort.
   - Spread the three members across providers when more than one is available. Correlated blind spots are the main weakness of a single-provider council.
   - Prefer profiles that run read-only.
5. Ask the user to confirm or change the chair and each member, one question each, with the proposal first. Offer only models, profiles, and effort values the host listed in step 2.
6. Write the file. Keep every other host's entries unchanged, and create `~/.config/merge-council/` if it is missing.
7. Report the roster as written for this host.

## Validation on every run

Before launch, the launching agent confirms that the chair target still exists and that its effort is a value the host accepts. Before any review, the chair confirms that each member target for the selected host still exists and that its effort is a value the host accepts. If a target fails, stop before reviewing, name the target, and suggest `merge-council setup`. Never substitute another model or profile.

The launching agent records the settings the chair ran with, and the chair records the settings each member ran with:

- If the host reports a different model or effort than the roster asked for, stop the run.
- If the host cannot report the settings, record the requested values and mark them `unverified`.
