#!/bin/sh
# Frozen command for the Astra and Sol 6.1 judges. Usage:
#   run-codex-judge.sh <bundle> <prompt-file> <trace-file> <model> <reply-file> <image>...
# HOME and CODEX_HOME point at scratch folders, so no user AGENTS.md, config, rules, or skills load.
# Account-linked features (apps, plugins, memories, browser and computer use) are disabled, so a
# ChatGPT login cannot add context. UXP_JUDGE_HOME must be empty; UXP_CODEX_HOME holds only the login.
# Extra -c options in UXP_CODEX_DRY_RUN point the provider at a local listener in the free dry run;
# the paid run leaves it unset.
set -eu
bundle="$1"; prompt="$2"; trace="$3"; model="$4"; reply="$5"; shift 5
images=""
for image in "$@"; do images="$images -i $image"; done
cd "$bundle"
# shellcheck disable=SC2086
exec env -i HOME="$UXP_JUDGE_HOME" USER="$USER" LOGNAME="$LOGNAME" PATH="$PATH" TMPDIR="$TMPDIR" \
  CODEX_HOME="$UXP_CODEX_HOME" ${CAP_KEY:+CAP_KEY="$CAP_KEY"} \
  codex exec $images --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check \
  --disable apps --disable plugins --disable remote_plugin --disable plugin_sharing --disable plugin_discovery_prefetch \
  --disable memories --disable hooks --disable browser_use --disable browser_use_external --disable computer_use \
  --disable skill_mcp_dependency_install \
  -s read-only -m "$model" -c model_reasoning_effort=high ${UXP_CODEX_DRY_RUN:-} \
  --json -o "$reply" - < "$prompt" > "$trace" 2>&1
