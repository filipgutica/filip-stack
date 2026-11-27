# devchat admin commands

Run these only when the user asks. Use the same launcher as the agent command.

```text
devchat todo list            # open todos on this machine, oldest first, each with its rid
devchat todo done <rid>      # mark a todo done; a unique rid prefix is enough
devchat todo drop <rid>      # drop a todo
devchat doctor               # local checks: config, mode, state directory, session record, route here
devchat guard < <file>       # exit 0 when the text passes the guard, 1 with the reason
```

## Where devchat keeps its files

- Config: `$XDG_CONFIG_HOME/devchat/config.json`, by default `~/.config/devchat/config.json`. It holds `mode` (`off`, `read`, or `readwrite`; `off` without a config), `githubLogin`, `allowlist` (GitHub owners; defaults to `githubLogin`), and `machine`.
- State: `$XDG_STATE_HOME/devchat`, by default `~/.local/state/devchat`. `local/` holds this machine's todos, `sessions/` one record per session, and `plugin-path` the plugin root and version for the `devchat` shim.

## Where a write goes

A write reaches the board only from a Claude Code or Codex session whose hook recorded its starting repository, in mode `readwrite`, when both that repository and the working directory are github.com repositories whose owner is on the allowlist. Everything else stays on this machine, and the command says why. Antigravity runs no hooks, so its writes always stay on this machine.
