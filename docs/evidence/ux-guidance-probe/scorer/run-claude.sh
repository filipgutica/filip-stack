#!/bin/sh
# Frozen command for every Claude call: attempts and Opus judges. Usage:
#   run-claude.sh <workspace> <prompt-file> <trace-file> <tools>
# The child gets a clean environment and no user, project, or local settings. --safe-mode turns off
# CLAUDE.md, skills, plugins, hooks, MCP servers, and output styles; --restricted confines the file tools
# to <workspace>. ANTHROPIC_BASE_URL passes through only for the free dry run, which points it at a
# local listener; the paid run leaves it unset.
set -eu
cd "$1"
exec env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="$PATH" TMPDIR="$TMPDIR" \
  ${ANTHROPIC_BASE_URL:+ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL"} \
  claude -p --safe-mode --setting-sources '' --strict-mcp-config --disable-slash-commands --restricted \
  --tools "$4" --permission-mode acceptEdits --no-session-persistence \
  --model claude-opus-5-5 --effort high --output-format stream-json --verbose \
  < "$2" > "$3" 2>&1
