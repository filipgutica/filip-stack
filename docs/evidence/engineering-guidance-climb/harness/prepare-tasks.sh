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

git clone -q --filter=blob:none --no-checkout https://github.com/datacurve-ai/deep-swe "$scratch/deep-swe"
git -C "$scratch/deep-swe" checkout -q "$commit" -- "${tasks[@]/#/tasks/}"
mkdir -p "$out"
for task in "${tasks[@]}"; do
  rm -rf "${out:?}/$task"
  cp -r "$scratch/deep-swe/tasks/$task" "$out/$task"
done

# Repair: PyPI now names the latest python-dateutil sdist python_dateutil-*.tar.gz, so the
# unpinned download no longer matches the Dockerfile's python-dateutil-*.tar.gz glob and the image
# fails to build. Pin the last release that uses the old name. The verifier tree is unchanged.
dockerfile="$out/dateutil-rfc5545-timezone-interop/environment/Dockerfile"
grep -q 'pip3 download python-dateutil --no-deps' "$dockerfile"
sed -i.bak 's/pip3 download python-dateutil --no-deps/pip3 download "python-dateutil==2.9.0.post0" --no-deps/' "$dockerfile"
# Repair: requirements-dev.txt is unpinned, so a rebuild installs pytest 9.2.0, whose removal
# warning becomes a collection error under the repository's filterwarnings = error. The agent then
# cannot run the suite. Pin the test packages that differ from the task's pinned grader image.
grep -q 'pip3 install -r requirements-dev.txt$' "$dockerfile"
sed -i.bak 's/pip3 install -r requirements-dev.txt$/pip3 install -r requirements-dev.txt \&\& \\\n    pip3 install coverage==7.14.1 hypothesis==6.155.2 iniconfig==2.3.0 pytest==9.0.3/' "$dockerfile"
rm "$dockerfile.bak"
echo "prepared ${#tasks[@]} tasks in $out"
