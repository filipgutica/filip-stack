#!/usr/bin/env bash
# Builds a run's tasks/ directory: the six DeepSWE tasks at 0b9fabbb, with one environment repair.
# Usage: prepare-tasks.sh <output directory>
set -euo pipefail

out=$1
commit=0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea
tasks=(
  true-myth-iterable-collection-combinators
  csstree-shorthand-expansion-compression
  happy-dom-abort-pending-body-reads
  adaptix-name-mapping-aliases
  testem-per-launcher-reports
  dateutil-rfc5545-timezone-interop
)

# PluginBench's reviewed verifier digests include file modes, so group-write bits break admission.
umask 022
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

# gc.auto=0 stops a background repack from racing the cleanup trap.
git -c gc.auto=0 clone -q --filter=blob:none --no-checkout https://github.com/datacurve-ai/deep-swe "$scratch/deep-swe"
git -C "$scratch/deep-swe" -c gc.auto=0 checkout -q "$commit" -- "${tasks[@]/#/tasks/}"
mkdir -p "$out"
for task in "${tasks[@]}"; do
  rm -rf "${out:?}/$task"
  cp -r "$scratch/deep-swe/tasks/$task" "$out/$task"
done

# Repair: every prompt says to commit, and PluginBench grades `git diff <base> HEAD`, but the
# task images set no Git identity, so `git commit` fails. Agents that stop to ask then submit an
# empty patch. Agents run in each task's prebuilt `docker_image`, not its Dockerfile, so set a
# neutral identity through the agent environment. GIT_CONFIG_* entries read as ordinary config,
# so `git config user.name` shows them too. The verifier's environment and tests are unchanged.
python3 - "$out" "${tasks[@]}" <<'PY'
import pathlib
import sys
import tomllib

identity = '''[environment.env]
GIT_CONFIG_COUNT = "2"
GIT_CONFIG_KEY_0 = "user.name"
GIT_CONFIG_VALUE_0 = "Task Developer"
GIT_CONFIG_KEY_1 = "user.email"
GIT_CONFIG_VALUE_1 = "developer@example.invalid"
'''
out, tasks = pathlib.Path(sys.argv[1]), sys.argv[2:]
for task in tasks:
    path = out / task / "task.toml"
    text = path.read_text()
    if tomllib.loads(text)["environment"].get("env") != {} or text.count("[environment.env]\n") != 1:
        sys.exit(f"{task}: expected one empty [environment.env] table")
    path.write_text(text.replace("[environment.env]\n", identity))
    env = tomllib.loads(path.read_text())["environment"]["env"]
    assert env["GIT_CONFIG_VALUE_1"] == "developer@example.invalid", task
PY
echo "prepared ${#tasks[@]} tasks in $out"
