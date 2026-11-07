#!/bin/sh
# Field Guide end-to-end smoke check. Usage, from the repository root:
#   docs/evidence/field-guide-e2e/run.sh <work-dir>
# Runs three headless Claude Code sessions with HOME pointing at a fresh folder per case. That folder
# links .claude to the user's real Claude config folder, so login, plugins, and the Field Guide hooks
# load, while the hooks read and write a seeded guide there instead of ~/.field-guide. Claude Code
# writes its global .claude.json into the fresh folder. Do not set CLAUDE_CONFIG_DIR instead: Claude
# Code then writes a .claude.json into the real config folder.
# Each case prints the guide's active learnings after the run and whether the reply has a notice.
set -eu

work=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
repo_root=$(pwd)
field_guide="$repo_root/plugins/field-guide/skills/field-guide/scripts/field-guide.mjs"
config_dir=$HOME/.claude
mkdir -p "$work"

# Creates <case>/home/.field-guide with one shared record and <case>/repo as a git repository.
seed() {
  case_dir="$work/$1"
  mkdir -p "$case_dir/home" "$case_dir/repo"
  ln -s "$config_dir" "$case_dir/home/.claude"
  git -C "$case_dir/repo" init --quiet
  git -C "$case_dir/repo" remote add origin "https://github.com/example/$1.git"
  node "$field_guide" init --repo-root "$case_dir/repo" --guide-root "$case_dir/home/.field-guide" > /dev/null
  node "$field_guide" submit --repo-root "$case_dir/repo" --guide-root "$case_dir/home/.field-guide" --input-json "$2" > /dev/null
}

record() {
  printf '{"schemaVersion":1,"decision":"capture","confidence":"high","scope":"shared","subjectKey":"%s","learning":"%s","explicitPreference":true,"evidence":{"summary":"Seeded end-to-end record.","pointers":[{"kind":"manual","sourceLabel":"Fixture"}]}}' "$1" "$2"
}

run_case() {
  case_dir="$work/$1"
  # The prompt goes on stdin: --allowedTools takes every following argument as a tool name.
  (cd "$case_dir/repo" && printf '%s' "$2" | HOME="$case_dir/home" \
    claude --print --model claude-opus-5-5 --output-format text \
      --allowedTools Read Write Edit Glob Grep Skill Bash \
      > "$case_dir/reply.md" 2> "$case_dir/stderr.log") || echo "$1: claude exited $?"
  echo "## $1"
  node -e '
    const memory = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    for (const g of memory.guidance) console.log(`- ${g.status} ${g.scope.kind} ${g.subjectKey}: ${g.learning}`)
  ' "$case_dir/home/.field-guide/memory.json"
  if grep -q 'Field-guide:' "$case_dir/reply.md"; then echo "notice: yes"; else echo "notice: no"; fi
  ls "$case_dir/repo"
  grep -l -E "argparse|sys\.argv" "$case_dir/repo"/*.py 2>/dev/null | xargs -r grep -H -o -E "argparse|sys\.argv" | sort -u
}

# capture: a durable, portable preference stated inside a small task.
seed capture "$(record python-cli 'For small Python CLI tools that take fewer than three arguments, read the arguments from sys.argv directly instead of using argparse.')"
run_case capture "Write greet.sh that prints Hello and the first argument. Also, from now on in every repository, start shell scripts with set -euo pipefail."

# apply: the seeded record matches the first prompt and asks for a non-default choice, so its effect shows.
seed apply "$(record python-cli 'For small Python CLI tools that take fewer than three arguments, read the arguments from sys.argv directly instead of using argparse.')"
run_case apply "Write a small Python CLI, add.py, that adds two numbers given as arguments."

# skip: an ordinary task with nothing to learn.
seed skip "$(record python-cli 'For small Python CLI tools that take fewer than three arguments, read the arguments from sys.argv directly instead of using argparse.')"
printf 'Teh quick start.\n' > "$work/skip/repo/README.md"
run_case skip "Fix the typo in README.md."
