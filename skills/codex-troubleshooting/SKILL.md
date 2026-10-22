---
name: codex-troubleshooting
description: Use to diagnose Codex app, CLI, plugin, MCP, hook, browser, connector, subagent, or local host-state issues by checking current official Codex docs before local evidence.
---

# Codex Troubleshooting

Use this for Codex app, CLI, plugin, MCP, hook, browser, connector, subagent, configuration, authentication, or local runtime issues.

This skill is docs-first. Do not rely on memory or local folklore when current Codex behavior could have changed.

## Procedure

1. Identify the affected Codex surface:
   - app, CLI, IDE extension, web, plugin, MCP, hook, skill, subagent, browser, computer use, connector, auth, sandbox, permissions, automation, or logs
2. Check current official OpenAI Codex docs for that surface.
   - Prefer the OpenAI developer docs MCP when available.
   - If the docs MCP is unavailable, use official OpenAI Codex docs only.
3. Inspect local reality after the docs check:
   - `codex --version`
   - `codex doctor` when broad install/runtime health is relevant
   - `codex features list` for feature flags
   - `codex plugin list` and plugin marketplace state for plugin issues
   - `codex mcp list` for MCP issues
   - `~/.codex/config.toml`
   - `~/.codex/hooks.json`
   - relevant app logs and session transcripts
   - cached plugin paths only when cache/materialization is the suspected failure
4. Separate layers before diagnosing:
   - official documented behavior
   - installed CLI/app version and feature flags
   - local config
   - plugin or MCP registration
   - cache/materialized runtime files
   - target app/browser/connector state
5. If docs and local behavior disagree, report the mismatch and preserve uncertainty.

## Guardrails

- Do not edit Codex config, hooks, plugins, or caches unless the user asked for a fix.
- Do not delete cache or host-state files without explicit approval.
- Do not assume a plugin list or tool listing proves connector authentication works; use read-only identity or resource checks when available.
- For browser issues, distinguish Codex in-app browser, Chrome extension, and Computer Use.
- For hooks, separate feature enablement from hook entry configuration.

## Output

Return:

- observed facts
- official-doc grounding
- local evidence
- likely cause or clearly labeled hypotheses
- exact next fix or verification step
