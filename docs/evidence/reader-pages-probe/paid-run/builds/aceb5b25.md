`tidy-hooks` is a Claude and Codex plugin that blocks `git commit` when staged files contain merge markers.

## Install and update

### Claude

Run these commands in order to install:

```sh
claude plugin marketplace add example/tidy
claude plugin install tidy-hooks@tidy
```

To update, run:

```sh
claude plugin update tidy-hooks@tidy
```

### Codex

Run these commands in order to install:

```sh
codex plugin marketplace add example/tidy
codex plugin add tidy-hooks@tidy
```

Review and trust the plugin hooks before using them. Codex skips them until you do.

To update, run:

```sh
codex plugin marketplace upgrade tidy
```

Then restart Codex.

For both Claude and Codex, if Node.js is missing, commits proceed without the merge-marker check.
