# Field-guide hook lifecycle

## Purpose

The Workflow plugin gives Claude agents one short, static lifecycle instruction.
Command details remain in the field-guide skill and do not appear in hook output.
The adapter does not read conversation data or field-guide files.

## Host selection

The Codex manifest overrides default hook discovery with an empty hook list.
The adapter also returns no output when `PLUGIN_ROOT` is present. Codex sets
both host variables for plugin hook compatibility.

The adapter identifies Claude only when `CLAUDE_PLUGIN_ROOT` is present without
`PLUGIN_ROOT`. An unknown host returns no output.

## Lifecycle behavior

Claude registers only the `UserPromptSubmit` hook. That hook instructs the agent
to evaluate `capture`, `ask`, or `skip` before its final response.

Codex does not register Workflow lifecycle hooks. [Codex parses `suppressOutput`
but does not implement it](https://learn.chatgpt.com/docs/hooks#common-output-fields).
A registered hook cannot meet the silent-output contract.

[Claude accepts `suppressOutput` without acting on it](https://code.claude.com/docs/en/hooks#json-output). An isolated local Claude Code check also showed that a blocking Stop reason remains model-visible. The adapter therefore returns an empty object for direct Stop input.

The Claude UserPromptSubmit instruction preserves agent judgment. Capture and
skip preserve the normal task response. The instruction permits these visible
results:

- `capture`: show the concise field-guide change notice.
- `ask`: show one focused question only.
- `skip`: write nothing and show no field-guide text.

The Claude end-of-task evaluation is instructed but not enforced. Hook errors
and non-Claude hosts fail open. Codex agents use the Field Guide through normal
skill routing instead of an automatic lifecycle hook.

## Privacy boundary

The adapter uses static text and host environment variables only. It does not emit a launcher path or read transcripts, prompts, assistant messages, credentials, proprietary code, source files, or field-guide storage.
