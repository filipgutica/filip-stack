# Field-guide hook lifecycle

## Purpose

The Field Guide plugin gives Claude and Codex agents one short, static lifecycle
instruction. Command details remain in the field-guide skill and do not appear
in hook output. The adapter parses the hook event only to select
`hook_event_name`.

## Host selection

Claude and Codex discover the default `hooks/hooks.json` file. Its host-neutral
shell command uses `PLUGIN_ROOT` when Codex sets it and falls back to
`CLAUDE_PLUGIN_ROOT` for Claude.

The adapter accepts `PLUGIN_ROOT` for Codex or `CLAUDE_PLUGIN_ROOT` for Claude.
Codex can set both variables for plugin compatibility. An unknown host returns
no output.

## Lifecycle behavior

Claude and Codex register only the `UserPromptSubmit` hook. The hook instructs
the agent to evaluate `capture`, `ask`, or `skip` before its final response.

[Codex supports plugin-bundled hooks and `UserPromptSubmit` additional
context](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks). Codex parses
`suppressOutput` but does not implement it. Codex can therefore show the hook
run and injected developer context.

[Claude accepts `suppressOutput` without acting on it](https://code.claude.com/docs/en/hooks#json-output). An isolated local Claude Code check also showed that a blocking Stop reason remains model-visible. The adapter therefore returns an empty object for direct Stop input.

The UserPromptSubmit instruction preserves agent judgment. Capture and skip
preserve the normal task response. The instruction permits these visible
results:

- `capture`: show the concise field-guide change notice.
- `ask`: show one focused question only.
- `skip`: write nothing and show no field-guide text.

The end-of-task evaluation is instructed but not enforced. Hook errors and
unknown hosts fail open. If a host disables or has not trusted the hook, agents
use the Field Guide through normal skill routing.

## Privacy boundary

The adapter does not access files referenced by the event. It does not inspect
other event fields or emit or persist them. It does not access source files or
field-guide storage. The output contains static text only.
