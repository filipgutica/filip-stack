`tidy-hooks` is a Claude and Codex plugin that blocks `git commit` when staged files contain merge markers. If Node.js is missing, commits proceed.

## Install and update

### Claude

Install the plugin:

```sh
claude plugin marketplace add example/tidy
claude plugin install tidy-hooks@tidy
```

To update:

```sh
claude plugin update tidy-hooks@tidy
```

### Codex

Codex skips plugin hooks until you review and trust them.

Install the plugin:

```sh
codex plugin marketplace add example/tidy
codex plugin add tidy-hooks@tidy
```

To update, run this command, then restart Codex:

```sh
codex plugin marketplace upgrade tidy
```
