# Field-guide hook lifecycle

## Purpose

The Field Guide plugin injects bounded stored guidance at session start, the
first prompt, and the events that guidance is tagged for, and adds a short
lifecycle instruction for Claude and Codex agents.
Command details remain in the field-guide skill and do not appear in hook output.
The adapter reads only the event fields listed under Privacy boundary.

## Host selection

Claude and Codex discover the default `hooks/hooks.json` file. Its host-neutral
shell command uses `PLUGIN_ROOT` when Codex sets it and falls back to
`CLAUDE_PLUGIN_ROOT` for Claude.

The adapter accepts `PLUGIN_ROOT` for Codex or `CLAUDE_PLUGIN_ROOT` for Claude.
Codex can set both variables for plugin compatibility. An unknown host returns
no output.

## Lifecycle behavior

Claude and Codex register the `SessionStart`, `UserPromptSubmit`, and
`PostToolUse` hooks. The `UserPromptSubmit` hook instructs the agent to
evaluate `capture`, `ask`, or `skip` before its final response. The
`PostToolUse` hook matches `Bash` and injects event-tagged guidance; see
[Event injection](#event-injection).

## Guidance injection

The `SessionStart` hook matches `startup`, `clear`, and `compact`. It skips
`resume` and `fork` because their transcripts already hold earlier injections.
For the session's working repository, it injects:

- Up to eight active project records, newest first, within 1.5 KB.
- One line that lists the subjects of the other applicable active records,
  within 1 KB, so the agent can retrieve one when a task needs it.

The first `UserPromptSubmit` after a session start uses the prompt as a
retrieval query. It injects up to three matching active records within 2 KB
that are not already in context. Later prompts receive only the lifecycle
instruction until the next session start. A prompt with no session start, such
as one in a session that began before the plugin was installed, is treated as
the first prompt.

After compaction, the session start also restores the active shared records
the session received from the hooks before it: from the first prompt, an
event, or an earlier restore. They follow the project records in the same
eight-record, 1.5 KB section, at their current text and markers; a retired
record is skipped, and a record that does not fit goes to the subject index.
The next prompt does not inject a restored record again.

A `startup` event for a session that already has state injects nothing and keeps
that state. Codex subagent hooks reuse the parent's session ID, so this stops a
subagent start from resetting the parent session.

Each injected record is one line: its subject and its learning. Injection never
includes evidence. Without an initialized guide, both hooks inject nothing.

In a main thread, a line starts with markers from `annotations.json`:
`[confirmed]` for a user confirmation, then one `[<trigger>]` per event trigger,
then the subject, as in
`- [confirmed] [pr-merged] [git-cleanup] After a merge, remove its worktrees.`
Only these lines show confirmation; `retrieve` never reports it. Stored text
that uses a marker word in brackets is escaped. A subject named `confirmed` or
like a trigger renders as `\[confirmed]`, a marker word anywhere in the
learning renders with a backslash, and a learning that starts with `[` renders
with a leading backslash. Unicode line separators render as spaces.
Delegates and subagents receive the same lines without markers.

[Codex supports plugin-bundled hooks and `UserPromptSubmit` additional
context](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks). Codex parses
`suppressOutput` but does not implement it. Codex can therefore show the hook
run and injected developer context.

[Claude accepts `suppressOutput` without acting on it](https://code.claude.com/docs/en/hooks#json-output). An isolated local Claude Code check also showed that a blocking Stop reason remains model-visible. The adapter therefore returns an empty object for direct Stop input.

The UserPromptSubmit instruction preserves agent judgment. Every decision
preserves the normal task response. The instruction permits these visible
results:

- `capture`: show the concise field-guide change notice.
- `ask`: append one focused learning question without delaying or replacing the task result; write no memory while awaiting the answer.
- `skip`: write nothing and show no field-guide text.

The end-of-task evaluation is instructed but not enforced. Hook errors and
unknown hosts fail open. If a host disables or has not trusted the hook, agents
use the Field Guide through normal skill routing.

When local analytics is enabled, the adapter appends one `hook_invoked` event
for a supported `UserPromptSubmit` call and one `injection` event with the
trigger and guidance IDs for each session-start or prompt injection. A
compaction restore counts as a session-start injection. Event injections
record no analytics, because a plugin copy that has not been updated rejects
an unknown trigger in the shared event log. This records invocation activity only.
It does not prove that the host delivered the context or that the agent used
guidance. Analytics write failures do not change the hook output.

## Event injection

The `PostToolUse` hook, with a `Bash` matcher, injects guidance tagged for an
event after a main-thread shell command in a form it recognizes, when the
result shows the command ran and succeeded:

| Command | Event |
| --- | --- |
| `gh pr merge`, `gh stack merge` | `pr-merged` |
| `gh pr create` | `pr-created` |
| The Field Guide CLI's `retrieve --event <trigger>`, run directly or as the script of `node`, `sh`, or `bash` | `<trigger>` |

The hook splits the Bash input into simple commands at `&&`, `||`, `;`, `|`,
`&`, and newlines, and skips leading `NAME=value`, `env`, and `command`. Quoted
text is one word, so `echo "gh pr merge"` matches nothing. The script of a
`sh`, `bash`, or `zsh -c` wrapper is checked one level deep. A command counts
only when the input has no `||` and only `&&` follows it, so a zero exit proves
it succeeded: `gh pr merge 5 || true`, `| tail`, and `; git pull` count as
nothing. The hook reads past two command substitutions, each as one word:
`$(cat <<'EOF'` with its body up to the first `EOF` line and a `)` on the next,
and a one-line `$(…)` without quotes, parentheses, `$`, redirects, or
separators. A heredoc body is never a command, and the rest of the input is
checked as usual, so `"$(date)" || echo failed` counts as nothing. Any other
heredoc, substitution, or backtick, a `#` comment, a parenthesis, a wrapper
with a `-n` or `-o` option or a word before `-c`, a `GH_REPO=` or `GH_HOST=`
anywhere in the input, `--help`, `--dry-run`, `--web`, and `--disable-auto`
also count as nothing. So do an attached or `=` spelling such as `-Ro/r`,
`-sb`, or `--auto=true`, and a substitution or `$` in the PR position; a
substitution is never a literal path for `cd` or `--repo-root`. Any form the
hook does not recognize falls back to the skill's retrieval rule. The adapter
loads the Field Guide modules only when the input names `gh` or the Field Guide
script, and makes no network calls.

The records come from the repository the command acted on: `cwd`, changed by
each `cd <literal path> &&` before the command, or a retrieve's `--repo-root`.
Any other `cd`, a PR URL or `--repo` outside that repository's `origin`, or
events in different repositories inject nothing. All events in one command
share one block of up to three active records tagged with any of them, project
records first, then shared, within 1.5 KB, with the markers described above. A
`retrieve --event` command gets these lines because the CLI never reports
confirmation, so a footer that retrieves `handoff` guidance sees which of the
first three records are confirmed. For `gh pr merge --auto`, the text says the merge may only be
queued and to confirm that the PR merged before acting on the guidance.

A `gh pr merge` that names its PR by number or URL as its positional argument
injects once per PR per session; a URL in an option value such as `--body` is
not the PR. A `--auto` merge leaves the PR pending. The PR's key is
`host/owner/repo#number`, from the URL or from `--repo` or `origin` with the
number, so both forms of one PR match.
`gh repo set-default` can name another repository than `origin`; that affects
only this key. Session state stores only a SHA-256 hash of the event and key,
and keeps it through compaction. Other events inject every time.

The hook injects nothing, and changes no state, when:

- The command ran in the background, by `run_in_background` or a
  `backgroundTaskId` in the result, because the result arrives when it starts.
- A retrieve names another `--guide-root`.
- The command did not succeed. Claude reports a failed call as
  `PostToolUseFailure`, which the plugin does not register, and the hook also
  skips an interrupted or error result and a non-zero exit code. Codex sends
  failures to `PostToolUse` too, so a Codex event needs a zero exit: a first
  `Exit code: 0` or `Process exited with code 0` line, or an exit code field
  of 0.
- The call runs in a subagent or a T3 Code delegate. See
  [Main-thread detection](#main-thread-detection). A delegate's merge leaves
  the main thread's event pending.
- No guide exists, the repository is unknown, or nothing is tagged with the
  event.

The hook does not see a merge done through a GitHub tool or MCP server instead
of a shell command; the skill tells the agent to retrieve the event's guidance
then.

[Codex supports `PostToolUse` for shell commands, matched as `Bash`, and adds its
`additionalContext` as developer context](https://learn.chatgpt.com/docs/hooks).
Codex 0.169's bundled hook schema confirms `agent_id`, `session_id`, `cwd`, and
`hookSpecificOutput.additionalContext` in the output; the command and response
shapes come from the documentation. A live Codex probe has not
been run. Claude's per-handler `if` filter matches each subcommand and could
skip unrelated commands before a process starts. It takes one rule per handler,
so it would need one handler per command form. One `hooks.json` serves both
hosts, and Codex does not document `if`; if Codex ignored it, each of those
handlers would run on every shell command. The plugin therefore sets no `if`.

## Main-thread detection

A hook runs in a main thread unless one of these holds:

- The hook input has `agent_id`. Claude and Codex set it for subagents.
- `T3CODE_THREAD_ID` starts with `thread:delegated-task:` (a local T3 Code
  delegate) or `mcp:launch:` (a remote one). Main T3 Code threads have a plain
  UUID, and other hosts set no value.

## Confirmation prompt

A `UserPromptSubmit` prompt that, trimmed, is exactly `confirm fg:<id>` in a
main thread confirms one active record. `<id>` is a full guidance ID or an
unambiguous hex prefix of at least eight characters. The hook writes the
confirmation to `annotations.json`, bound to the record's fingerprint, and
shows the confirmed text twice: as `systemMessage`, which the user sees, and
as context, which the model sees. Both hosts support `systemMessage` on
`UserPromptSubmit` and `SessionStart`.

Anything else confirms nothing: extra text, a quoted ID, several IDs, a pasted
report, an unknown or ambiguous ID, a record that is not active, and every
prompt in a delegate or subagent. A prompt in that exact shape gets one short
reason. Any other prompt that mentions `confirm fg:` keeps its normal output
and gains one line that says nothing was confirmed. A confirm prompt gets no
lifecycle instruction and neither receives nor consumes the first-prompt
guidance match, so the next prompt still gets it.

The hook cannot tell who sent a prompt. An agent that sends the exact prompt
to a main thread through a host tool is barred by guidance, not by the hook.
No Field Guide command creates a confirmation; import copies them from the
synced file, which the user trusts like the store.

## Version line

When `memory.md` or `annotations.json` has a schema version newer than the
plugin reads, `SessionStart` returns one `systemMessage` line that asks the user
to update the Field Guide plugin. Guidance from a newer `memory.md` is not
injected; with newer annotations, guidance is injected without markers.
Commands that write annotations, including a capture that creates a record,
retirement, and delete, stop with an error until the plugin is updated. A
malformed `annotations.json` stops them the same way, and `validate` reports
it.

## Privacy boundary

Besides `hook_event_name`, the adapter reads only the `session_id`, `cwd`, `source`,
`prompt`, `agent_id`, `tool_input.command`, and `tool_response` fields, and the
`T3CODE_THREAD_ID` environment variable. It runs Git in `cwd`, or the directory a command's `cd` or `--repo-root` names, to identify the repository and reads the
local guidance store. It does not access source files or files referenced by
the event. It uses the prompt only as an in-memory retrieval query and to
recognize a confirmation prompt, and never emits or persists it. It uses the
Bash command only in memory to recognize an event and its target, and reads
`tool_response` only to detect a failure; it never emits or persists either. A
confirmation stores an entry ID, the time, the host, and the revocation IDs it
saw, some derived from retirement IDs, keyed by the record's fingerprint. Hook
output contains static text and stored guidance only.

Session state lives in `~/.field-guide/sessions/`, one file per SHA-256 hash of
the session ID. It holds only injected guidance IDs, whether the next prompt
should receive matched guidance, the IDs of shared records the session received,
and SHA-256 hashes of the events and targets already injected. The adapter writes the state before it returns
guidance, so a failed write prevents repeated injection. It writes each state
file to a new temporary file and renames it into place, so it never follows a
symlink at the state path. If `sessions/` is not a local directory, for example a
symlink, the adapter writes no state and injects nothing. Each session start
removes state files older than seven days and leaves other files in place. Without an initialized guide, the adapter writes no state.

If analytics is enabled, the adapter also reads the local analytics setting and
writes event metadata: timestamp, event ID, event type, host, project key,
trigger, and guidance IDs. It never writes prompt text.
