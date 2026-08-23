# Field-guide hook lifecycle

## Purpose

The Workflow plugin gives agents one short, static lifecycle instruction. Command details remain in the field-guide skill and are not repeated in hook output. The adapter does not read conversation data or field-guide files.

## Host selection

The adapter identifies Codex when `PLUGIN_ROOT` is present. It identifies Claude when only `CLAUDE_PLUGIN_ROOT` is present. An unknown host returns no output.

## Lifecycle behavior

The plugin registers only the `UserPromptSubmit` hook. That hook instructs the agent to evaluate `capture`, `ask`, or `skip` before its final response.

The plugin does not register a `Stop` hook. [Codex parses `suppressOutput` but does not implement it](https://learn.chatgpt.com/docs/hooks#common-output-fields). A blocking Stop reason becomes a synthetic user continuation.

[Claude accepts `suppressOutput` without acting on it](https://code.claude.com/docs/en/hooks#json-output). An isolated local Claude Code check also showed that a blocking Stop reason remains model-visible. The adapter therefore returns an empty object for direct Stop input.

The UserPromptSubmit instruction preserves agent judgment. Capture and skip preserve the normal task response. It limits lifecycle output to these visible results:

- `capture`: show the concise field-guide change notice.
- `ask`: show one focused question only.
- `skip`: write nothing and show no field-guide text.

The end-of-task evaluation is instructed but not enforced. Hook errors and unknown hosts fail open.

## Privacy boundary

The adapter uses static text and host environment variables only. It does not emit a launcher path or read transcripts, prompts, assistant messages, credentials, proprietary code, source files, or field-guide storage.
