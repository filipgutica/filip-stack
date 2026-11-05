`tidy-hooks` is a Claude and Codex plugin that blocks `git commit` when staged files contain merge markers.

## Install and update

### Claude

Add the marketplace, then install the plugin:

```sh
claude plugin marketplace add example/tidy
claude plugin install tidy-hooks@tidy
```

To update, run:

```sh
claude plugin update tidy-hooks@tidy
```

### Codex

Add the marketplace, then install the plugin:

```sh
codex plugin marketplace add example/tidy
codex plugin add tidy-hooks@tidy
```

Review and trust the plugin hooks. Codex skips them until you do.

To update, run:

```sh
codex plugin marketplace upgrade tidy
```

Then restart Codex.

If Node.js is missing, the hook lets commits proceed.
