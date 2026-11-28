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
devchat admin import [--yes] # preview the todos skill's open issues, then import each as todo:gh:<n>
devchat admin export --rollback   # print the gh commands that replay every todo change since the import
```

- A todo or work item kept on this machine resolves in its record. A board item resolves through an intent, which only a session whose writes reach the board, from the item's own repo, can send; from a terminal, resolve it in the devchat UI.
- A command names only an item this machine has seen on the configured board, by rid or a prefix unique among open and resolved items. Run `devchat sync` to see a newer one. The snapshot keeps the latest 500 resolved roots of each channel, by their labels, so a note can still reopen one.
- Inside a git checkout, every todo and work command sees only that checkout's repo's items, and board items only of the board's current epoch: another repo's item reads as an unknown rid. This holds in any session and in a terminal. Run the command outside any git checkout to see every item. When git fails in a checkout for another reason, such as a broken config, the command shows and changes nothing.
- While a user's reply waits on a work item, `work drop` and `work done` send nothing without `--re` naming that reply, and print the call that answers it.
- `setup` joins a board without sudo: it writes the config, installs the `~/.local/bin/devchat` shim and a 15-minute sync timer (a systemd user timer on Linux, a launchd agent on macOS), then runs `doctor`. It checks every file first, and changes nothing when one exists that setup did not write; it names that file. Run it with `--dry-run` first and show the user the steps. `--board-url <url>` replaces `--host` and `--port`; the URL must use https, or http on a loopback host.
- In mode `off`, `todo list` and `work list` show only items on this machine.

## Moving todos from the todos skill

- `admin import` reads the open issues of `<login>/todos`, the `todos` skill's private repo, with `gh`, and changes nothing there. It prints one preview line per issue: where it goes, its title, and its `From:` line. Show the user the preview; run with `--yes` only after the user approves it. Without `--yes`, import asks, and any answer but `y` imports nothing.
- An issue whose `From:` names a github.com repo on the allowlist goes to the board with that repo, in mode `readwrite`, through the outbox. Every other issue goes to `local/` on this machine. An issue whose title or body the guard refuses is not imported; the preview names the reason and leaves out a refused title. In mode `readwrite`, run `devchat sync` first: import refuses to run without a snapshot of the board.
- Each imported todo's rid is `todo:gh:<issue number>`. A rerun skips every rid this machine holds, so nothing is posted twice.
- The first approved import records the cutover in `cutover.json`. `admin export --rollback` then prints one line per change since the cutover, on the board and on this machine: `<op> <rid> <where> <command>`. `op` is `create` (a new open todo), `close` (an imported todo done or dropped), or `check` (an imported todo this machine cannot see). `where` is `board`, `local`, `pending` (still in this machine's outbox), or `unknown`. The command, everything after the third space, is the exact `gh` call for the todos repo; a `check` line has a comment instead. Export makes no request and runs no `gh` command; it shows the board as of the last sync.
- To roll back, run each command in order. Only the machine that ran the import has a cutover, so another machine's `local/` todos are in no list.

## Where devchat keeps its files

- Config: `$XDG_CONFIG_HOME/devchat/config.json`, by default `~/.config/devchat/config.json`. It holds `mode` (`off`, `read`, or `readwrite`; `off` without a config), `githubLogin`, `allowlist` (GitHub owners; defaults to `githubLogin`), `boardUrl` (required unless the mode is `off`), and `machine`.
- State: `$XDG_STATE_HOME/devchat`, by default `~/.local/state/devchat`. `local/` holds this machine's todos and work items, `outbox/` the board writes not sent yet (`sent/` the sent ones, `rejected/` the ones the check at flush or the app refused), `snapshot.json` the board state the last sync pulled (open todos and work items, and for a work item with a waiting reply, its last three replies and every unanswered one), `sessions/` one record per session, `cutover.json` the time of the first todos import and each imported rid's issue number, and `plugin-path` the plugin root and version for the `devchat` shim.

## Where a write goes

A write reaches the board only from a Claude Code session whose hook recorded its starting repository, in mode `readwrite`, when both that repository and the working directory are github.com repositories whose owner is on the allowlist. Everything else stays on this machine, and the command says why. Codex writes always stay on this machine: a Codex record does not prove where the session started. Antigravity runs no hooks, so its writes always stay on this machine too.

A board write is queued in `outbox/` as one intent for the board's `inbox`: a new todo or work item, a note, a question, or a resolve, and a sync tries to send it at once, for at most 3 seconds. `devchat sync`, the timer, and that post-write sync send the outbox in queue order. Each send checks the file again: mode, allowlisted source repo, shape, and the guard. A network error or an error answer stops the send until the next sync, and a changed board epoch stops the sync. Mode `read` pulls and never sends. Mode `off` makes no network request.

Until the app decides an intent, the lists show it as if applied: a work item marked done leaves `work list` at once. When the app refuses an intent, sync moves it to `outbox/rejected/` and prints `refused <rid>: <reason>`; when that item still waits on a reply, it also prints `not applied` and the call that answers it (or, when the item changed during that sync, a request to sync again), and `work start` shows the refusal beside that reply.

A work item lives where `work start` saved it. A note or resolve on a board item needs a session whose writes reach the board, and otherwise saves nothing and says why. A note or resolve on an item kept on this machine stays on this machine.
