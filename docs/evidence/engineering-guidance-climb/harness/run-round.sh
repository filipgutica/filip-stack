#!/usr/bin/env bash
# Runs one climb round under results/pilot/, which holds the pilot's prepared images and vanilla cache.
# PluginBench keys the vanilla cache on the prepared image IDs, and a new output parent rebuilds them.
# Usage: run-phase.sh <phase name> <coverage config> <no-coverage config>
set -uo pipefail
cd "$(dirname "$0")"
umask 022
# PluginBench from filipgutica/pluginbench#6, which fixes the Linux blockers this study found.
export PYTHONPATH="$HOME/code/pluginbench-wt-fix/src"
export PATH="$HOME/code/pluginbench/.venv/bin:$PATH"
phase=$1
mkdir -p "logs/$phase"
echo "$(date -u +%FT%TZ) pluginbench $(git -C "$HOME/code/pluginbench-wt-fix" rev-parse HEAD)" >> "logs/$phase/status.txt"
for config in "$2" "$3"; do
  name=$(basename "$config" .yaml)
  echo "$(date -u +%FT%TZ) start $name" >> "logs/$phase/status.txt"
  pluginbench run --config "$config" --output "results/pilot/$name" --yes > "logs/$phase/$name.log" 2>&1
  echo "$(date -u +%FT%TZ) exit=$? $name" >> "logs/$phase/status.txt"
done
echo "$(date -u +%FT%TZ) done" >> "logs/$phase/status.txt"
