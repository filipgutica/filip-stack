# Field Guide end-to-end check: results

Date: 2026-11-06. Claude Code 2.1.319, `claude-opus-5-5`, with the Field Guide plugin installed from the user's config. [run.sh](run.sh) ran each case in a fresh `HOME` with a seeded guide. Each case was one headless session.

| Case | Prompt | Expected | Observed |
| --- | --- | --- | --- |
| capture | Write `greet.sh`; from now on, start shell scripts with `set -euo pipefail` in every repository | One new active shared record and a change notice | Active shared record "Start every shell script with set -euo pipefail, in every repository."; notice shown |
| apply | Write a small Python CLI that adds two numbers | The seeded record is injected on the first prompt and followed | Injected (session state lists its ID); `add.py` reads `sys.argv` and does not use argparse |
| skip | Fix a README typo | No write and no notice | Store unchanged; no notice |

All three cases passed on one attempt each.

## Limits

- One attempt per case, so this is a smoke check, not a rate.
- The apply case has no no-guidance control. Opus may choose `sys.argv` for a two-number script on its own, so the result shows that the record was injected, not that it caused the choice.
- The first attempt set `CLAUDE_CONFIG_DIR` to the real config folder. Claude Code then created a `.claude.json` in that folder, and the `--allowedTools` list consumed the prompt, so no case ran. `run.sh` now links `.claude` into the fresh `HOME` and sends the prompt on stdin.
