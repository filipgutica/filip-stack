#!/bin/sh

fail_open=false
if [ "${1:-}" = "--fail-open" ]; then
  fail_open=true
  shift
fi

script_path=${1:-}
if [ -z "$script_path" ]; then
  if [ "$fail_open" = true ]; then
    exit 0
  fi
  printf '%s\n' 'Workflow Node runner requires a script path.' >&2
  exit 64
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

if [ -n "${WORKFLOW_NODE:-}" ]; then
  accept_node "$WORKFLOW_NODE" || true
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
  if [ "$fail_open" = true ]; then
    exit 0
  fi
  printf '%s\n' 'Workflow requires Node.js 20.16 or newer. Install Node or set WORKFLOW_NODE to its executable path.' >&2
  exit 127
fi

exec "$node_runtime" "$script_path" "$@"
