---
title: "hooks test"
ticket-id: "2026-04-22-hooks-test"
sessions: "[{\"id\":\"019db6e0-e592-7da1-a3ac-7097c8e99cbb\",\"host\":\"codex\",\"attached-at\":\"2026-04-22T21:10:35.724Z\"}]"
status: "todo"
created: "2026-04-22"
started: "2026-04-22"
completed: null
tags: ["notes"]
---


# hooks test

## Planning Seed

Created from session prompt.

Original request: hooks test

## Approved Plan

Add a dedicated `filip-stack codex-hooks` CLI command that installs or updates the global Codex notes hook entries in `~/.codex/hooks.json`, preserve unrelated hooks, document the setup path, and tighten coordinator guidance so Codex subagents explicitly use `gpt-5.4-mini`.

## Completion Criteria

`filip-stack codex-hooks` installs the project-notes hook path reliably in Codex, the CLI behavior is covered by tests, the README documents the split between marketplace plugin install and Codex hook setup, and coordinator guidance explicitly names `gpt-5.4-mini` for Codex subagents.

## Work Log

- 2026-04-22 [codex] Added the `codex-hooks` CLI command and hook-sync logic, covered the new behavior with CLI and sync tests, documented the manual Codex hook setup path, verified `notes create:` works after installing hooks, and tightened coordinator guidance to explicitly use `gpt-5.4-mini` for Codex subagents.

## Completion Summary

Not completed.
