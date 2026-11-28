# devchat admin commands

Run these only when the user asks. Use the same launcher as the agent command. After `devchat setup`, the `devchat` command on PATH runs the same script.

```text
devchat todo list            # open todos, oldest first, each with its rid and source: board, queued, sent, or local
devchat todo done <rid>      # resolve a todo; a unique rid prefix is enough
devchat todo drop <rid>      # drop a todo
devchat work list            # open work items, oldest first, each with its rid, source, and whether a reply waits
devchat work show <rid>      # a work item, the replies this machine keeps in full, and the call that answers a waiting reply
devchat work drop <rid> [--re <id>]   # drop a work item
devchat sync                 # send the outbox, then pull the board into the snapshot
devchat doctor               # config, mode, state, session record, route here; with the board on: board, epoch, outbox, snapshot, timer
devchat setup --host <tailnet host> [--port 8443] --github-login <login> --mode read|readwrite [--allowlist <owner,...>] [--dry-run]
devchat guard < <file>       # exit 0 when the text passes the guard, 1 with the reason
devchat admin import [--yes <digest>]   # preview the todos skill's open issues, then import each as todo:gh:<n>
devchat admin export --rollback   # pull the board, then print the gh commands that move the todos back to the todos skill; safe to run twice
```

- A todo or work item kept on this machine resolves in its record. A board item resolves through an intent, which only a session whose writes reach the board, from the item's own repo, can send; from a terminal, resolve it in the devchat UI.
- A command names only an item this machine has seen on the configured board, by rid or a prefix unique among open and resolved items. Run `devchat sync` to see a newer one. The snapshot keeps the latest 500 resolved roots of each channel, by their labels, so a note can still reopen one.
- Inside a git checkout, every todo and work command sees only that checkout's repo's items, and board items only of the board's current epoch: another repo's item reads as an unknown rid. This holds in any session and in a terminal. Run the command outside any git checkout to see every item. When git fails in a checkout for another reason, such as a broken config, the command shows and changes nothing.
- While a user's reply waits on a work item, `work drop` and `work done` send nothing without `--re` naming that reply, and print the call that answers it.
- `setup` joins a board without sudo: it writes the config, installs the `~/.local/bin/devchat` shim and a 15-minute sync timer (a systemd user timer on Linux, a launchd agent on macOS), then runs `doctor`. It checks every file first, and changes nothing when one exists that setup did not write; it names that file. Run it with `--dry-run` first and show the user the steps. `--board-url <url>` replaces `--host` and `--port`; the URL must use https, or http on a loopback host.
- In mode `off`, `todo list` and `work list` show only items on this machine.

## Moving todos from the todos skill

- Run `admin import` on one machine, in mode `readwrite`. It refuses any other mode. It syncs first and stops when that sync stops.
- It reads the open issues of `<login>/todos`, the `todos` skill's private repo, with `gh`, and changes nothing there. It prints one preview line per issue: where it goes, its title, and its `From:` line. It ends with a `preview digest`.
- Without `--yes`, import asks, and any answer but `y` imports nothing. An agent runs `admin import` without `--yes`, shows the user the whole preview, and only after the user approves it runs `admin import --yes <digest>` with that preview's digest. When the preview, the board, or the machine name changed since, import refuses and prints the fresh preview and digest: show it to the user again.
- An issue whose `From:` names a github.com repo on the allowlist goes to the board with that repo, through the outbox. Every other issue goes to `local/` on this machine. An issue whose title or body the guard refuses is not imported; the preview names the reason and leaves out a refused title.
- Each imported todo's rid is `todo:gh:<issue number>`. The board keeps the first post of each rid, so a rerun posts nothing new there. An issue this machine already holds in `local/` stays local, even once its repo is allowlisted, and a local record is never overwritten.
- After the approval and before any write, import reads the config, the `gh` account, the issues, and `local/` again. When the account resolves to another repo, or anything the preview showed changed (the mode, the board, the allowlist, or a placement), it prints the fresh preview and imports nothing. The first approved import claims its todos repo in `import-source.json`, and a later import from another repo stops.
- `admin export --rollback` prints one line per change: `<op> <rid> <where> <command>`. Before the import every todo lived in GitHub, so the rid decides. `op` is `create` for an open todo whose rid is not `todo:gh:<n>`, and `close` for a `todo:gh:<n>` that is done or dropped. The command, everything after the third space, runs with `sh`.
- A `create` command first lists the repo's issues, closed ones included, and creates the issue only when none carries the line `devchat-rid: <rid>`, which the created issue's body ends with. When that list fails, the line fails and creates nothing. A `close` is safe to repeat. So every line is safe to run twice, and from every machine.
- Export lists every todo it knows, from each source, with `<where>` naming it:
  - `board`: a read-only pull of the board that export makes itself. Without a board, in mode `off`, or when the pull fails, export leaves the board lines and the `sent/` entries out, and the header says so: the list may then be incomplete, but every line is still safe to run.
  - `sent`: a `sent/` entry the board's `applied` cursor does not cover yet.
  - `pending`: every entry in this machine's `outbox/`, never sent, whatever the mode or the configured board. Export reads `outbox/` before `sent/`, so an entry a sync moves meanwhile is listed once or twice, never left out.
  - `local`: this machine's `local/`.
- A done or dropped imported todo always gets its `close`, wherever the resolve is. A queued or unapplied resolve of a todo that was never imported cancels that todo's `create`.
- Export compares the repo `gh` resolves to now with the one import claimed on this machine, and stops when they differ. Every command names the repo with `-R`.
- A record whose rid is not a devchat rid, which only a hand-edited or corrupt file holds, gets no line, and the header counts it as `N records skipped: malformed rid`.
- To roll back, run every line from every machine's list, in order. Every list must name the same repo.
- An imported todo that is not in the pull gets no line, so its issue stays open: one resolved on the board longer ago than the latest 500 resolved roots. A queued resolve of a board todo that was never imported cancels its `create` only on the machine that queued it; another machine's list still creates it.

## Where devchat keeps its files

- Config: `$XDG_CONFIG_HOME/devchat/config.json`, by default `~/.config/devchat/config.json`. It holds `mode` (`off`, `read`, or `readwrite`; `off` without a config), `githubLogin`, `allowlist` (GitHub owners; defaults to `githubLogin`), `boardUrl` (required unless the mode is `off`), and `machine` (a name without control characters; defaults to the host name).
- State: `$XDG_STATE_HOME/devchat`, by default `~/.local/state/devchat`. `local/` holds this machine's todos and work items, `outbox/` the board writes not sent yet (`sent/` the sent ones, `rejected/` the ones the check at flush or the app refused, or whose id another post already holds on the board), `snapshot.json` the board state the last sync pulled (open todos and work items, and for a work item with a waiting reply, its last three replies and every unanswered one), `sessions/` one record per session, `import-source.json` the todos repo the first import claimed, and `plugin-path` the plugin root and version for the `devchat` shim.

## Where a write goes

A write reaches the board only from a Claude Code session whose hook recorded its starting repository, in mode `readwrite`, when both that repository and the working directory are github.com repositories whose owner is on the allowlist. Everything else stays on this machine, and the command says why. Codex writes always stay on this machine: a Codex record does not prove where the session started. Antigravity runs no hooks, so its writes always stay on this machine too.

A board write is queued in `outbox/` as one intent for the board's `inbox`: a new todo or work item, a note, a question, or a resolve, and a sync tries to send it at once, for at most 3 seconds. `devchat sync`, the timer, and that post-write sync send the outbox in queue order. Each send checks the file again: mode, allowlisted source repo, shape, and the guard. A network error or an error answer stops the send until the next sync, except Board's `409 duplicate_id`: another post holds that id for good, so the file moves to `outbox/rejected/` and the send goes on. Any other `409` stops the send, and a changed board epoch stops the sync. Mode `read` pulls and never sends. Mode `off` makes no network request.

Until the app decides an intent, the lists show it as if applied: a work item marked done leaves `work list` at once. When the app refuses an intent, sync moves it to `outbox/rejected/` and prints `refused <rid>: <reason>`; when that item still waits on a reply, it also prints `not applied` and the call that answers it (or, when the item changed during that sync, a request to sync again), and `work start` shows the refusal beside that reply.

A work item lives where `work start` saved it. A note or resolve on a board item needs a session whose writes reach the board, and otherwise saves nothing and says why. A note or resolve on an item kept on this machine stays on this machine.
