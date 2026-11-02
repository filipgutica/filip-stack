#!/bin/sh
# Runs a Guardrails hook with Node.js 20.16 or newer. Without a usable Node it
# exits 0, so a missing runtime leaves the normal permission flow in charge.

script_path=${1:-}
if [ -z "$script_path" ]; then
  exit 0
fi
shift

node_runtime=

accept_node() {
  candidate=$1
  if [ ! -x "$candidate" ]; then
    return 1
  fi
  if ! "$candidate" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 16) ? 0 : 1)' >/dev/null 2>&1; then
    return 1
  fi
  node_runtime=$candidate
  return 0
}

if [ -n "${GUARDRAILS_NODE:-}" ]; then
  accept_node "$GUARDRAILS_NODE" || true
else
  path_node=$(command -v node 2>/dev/null || true)
  if [ -n "$path_node" ]; then
    accept_node "$path_node" || true
  fi

  if [ -z "$node_runtime" ] && [ -n "${NVM_BIN:-}" ]; then
    accept_node "$NVM_BIN/node" || true
  fi

  if [ -z "$node_runtime" ] && [ -n "${HOME:-}" ]; then
    for candidate in \
      "$HOME"/.nvm/versions/node/*/bin/node \
      "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node \
      "$HOME"/.volta/bin/node \
      "$HOME"/.asdf/shims/node \
      "$HOME"/.local/share/mise/shims/node
    do
      if accept_node "$candidate"; then
        break
      fi
    done
  fi

  if [ -z "$node_runtime" ]; then
    for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
      if accept_node "$candidate"; then
        break
      fi
    done
  fi
fi

if [ -z "$node_runtime" ]; then
  exit 0
fi

exec "$node_runtime" "$script_path" "$@"
