# devchat admin commands

Run these only when the user asks. Use the same launcher as the agent command. After `devchat setup`, the `devchat` command on PATH runs the same script.

```text
devchat todo list            # open todos from the board snapshot and this machine, oldest first, each with its rid and source
devchat todo done <rid>      # mark a todo on this machine done; a unique rid prefix is enough
devchat todo drop <rid>      # drop a todo on this machine
devchat sync                 # send the outbox, then pull the board into the snapshot
devchat doctor               # config, mode, state, session record, route here; with the board on: board, epoch, outbox, snapshot, timer
devchat setup --host <tailnet host> [--port 8443] --github-login <login> --mode read|readwrite [--allowlist <owner,...>] [--dry-run]
devchat guard < <file>       # exit 0 when the text passes the guard, 1 with the reason
```

- `todo done` and `todo drop` change only todos on this machine. Resolve a board todo in the devchat UI.
- `setup` joins a board without sudo: it writes the config, installs the `~/.local/bin/devchat` shim and a 15-minute sync timer (a systemd user timer on Linux, a launchd agent on macOS), then runs `doctor`. Run it with `--dry-run` first and show the user the steps. `--board-url <url>` replaces `--host` and `--port`.

## Where devchat keeps its files

- Config: `$XDG_CONFIG_HOME/devchat/config.json`, by default `~/.config/devchat/config.json`. It holds `mode` (`off`, `read`, or `readwrite`; `off` without a config), `githubLogin`, `allowlist` (GitHub owners; defaults to `githubLogin`), `boardUrl` (required unless the mode is `off`), and `machine`.
- State: `$XDG_STATE_HOME/devchat`, by default `~/.local/state/devchat`. `local/` holds this machine's todos, `outbox/` the board writes not sent yet (`sent/` the sent ones, `rejected/` the ones the check at flush refused), `snapshot.json` the board state the last sync pulled, `sessions/` one record per session, and `plugin-path` the plugin root and version for the `devchat` shim.

## Where a write goes

A write reaches the board only from a Claude Code session whose hook recorded its starting repository, in mode `readwrite`, when both that repository and the working directory are github.com repositories whose owner is on the allowlist. Everything else stays on this machine, and the command says why. Codex writes always stay on this machine: a Codex record does not prove where the session started. Antigravity runs no hooks, so its writes always stay on this machine too.

A board write is queued in `outbox/` as one todo intent for the board's `inbox`, and a sync tries to send it at once, for at most 3 seconds. `devchat sync`, the timer, and that post-write sync send the outbox in queue order. Each send checks the file again: mode, allowlisted source repo, shape, and the guard. A network error or an error answer stops the send until the next sync, and a changed board epoch stops the sync. Mode `read` pulls and never sends. Mode `off` makes no network request.
